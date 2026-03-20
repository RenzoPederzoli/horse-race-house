import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { Server } from 'socket.io'
import { createInitialGameState } from '../src/game/reducer.ts'
import type { GameAction } from '../src/game/reducer.ts'
import { historyReducer, createHistoryState } from '../src/game/history.ts'
import type { HistoryAction, HistoryState } from '../src/game/history.ts'
import { projectPlayerView } from './stateProjection.ts'
import type { ConnectedPlayer, PlayerJoinPayload, PlayerActionPayload, HostView } from '../src/shared/protocol.ts'
import { EVENTS } from '../src/shared/protocol.ts'

const PORT = 3001

function getLanAddress(): string {
  const interfaces = networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return 'localhost'
}

const lanAddress = getLanAddress()

// --- State ---

let history: HistoryState = createHistoryState(
  createInitialGameState({
    startingChips: 100,
    houseBankroll: 0,
    chipsPerDollar: 10,
    racesToPlay: 0,
    players: [
      { id: 'p1', name: 'Player 1', chips: 100 },
      { id: 'p2', name: 'Player 2', chips: 100 },
      { id: 'p3', name: 'Player 3', chips: 100 },
    ],
  }),
)

// sessionId -> { playerId, name, socketId | null }
const sessions = new Map<string, { playerId: string; name: string; socketId: string | null }>()

// Per-player bet undo stacks: playerId -> stack of previous bets
const playerBetUndoStacks = new Map<string, Array<Record<string, number>>>()

// --- Server ---

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: { origin: '*' },
})

function getState() {
  return history.present
}

function dispatchAction(action: HistoryAction) {
  history = historyReducer(history, action)
}

function connectedPlayers(): ConnectedPlayer[] {
  const result: ConnectedPlayer[] = []
  for (const [, session] of sessions) {
    result.push({
      playerId: session.playerId,
      name: session.name,
      online: session.socketId !== null,
    })
  }
  return result
}

function broadcastState() {
  const state = getState()
  const players = connectedPlayers()

  const hostView: HostView = { gameState: state, connectedPlayers: players, lanUrl: `http://${lanAddress}:5173/play` }
  io.to('host').emit(EVENTS.STATE_HOST, hostView)

  for (const [, session] of sessions) {
    if (session.socketId) {
      try {
        const view = projectPlayerView(state, session.playerId)
        io.to(session.socketId).emit(EVENTS.STATE_PLAYER, view)
      } catch {
        // Player may not exist in game state yet
      }
    }
  }
}

io.on('connection', (socket) => {
  console.log(`[ws] connected: ${socket.id}`)

  socket.on('host:identify', () => {
    socket.join('host')
    const hostView: HostView = { gameState: getState(), connectedPlayers: connectedPlayers(), lanUrl: `http://${lanAddress}:5173/play` }
    socket.emit(EVENTS.STATE_HOST, hostView)
    console.log(`[ws] host identified: ${socket.id}`)
  })

  socket.on(EVENTS.HOST_ACTION, (action: GameAction) => {
    console.log(`[ws] host:action`, action.type)

    if (action.type === 'FULL_RESET_TO_SETUP') {
      playerBetUndoStacks.clear()
    }

    dispatchAction(action)
    broadcastState()
  })

  socket.on(EVENTS.PLAYER_JOIN, (payload: PlayerJoinPayload) => {
    const { name, sessionId } = payload
    console.log(`[ws] player:join name=${name} sessionId=${sessionId}`)

    const existing = sessions.get(sessionId)
    if (existing) {
      existing.socketId = socket.id
      existing.name = name
      socket.join(`player:${existing.playerId}`)

      try {
        const view = projectPlayerView(getState(), existing.playerId)
        socket.emit(EVENTS.STATE_PLAYER, view)
      } catch {
        // Player may have been removed
      }
      broadcastState()
      return
    }

    const state = getState()
    const occupiedPlayerIds = new Set([...sessions.values()].map((s) => s.playerId))
    let slot = state.players.find((p) => !occupiedPlayerIds.has(p.id))

    if (!slot && state.phase === 'setup') {
      dispatchAction({ type: 'ADD_PLAYER', name })
      const newState = getState()
      slot = newState.players.find((p) => !occupiedPlayerIds.has(p.id))
    }

    if (!slot) {
      socket.emit('join_error', 'No available player slots')
      return
    }

    if (state.phase === 'setup') {
      dispatchAction({ type: 'UPDATE_PLAYER_NAME', playerId: slot.id, name })
    }

    sessions.set(sessionId, { playerId: slot.id, name, socketId: socket.id })
    socket.join(`player:${slot.id}`)

    broadcastState()
  })

  socket.on(EVENTS.PLAYER_ACTION, (payload: PlayerActionPayload) => {
    let playerId: string | null = null
    for (const [, session] of sessions) {
      if (session.socketId === socket.id) {
        playerId = session.playerId
        break
      }
    }
    if (!playerId) return

    const { action } = payload
    if (action.type === 'SET_BET') {
      const currentBets = getState().betsByPlayer[playerId] ?? {}
      const stack = playerBetUndoStacks.get(playerId) ?? []
      stack.push({ ...currentBets } as Record<string, number>)
      playerBetUndoStacks.set(playerId, stack)

      dispatchAction({ type: 'SET_BET', playerId, suit: action.suit, amount: action.amount })
    } else if (action.type === 'TOPUP_CHIPS') {
      dispatchAction({ type: 'TOPUP_CHIPS', playerId, amount: action.amount })
    }

    broadcastState()
  })

  socket.on(EVENTS.PLAYER_UNDO, () => {
    let playerId: string | null = null
    for (const [, session] of sessions) {
      if (session.socketId === socket.id) {
        playerId = session.playerId
        break
      }
    }
    if (!playerId) return

    const stack = playerBetUndoStacks.get(playerId)
    if (!stack || stack.length === 0) return

    const previousBets = stack.pop()!
    const state = getState()
    if (state.phase !== 'betting') return

    const suits = ['clubs', 'diamonds', 'hearts', 'spades'] as const
    for (const suit of suits) {
      const amount = (previousBets as Record<string, number>)[suit] ?? 0
      dispatchAction({ type: 'SET_BET', playerId, suit, amount })
    }

    broadcastState()
  })

  socket.on('disconnect', () => {
    console.log(`[ws] disconnected: ${socket.id}`)
    for (const [, session] of sessions) {
      if (session.socketId === socket.id) {
        session.socketId = null
        break
      }
    }
    broadcastState()
  })
})

httpServer.listen(PORT, () => {
  console.log(`[server] WebSocket server on port ${PORT}`)
  console.log(`[server] LAN address: http://${lanAddress}:5173/play`)
})
