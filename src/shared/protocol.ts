import type { Card, GamePhase, PlayerId, Suit } from '../game/types.ts'

// --- Socket event names ---

export const EVENTS = {
  HOST_ACTION: 'host:action',
  PLAYER_JOIN: 'player:join',
  PLAYER_ACTION: 'player:action',
  PLAYER_UNDO: 'player:undo',
  STATE_HOST: 'state:host',
  STATE_PLAYER: 'state:player',
} as const

// --- Types ---

export interface ConnectedPlayer {
  playerId: PlayerId
  name: string
  online: boolean
}

export interface HostView {
  gameState: import('../game/types.ts').HouseGameState
  connectedPlayers: ConnectedPlayer[]
  lanUrl: string
}

export interface PlayerView {
  phase: GamePhase
  playerId: PlayerId
  playerName: string
  chips: number
  boughtChips: number
  bets: Partial<Record<Suit, number>>
  oddsBySuit: Record<Suit, number>
  courseCards: Suit[]
  allPlayerNames: string[]
  raceResult: {
    winnerSuit: Suit
    myDelta: number
    myNewChips: number
  } | null
  settlement: {
    houseNet: number
    myShare: number
    myFinalChips: number
    myNet: number
  } | null
  canBet: boolean
  chipsPerDollar: number
  racesCompleted: number
  racesToPlay: number
  automated: boolean
  courseFullCards?: Card[]
  raceSequence?: Card[]
  positionsAtStep?: Record<Suit, number>[]
  raceFinalPositions?: Record<Suit, number>
}

export interface PlayerJoinPayload {
  name: string
  sessionId: string
}

export interface PlayerActionPayload {
  action: { type: 'SET_BET'; suit: Suit; amount: number } | { type: 'TOPUP_CHIPS'; amount: number }
}
