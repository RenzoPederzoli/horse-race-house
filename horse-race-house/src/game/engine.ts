import type { BetsByPlayer, CourseState, HouseGameState, PlayerId, PayoutResult, Suit } from './types'
import { SUITS, SUIT_LABEL } from './types'

export function courseCounts(course: CourseState): Record<Suit, number> {
  const out: Record<Suit, number> = { clubs: 0, diamonds: 0, hearts: 0, spades: 0 }
  for (const s of course.cards) out[s]++
  return out
}

// Odds mapping described in the prompt (based on how many of that suit appear in the top row).
// For payout math we use "profitMultiplierK" where profit = stake * K.
export function profitMultiplierFromCount(count: number): number {
  switch (count) {
    case 0:
      return 1 // evens => profit = 1x stake
    case 1:
      return 2 // 2-1 => profit = 2x stake
    case 2:
      return 3 // 3-1
    case 3:
      return 5 // 5-1
    case 4:
      return 10 // 10-1
    default:
      // The course rule should prevent counts >= 5 from being confirmed.
      return 0
  }
}

export function profitMultiplierBySuit(course: CourseState): Record<Suit, number> {
  const counts = courseCounts(course)
  return {
    clubs: profitMultiplierFromCount(counts.clubs),
    diamonds: profitMultiplierFromCount(counts.diamonds),
    hearts: profitMultiplierFromCount(counts.hearts),
    spades: profitMultiplierFromCount(counts.spades),
  }
}

export function validateCourseForConfirm(course: CourseState): { ok: true } | { ok: false; reason: string } {
  if (course.reshuffleNeeded) return { ok: false, reason: 'Course needs reshuffle (a suit appeared 5+ times).' }
  if (course.cards.length !== 7) return { ok: false, reason: 'Course must have exactly 7 cards.' }
  const counts = courseCounts(course)
  for (const s of SUITS) {
    if (counts[s] >= 5) return { ok: false, reason: `Cannot confirm: ${SUIT_LABEL[s]} appears 5+ times.` }
  }
  return { ok: true }
}

export function updateCourseWithSuit(course: CourseState, suit: Suit): CourseState {
  const nextCards = [...course.cards, suit]
  const counts = courseCounts({ ...course, cards: nextCards, reshuffleNeeded: false })
  const reshuffleNeeded = Object.values(counts).some((n) => n >= 5)
  return { cards: nextCards, reshuffleNeeded }
}

export function isBetAmountValid(
  chips: number,
  betsForPlayer: Partial<Record<Suit, number>>,
  amount: number,
  suit: Suit,
): { ok: true } | { ok: false; reason: string } {
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, reason: 'Bet must be >= 0.' }
  if (!Number.isInteger(amount)) return { ok: false, reason: 'Bet must be an integer.' }
  const nextBets: Partial<Record<Suit, number>> = { ...betsForPlayer, [suit]: amount }
  const total = SUITS.reduce((sum, s) => sum + (nextBets[s] ?? 0), 0)
  if (total > chips) return { ok: false, reason: 'Total bets exceed your available chips.' }
  return { ok: true }
}

function sumBetsForSuit(betsByPlayer: BetsByPlayer, playerId: PlayerId, suit: Suit): number {
  return betsByPlayer[playerId]?.[suit] ?? 0
}

export function computePayout(args: {
  players: HouseGameState['players']
  betsByPlayer: BetsByPlayer
  course: CourseState
  winnerSuit: Suit
}): PayoutResult {
  const multipliers = profitMultiplierBySuit(args.course)
  const profitMultiplierK = multipliers[args.winnerSuit]

  const playerChipDeltas: Record<PlayerId, number> = {}
  let houseDelta = 0

  for (const p of args.players) {
    const winStake = sumBetsForSuit(args.betsByPlayer, p.id, args.winnerSuit)
    const loseStake = SUITS.reduce((sum, s) => {
      if (s === args.winnerSuit) return sum
      return sum + (args.betsByPlayer[p.id]?.[s] ?? 0)
    }, 0)

    const profit = winStake * profitMultiplierK
    const delta = profit - loseStake
    playerChipDeltas[p.id] = delta

    houseDelta += loseStake - profit
  }

  return {
    winnerSuit: args.winnerSuit,
    profitMultiplierK,
    playerChipDeltas,
    houseDelta,
  }
}

export function finishPositionsForWinner(winnerSuit: Suit): Record<Suit, number> {
  // Winner is shown as crossing the finish; other lanes are kept at 0 (we're not
  // simulating intermediate race progress).
  const finalPositions: Record<Suit, number> = { clubs: 0, diamonds: 0, hearts: 0, spades: 0 }
  finalPositions[winnerSuit] = 8
  return finalPositions
}

export function createInitialBetsByPlayer(players: HouseGameState['players']): BetsByPlayer {
  const out: BetsByPlayer = {}
  for (const p of players) out[p.id] = {}
  return out
}

