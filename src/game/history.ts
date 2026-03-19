import type { HouseGameState } from './types'
import { gameReducer, type GameAction } from './reducer'

export type HistoryState = {
  past: HouseGameState[]
  present: HouseGameState
  future: HouseGameState[]
}

export type HistoryAction =
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | GameAction

export function createHistoryState(initial: HouseGameState): HistoryState {
  return { past: [], present: initial, future: [] }
}

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      const newPast = state.past.slice(0, -1)
      return { past: newPast, present: previous, future: [state.present, ...state.future] }
    }

    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      const newFuture = state.future.slice(1)
      return { past: [...state.past, state.present], present: next, future: newFuture }
    }

    default: {
      const nextPresent = gameReducer(state.present, action)
      // If nothing changed, don't grow history.
      if (nextPresent === state.present) return state
      return { past: [...state.past, state.present], present: nextPresent, future: [] }
    }
  }
}

