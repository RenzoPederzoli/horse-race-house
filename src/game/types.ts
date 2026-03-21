export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

export interface Card {
  rank: Rank
  suit: Suit
}

export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'

export const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

export const SUIT_LABEL: Record<Suit, string> = {
  clubs: 'Clubs',
  diamonds: 'Diamonds',
  hearts: 'Hearts',
  spades: 'Spades',
}

export type GamePhase = 'setup' | 'course' | 'betting' | 'race' | 'payout' | 'settled'

export type PlayerId = string

export interface Player {
  id: PlayerId
  name: string
  chips: number
  // Total amount of chips bought by the player (1 chip == 1 unit of money by default).
  boughtChips: number
}

export type BetsByPlayer = Record<PlayerId, Partial<Record<Suit, number>>>

export interface CourseState {
  cards: Suit[] // top row course cards (should be length 0..7)
  reshuffleNeeded: boolean
  fullCards?: Card[] // actual Card objects when automated
}

export interface RaceState {
  winnerSuit?: Suit
  seed?: number
  finalPositions?: Record<Suit, number> // 0..8 (winner at 8)
  raceSequence?: Card[]
  positionsAtStep?: Record<Suit, number>[]
}

export interface PayoutResult {
  winnerSuit: Suit
  profitMultiplierK: number // K in "odds K-1", where profit = stake*K
  playerChipDeltas: Record<PlayerId, number>
  houseDelta: number
}

export interface SettlementResult {
  // Signed net settlement amount from the house perspective.
  // Negative => players pay back to the house (house was in the red).
  // Positive => players receive money from the house (house made a profit).
  houseNet: number
  shareByPlayer: Record<PlayerId, number>
  // After settlement.
  finalHouseBankroll: number
}

export interface HouseGameState {
  phase: GamePhase

  houseBankroll: number

  players: Player[]

  // Settings
  startingChips: number
  // Conversion rate: how many chips make up $1.
  chipsPerDollar: number

  // Race limiting:
  // - racesToPlay <= 0 means unlimited
  // - racesCompleted counts how many races have been completed (payout computed)
  racesToPlay: number
  racesCompleted: number

  course: CourseState
  // Player order used for the betting table in the current race.
  bettingOrder: PlayerId[]
  betsByPlayer: BetsByPlayer
  race: RaceState
  payout?: PayoutResult
  settlement?: SettlementResult
  automated: boolean
}

