import type { HouseGameState, PlayerId } from '../src/game/types.ts'
import { profitMultiplierBySuit } from '../src/game/engine.ts'
import type { PlayerView } from '../src/shared/protocol.ts'

export function projectPlayerView(state: HouseGameState, playerId: PlayerId): PlayerView {
  const player = state.players.find((p) => p.id === playerId)
  if (!player) throw new Error(`Player ${playerId} not found`)

  const oddsBySuit = profitMultiplierBySuit(state.course)
  const bets = state.betsByPlayer[playerId] ?? {}

  let raceResult: PlayerView['raceResult'] = null
  if ((state.phase === 'payout' || state.phase === 'settled') && state.payout) {
    raceResult = {
      winnerSuit: state.payout.winnerSuit,
      myDelta: state.payout.playerChipDeltas[playerId] ?? 0,
      myNewChips: player.chips,
    }
  }

  let settlement: PlayerView['settlement'] = null
  if (state.phase === 'settled' && state.settlement) {
    const houseNet = state.settlement.houseNet
    const myShare = state.settlement.shareByPlayer[playerId] ?? 0
    settlement = {
      houseNet,
      myShare,
      myFinalChips: player.chips,
      myNet: player.chips - player.boughtChips,
    }
  }

  return {
    phase: state.phase,
    playerId,
    playerName: player.name,
    chips: player.chips,
    boughtChips: player.boughtChips,
    bets,
    oddsBySuit,
    courseCards: state.course.cards,
    allPlayerNames: state.players.map((p) => p.name),
    raceResult,
    settlement,
    canBet: state.phase === 'betting',
    chipsPerDollar: state.chipsPerDollar,
    racesCompleted: state.racesCompleted,
    racesToPlay: state.racesToPlay,
  }
}
