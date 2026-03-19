import type { BetsByPlayer, CourseState, HouseGameState, PlayerId, RaceState, SettlementResult, Suit } from './types'
import { SUITS } from './types'
import {
  createInitialBetsByPlayer,
  computePayout,
  finishPositionsForWinner,
  updateCourseWithSuit,
  validateCourseForConfirm,
} from './engine'

export type GameAction =
  | { type: 'SET_SETTINGS'; startingChips: number; houseBankroll: number; chipsPerDollar: number; racesToPlay: number }
  | { type: 'ADD_PLAYER'; name: string }
  | { type: 'REMOVE_PLAYER'; playerId: PlayerId }
  | { type: 'UPDATE_PLAYER_NAME'; playerId: PlayerId; name: string }
  | { type: 'TOPUP_CHIPS'; playerId: PlayerId; amount: number }
  | { type: 'FULL_RESET_TO_SETUP' }
  | { type: 'START_NEW_GAME' }
  | { type: 'ADD_COURSE_CARD'; suit: Suit }
  | { type: 'RESHuffle_COURSE' }
  | { type: 'CONFIRM_COURSE' }
  | { type: 'SET_BET'; playerId: PlayerId; suit: Suit; amount: number }
  | { type: 'CONFIRM_BETS' }
  | { type: 'CONFIRM_RACE_OUTCOME'; winnerSuit: Suit }
  | { type: 'NEW_RACE' }
  | { type: 'SETTLE_HOUSE_DEBT' }

export function createInitialGameState(args: {
  players: { id: PlayerId; name: string; chips: number }[]
  startingChips: number
  houseBankroll: number
  chipsPerDollar: number
  racesToPlay: number
}): HouseGameState {
  const emptyCourse: CourseState = { cards: [], reshuffleNeeded: false }
  const emptyRace: RaceState = {}

  return {
    phase: 'setup',
    houseBankroll: args.houseBankroll,
    players: args.players.map((p) => ({ ...p, boughtChips: p.chips })),
    startingChips: args.startingChips,
    chipsPerDollar: args.chipsPerDollar,
    racesToPlay: args.racesToPlay,
    racesCompleted: 0,
    course: emptyCourse,
    bettingOrder: args.players.map((p) => p.id),
    betsByPlayer: Object.fromEntries(args.players.map((p) => [p.id, {}])) as BetsByPlayer,
    race: emptyRace,
    payout: undefined,
    settlement: undefined,
  }
}

function totalBetsForPlayer(bets: Partial<Record<Suit, number>>): number {
  return SUITS.reduce((sum, s) => sum + (bets[s] ?? 0), 0)
}

function validateBetsBeforeConfirm(state: HouseGameState): { ok: true } | { ok: false; reason: string } {
  for (const p of state.players) {
    const bets = state.betsByPlayer[p.id] ?? {}
    const total = totalBetsForPlayer(bets)
    if (total < 0) return { ok: false, reason: 'Invalid bets total.' }
    if (total > p.chips) return { ok: false, reason: 'Bets exceed player chips.' }
    for (const s of SUITS) {
      const amt = bets[s] ?? 0
      if (!Number.isFinite(amt) || amt < 0) return { ok: false, reason: 'Invalid bet amount.' }
      if (!Number.isInteger(amt)) return { ok: false, reason: 'Bet amounts must be integers.' }
    }
  }
  return { ok: true }
}

function distributeDebt(args: { debt: number; playerIds: PlayerId[] }): { shareByPlayer: Record<PlayerId, number>; total: number } {
  const n = args.playerIds.length
  const base = Math.floor(args.debt / n)
  const remainder = args.debt - base * n
  const shareByPlayer: Record<PlayerId, number> = {}
  let total = 0
  for (let i = 0; i < args.playerIds.length; i++) {
    const id = args.playerIds[i]
    const extra = i < remainder ? 1 : 0
    const share = base + extra
    shareByPlayer[id] = share
    total += share
  }
  return { shareByPlayer, total }
}

function shufflePlayerIds(ids: PlayerId[]): PlayerId[] {
  const arr = [...ids]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function applySettlement(state: HouseGameState): HouseGameState {
  if (state.phase === 'settled') return state

  const houseNet = Math.floor(state.houseBankroll)
  const playerIds = state.players.map((p) => p.id)

  const houseMagnitude = Math.abs(houseNet)
  const { shareByPlayer } = distributeDebt({ debt: houseMagnitude, playerIds })

  const players =
    houseNet >= 0
      ? state.players.map((p) => ({ ...p, chips: p.chips + shareByPlayer[p.id] }))
      : state.players.map((p) => ({ ...p, chips: p.chips - shareByPlayer[p.id] }))

  const finalHouseBankroll = 0

  const settlement: SettlementResult = {
    houseNet,
    shareByPlayer,
    finalHouseBankroll,
  }

  return {
    ...state,
    phase: 'settled',
    houseBankroll: finalHouseBankroll,
    players,
    settlement,
  }
}

export function gameReducer(state: HouseGameState, action: GameAction): HouseGameState {
  switch (action.type) {
    case 'SET_SETTINGS': {
      if (state.phase !== 'setup') return state
      const chipsPerDollar = Math.max(1, Math.floor(action.chipsPerDollar))
      const nextStartingChips = Math.max(0, Math.floor(action.startingChips))
      const racesToPlay = Math.max(0, Math.floor(action.racesToPlay))
      return {
        ...state,
        startingChips: nextStartingChips,
        houseBankroll: Math.floor(action.houseBankroll),
        chipsPerDollar,
        racesToPlay,
        racesCompleted: 0,
        // In setup, treat editing `startingChips` as updating the players' current stacks too.
        players: state.players.map((p) => ({
          ...p,
          chips: nextStartingChips,
          boughtChips: nextStartingChips,
        })),
        bettingOrder: state.players.map((p) => p.id),
        betsByPlayer: Object.fromEntries(state.players.map((p) => [p.id, {}])) as BetsByPlayer,
      }
    }

    case 'ADD_PLAYER': {
      if (state.phase !== 'setup') return state
      if (state.players.length >= 4) return state
      const id = `p_${Math.random().toString(16).slice(2)}`
      const chips = Math.max(0, Math.floor(state.startingChips))
      return {
        ...state,
        players: [...state.players, { id, name: action.name, chips, boughtChips: chips }],
        bettingOrder: [...state.bettingOrder, id],
        betsByPlayer: { ...state.betsByPlayer, [id]: {} },
      }
    }

    case 'REMOVE_PLAYER': {
      if (state.phase !== 'setup') return state
      if (state.players.length <= 3) return state
      const players = state.players.filter((p) => p.id !== action.playerId)
      const betsByPlayer: BetsByPlayer = {}
      for (const p of players) betsByPlayer[p.id] = state.betsByPlayer[p.id] ?? {}
      const bettingOrder = state.bettingOrder.filter((id) => id !== action.playerId)
      return { ...state, players, bettingOrder, betsByPlayer }
    }

    case 'UPDATE_PLAYER_NAME': {
      if (state.phase !== 'setup') return state
      return { ...state, players: state.players.map((p) => (p.id === action.playerId ? { ...p, name: action.name } : p)) }
    }

    case 'FULL_RESET_TO_SETUP': {
      const resetPlayers = state.players.map((p) => ({ ...p, chips: state.startingChips, boughtChips: state.startingChips }))
      return {
        ...state,
        phase: 'setup',
        houseBankroll: state.houseBankroll,
        players: resetPlayers,
        course: { cards: [], reshuffleNeeded: false },
        bettingOrder: resetPlayers.map((p) => p.id),
        betsByPlayer: Object.fromEntries(resetPlayers.map((p) => [p.id, {}])) as BetsByPlayer,
        race: {},
        payout: undefined,
        settlement: undefined,
        racesCompleted: 0,
      }
    }

    case 'START_NEW_GAME': {
      if (state.phase !== 'setup') return state
      if (state.players.length < 3) return state
      return {
        ...state,
        phase: 'course',
        course: { cards: [], reshuffleNeeded: false },
        bettingOrder: state.players.map((p) => p.id),
        betsByPlayer: createInitialBetsByPlayer(state.players),
        race: {},
        payout: undefined,
      }
    }

    case 'ADD_COURSE_CARD': {
      if (state.phase !== 'course') return state
      if (state.course.reshuffleNeeded) return state
      if (state.course.cards.length >= 7) return state
      const nextCourse = updateCourseWithSuit(state.course, action.suit)
      return { ...state, course: nextCourse }
    }

    case 'RESHuffle_COURSE': {
      if (state.phase !== 'course') return state
      return { ...state, course: { cards: [], reshuffleNeeded: false } }
    }

    case 'CONFIRM_COURSE': {
      if (state.phase !== 'course') return state
      const validation = validateCourseForConfirm(state.course)
      if (!validation.ok) return state
      return {
        ...state,
        phase: 'betting',
        bettingOrder: shufflePlayerIds(state.players.map((p) => p.id)),
        betsByPlayer: createInitialBetsByPlayer(state.players),
        race: {},
        payout: undefined,
      }
    }

    case 'SET_BET': {
      if (state.phase !== 'betting') return state
      const prevPlayerBets = state.betsByPlayer[action.playerId] ?? {}
      const nextBetsForPlayer = { ...prevPlayerBets, [action.suit]: Math.max(0, Math.floor(action.amount)) }
      const betsByPlayer: BetsByPlayer = { ...state.betsByPlayer, [action.playerId]: nextBetsForPlayer }
      return { ...state, betsByPlayer }
    }

    case 'CONFIRM_BETS': {
      if (state.phase !== 'betting') return state
      const validation = validateBetsBeforeConfirm(state)
      if (!validation.ok) return state
      return { ...state, phase: 'race', race: {}, payout: undefined }
    }

    case 'CONFIRM_RACE_OUTCOME': {
      if (state.phase !== 'race') return state

      // Dealer selects the winner; we don't simulate intermediate progress.
      const race: RaceState = {
        winnerSuit: action.winnerSuit,
        finalPositions: finishPositionsForWinner(action.winnerSuit),
      }
      const payout = computePayout({ players: state.players, betsByPlayer: state.betsByPlayer, course: state.course, winnerSuit: action.winnerSuit })

      const players = state.players.map((p) => ({ ...p, chips: p.chips + payout.playerChipDeltas[p.id] }))

      const nextRacesCompleted = state.racesCompleted + 1
      const nextState: HouseGameState = {
        ...state,
        phase: 'payout',
        race,
        payout,
        houseBankroll: state.houseBankroll + payout.houseDelta,
        players,
        racesCompleted: nextRacesCompleted,
      }

      if (nextState.racesToPlay > 0 && nextState.racesCompleted >= nextState.racesToPlay) {
        return applySettlement(nextState)
      }

      return nextState
    }

    case 'NEW_RACE': {
      if (state.phase !== 'payout') return state
      return {
        ...state,
        phase: 'course',
        course: { cards: [], reshuffleNeeded: false },
        bettingOrder: state.players.map((p) => p.id),
        betsByPlayer: createInitialBetsByPlayer(state.players),
        race: {},
        payout: undefined,
      }
    }

    case 'TOPUP_CHIPS': {
      if (state.phase === 'settled') return state
      if (!Number.isFinite(action.amount) || action.amount <= 0) return state
      const amount = Math.floor(action.amount)
      return {
        ...state,
        players: state.players.map((p) => {
          if (p.id !== action.playerId) return p
          return { ...p, chips: p.chips + amount, boughtChips: p.boughtChips + amount }
        }),
      }
    }

    case 'SETTLE_HOUSE_DEBT': {
      return applySettlement(state)
    }
  }
}

