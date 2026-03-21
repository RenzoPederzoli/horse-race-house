import type { Card, Rank, Suit } from './types'
import { SUITS } from './types'

// Aces are the "horses" — they never appear in the course or race
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

export function shuffleDeck(deck: Card[]): Card[] {
  const arr = [...deck]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function dealCourse(deck: Card[]): { courseCards: Card[]; remainingDeck: Card[] } {
  for (let attempt = 0; attempt < 100; attempt++) {
    const shuffled = shuffleDeck(deck)
    const courseCards = shuffled.slice(0, 7)
    const remainingDeck = shuffled.slice(7)

    // Check no suit appears 5+ times
    const counts: Record<Suit, number> = { clubs: 0, diamonds: 0, hearts: 0, spades: 0 }
    for (const card of courseCards) counts[card.suit]++
    const valid = SUITS.every((s) => counts[s] < 5)

    if (valid) return { courseCards, remainingDeck }
  }

  // Fallback (should never happen with a 52-card deck)
  const shuffled = shuffleDeck(deck)
  return { courseCards: shuffled.slice(0, 7), remainingDeck: shuffled.slice(7) }
}

export function simulateRace(remainingDeck: Card[]): {
  sequence: Card[]
  positionsAtStep: Record<Suit, number>[]
  winnerSuit: Suit
  finalPositions: Record<Suit, number>
} {
  const positions: Record<Suit, number> = { clubs: 0, diamonds: 0, hearts: 0, spades: 0 }
  const sequence: Card[] = []
  const positionsAtStep: Record<Suit, number>[] = [{ ...positions }]

  for (const card of remainingDeck) {
    positions[card.suit]++
    sequence.push(card)
    positionsAtStep.push({ ...positions })

    if (positions[card.suit] >= 8) {
      return {
        sequence,
        positionsAtStep,
        winnerSuit: card.suit,
        finalPositions: { ...positions },
      }
    }
  }

  // Edge case: find the suit with the highest position
  let best: Suit = 'clubs'
  for (const s of SUITS) {
    if (positions[s] > positions[best]) best = s
  }
  return { sequence, positionsAtStep, winnerSuit: best, finalPositions: { ...positions } }
}
