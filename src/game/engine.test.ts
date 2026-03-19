import { describe, expect, it } from 'vitest'
import type { BetsByPlayer, CourseState, HouseGameState } from './types'
import { finishPositionsForWinner, profitMultiplierFromCount, computePayout, validateCourseForConfirm } from './engine'
import type { Suit } from './types'
import { historyReducer, createHistoryState } from './history'

describe('Odds and payout engine', () => {
  it('maps course count to profit multipliers', () => {
    expect(profitMultiplierFromCount(0)).toBe(1)
    expect(profitMultiplierFromCount(1)).toBe(2)
    expect(profitMultiplierFromCount(2)).toBe(3)
    expect(profitMultiplierFromCount(3)).toBe(5)
    expect(profitMultiplierFromCount(4)).toBe(10)
  })

  it('computes payout deltas and house delta', () => {
    const course: CourseState = {
      // counts: clubs=0, diamonds=1, hearts=2, spades=4 (total 7)
      cards: ['diamonds', 'hearts', 'hearts', 'spades', 'spades', 'spades', 'spades'],
      reshuffleNeeded: false,
    }

    const winnerSuit: Suit = 'spades' // count=4 => K=10

    const players: HouseGameState['players'] = [
      { id: 'p1', name: 'A', chips: 100, boughtChips: 100 },
      { id: 'p2', name: 'B', chips: 100, boughtChips: 100 },
    ]

    const betsByPlayer: BetsByPlayer = {
      p1: { spades: 5, hearts: 3 }, // win profit 50, lose 3 => +47
      p2: { spades: 2, hearts: 1 }, // win profit 20, lose 1 => +19
    }

    const payout = computePayout({ players, betsByPlayer, course, winnerSuit })
    expect(payout.winnerSuit).toBe('spades')
    expect(payout.profitMultiplierK).toBe(10)
    expect(payout.playerChipDeltas.p1).toBe(47)
    expect(payout.playerChipDeltas.p2).toBe(19)
    expect(payout.houseDelta).toBe(-66) // (3+1) - (50+20)
  })

  it('builds finish positions with winner at 8', () => {
    const winnerSuit: Suit = 'clubs'
    const positions = finishPositionsForWinner(winnerSuit)
    expect(positions.clubs).toBe(8)
    expect(positions.diamonds).toBe(0)
    expect(positions.hearts).toBe(0)
    expect(positions.spades).toBe(0)
  })

  it('validates course confirmation rules', () => {
    const invalidLen: CourseState = { cards: ['clubs', 'clubs'], reshuffleNeeded: false }
    expect(validateCourseForConfirm(invalidLen).ok).toBe(false)

    const reshuffleNeeded: CourseState = { cards: ['clubs', 'clubs', 'clubs', 'clubs', 'clubs', 'hearts', 'spades'], reshuffleNeeded: true }
    expect(validateCourseForConfirm(reshuffleNeeded).ok).toBe(false)

    const valid: CourseState = { cards: ['clubs', 'diamonds', 'hearts', 'spades', 'spades', 'spades', 'spades'], reshuffleNeeded: false }
    expect(validateCourseForConfirm(valid).ok).toBe(true)
  })
})

describe('Game state machine (undo)', () => {
  it('transitions to payout on confirmRaceOutcome and supports undo', () => {
    const course: CourseState = {
      cards: ['diamonds', 'hearts', 'hearts', 'spades', 'spades', 'spades', 'spades'],
      reshuffleNeeded: false,
    }

    const betsByPlayer: BetsByPlayer = {
      p1: { spades: 1 },
      p2: { hearts: 2 },
    }

    const raceState = {}

    const base: HouseGameState = {
      phase: 'race',
      houseBankroll: 1000,
      startingChips: 100,
      chipsPerDollar: 100,
      racesToPlay: 0,
      racesCompleted: 0,
      bettingOrder: ['p1', 'p2'],
      players: [
        { id: 'p1', name: 'A', chips: 100, boughtChips: 100 },
        { id: 'p2', name: 'B', chips: 100, boughtChips: 100 },
      ],
      course,
      betsByPlayer,
      race: raceState,
      payout: undefined,
    }

    const hist0 = createHistoryState(base)
    const hist1 = historyReducer(hist0, { type: 'CONFIRM_RACE_OUTCOME', winnerSuit: 'spades' })
    expect(hist1.present.phase).toBe('payout')
    expect(hist1.present.payout).toBeDefined()
    expect(hist1.present.race.winnerSuit).toBe('spades')

    const hist2 = historyReducer(hist1, { type: 'UNDO' })
    expect(hist2.present.phase).toBe('race')
    expect(hist2.present.payout).toBeUndefined()
  })

  it('auto-settles when configured race count is reached', () => {
    const course: CourseState = {
      cards: ['diamonds', 'hearts', 'hearts', 'spades', 'spades', 'spades', 'spades'],
      reshuffleNeeded: false,
    }

    const betsByPlayer: BetsByPlayer = {
      p1: {},
      p2: {},
    }

    const base: HouseGameState = {
      phase: 'race',
      houseBankroll: 10,
      startingChips: 100,
      chipsPerDollar: 100,
      racesToPlay: 1,
      racesCompleted: 0,
      bettingOrder: ['p1', 'p2'],
      players: [
        { id: 'p1', name: 'A', chips: 0, boughtChips: 0 },
        { id: 'p2', name: 'B', chips: 0, boughtChips: 0 },
      ],
      course,
      betsByPlayer,
      race: {},
      payout: undefined,
      settlement: undefined,
    }

    const hist0 = createHistoryState(base)
    const hist1 = historyReducer(hist0, { type: 'CONFIRM_RACE_OUTCOME', winnerSuit: 'spades' })
    expect(hist1.present.phase).toBe('settled')
    expect(hist1.present.racesCompleted).toBe(1)
    expect(hist1.present.houseBankroll).toBe(0)
    expect(hist1.present.settlement?.houseNet).toBe(10)
    expect(hist1.present.players.find((p) => p.id === 'p1')?.chips).toBe(5)
    expect(hist1.present.players.find((p) => p.id === 'p2')?.chips).toBe(5)
  })
})

describe('House debt settlement', () => {
  it('settles negative house debt evenly across all players', () => {
    const course: CourseState = {
      cards: ['diamonds', 'hearts', 'hearts', 'spades', 'spades', 'spades', 'spades'],
      reshuffleNeeded: false,
    }

    const betsByPlayer: BetsByPlayer = {
      p1: {},
      p2: {},
      p3: {},
    }

    const base: HouseGameState = {
      phase: 'payout',
      houseBankroll: -5,
      startingChips: 100,
      chipsPerDollar: 100,
      racesToPlay: 0,
      racesCompleted: 0,
      bettingOrder: ['p1', 'p2', 'p3'],
      players: [
        { id: 'p1', name: 'A', chips: 0, boughtChips: 0 },
        { id: 'p2', name: 'B', chips: 0, boughtChips: 0 },
        { id: 'p3', name: 'C', chips: 0, boughtChips: 0 },
      ],
      course,
      betsByPlayer,
      race: {},
      payout: undefined,
      settlement: undefined,
    }

    const hist0 = createHistoryState(base)
    const hist1 = historyReducer(hist0, { type: 'SETTLE_HOUSE_DEBT' })
    expect(hist1.present.phase).toBe('settled')
    expect(hist1.present.houseBankroll).toBe(0)
    expect(hist1.present.settlement?.houseNet).toBe(-5)
    expect(hist1.present.settlement?.shareByPlayer.p1).toBe(2)
    expect(hist1.present.settlement?.shareByPlayer.p2).toBe(2)
    expect(hist1.present.settlement?.shareByPlayer.p3).toBe(1)
    expect(hist1.present.players.find((p) => p.id === 'p1')?.chips).toBe(-2)
    expect(hist1.present.players.find((p) => p.id === 'p2')?.chips).toBe(-2)
    expect(hist1.present.players.find((p) => p.id === 'p3')?.chips).toBe(-1)
  })

  it('splits positive house profit evenly amongst all players', () => {
    const course: CourseState = {
      cards: ['diamonds', 'hearts', 'hearts', 'spades', 'spades', 'spades', 'spades'],
      reshuffleNeeded: false,
    }

    const betsByPlayer: BetsByPlayer = {
      p1: {},
      p2: {},
      p3: {},
    }

    const base: HouseGameState = {
      phase: 'payout',
      houseBankroll: 5,
      startingChips: 100,
      chipsPerDollar: 100,
      racesToPlay: 0,
      racesCompleted: 0,
      bettingOrder: ['p1', 'p2', 'p3'],
      players: [
        { id: 'p1', name: 'A', chips: 0, boughtChips: 0 },
        { id: 'p2', name: 'B', chips: 0, boughtChips: 0 },
        { id: 'p3', name: 'C', chips: 0, boughtChips: 0 },
      ],
      course,
      betsByPlayer,
      race: {},
      payout: undefined,
      settlement: undefined,
    }

    const hist0 = createHistoryState(base)
    const hist1 = historyReducer(hist0, { type: 'SETTLE_HOUSE_DEBT' })
    expect(hist1.present.phase).toBe('settled')
    expect(hist1.present.houseBankroll).toBe(0)
    expect(hist1.present.settlement?.houseNet).toBe(5)
    expect(hist1.present.settlement?.shareByPlayer.p1).toBe(2)
    expect(hist1.present.settlement?.shareByPlayer.p2).toBe(2)
    expect(hist1.present.settlement?.shareByPlayer.p3).toBe(1)
    expect(hist1.present.players.find((p) => p.id === 'p1')?.chips).toBe(2)
    expect(hist1.present.players.find((p) => p.id === 'p2')?.chips).toBe(2)
    expect(hist1.present.players.find((p) => p.id === 'p3')?.chips).toBe(1)
  })
})

