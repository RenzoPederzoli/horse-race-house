import { useEffect, useMemo, useReducer, useState } from 'react'
import type { HouseGameState, Suit } from './game/types'
import { createInitialGameState } from './game/reducer'
import type { GameAction } from './game/reducer'
import { historyReducer, createHistoryState } from './game/history'
import {
  isBetAmountValid,
  profitMultiplierBySuit,
  validateCourseForConfirm,
} from './game/engine'
import { SUITS, SUIT_LABEL } from './game/types'

function formatOddsLabel(k: number): string {
  if (k === 1) return '1-1'
  return `${k}-1`
}

function totalBets(bets: Partial<Record<Suit, number>> | undefined): number {
  return SUITS.reduce((sum, s) => sum + (bets?.[s] ?? 0), 0)
}

function chipsToDollars(chips: number, chipsPerDollar: number): number {
  return chips / chipsPerDollar
}

function formatDollars(chips: number, chipsPerDollar: number): string {
  const dollars = chipsToDollars(chips, chipsPerDollar)
  // Display cents to make small buy-ins readable.
  return `${dollars.toFixed(2)}$`
}

function TrackLane(props: { suit: Suit; position: number; isWinner: boolean }) {
  const leftPct = Math.max(0, Math.min(100, (props.position / 8) * 100))
  return (
    <div className="lane">
      <div className="laneHeader">
        <div>
          <div style={{ fontWeight: 600 }}>{SUIT_LABEL[props.suit]}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Position: {props.position}/8
          </div>
        </div>
        {props.isWinner ? <div className="good">Winner</div> : <div className="muted"> </div>}
      </div>
      <div className="laneBar" aria-label={`${SUIT_LABEL[props.suit]} position`}>
        <div
          className={props.isWinner ? 'laneMarker laneMarkerWinner' : 'laneMarker'}
          style={{ left: `${leftPct}%` }}
        />
      </div>
    </div>
  )
}

function suitButtons(props: {
  disabled?: boolean
  activeSuit?: Suit | undefined
  onPick: (suit: Suit) => void
}) {
  return (
    <div className="suitRow">
      {SUITS.map((s) => {
        const active = props.activeSuit === s
        return (
          <button
            key={s}
            className={`suitBtn ${active ? 'suitBtnActive' : ''}`}
            type="button"
            disabled={props.disabled}
            onClick={() => props.onPick(s)}
          >
            <div style={{ fontWeight: 700 }}>{SUIT_LABEL[s]}</div>
          </button>
        )
      })}
    </div>
  )
}

export function App() {
  const initial: HouseGameState = useMemo(() => {
    const startingChips = 100
    const houseBankroll = 0
    const chipsPerDollar = 10
    const racesToPlay = 0

    return createInitialGameState({
      startingChips,
      houseBankroll,
      chipsPerDollar,
      racesToPlay,
      players: [
        { id: 'p1', name: 'Player 1', chips: startingChips },
        { id: 'p2', name: 'Player 2', chips: startingChips },
        { id: 'p3', name: 'Player 3', chips: startingChips },
      ],
    })
  }, [])

  const [history, dispatch] = useReducer(historyReducer, createHistoryState(initial))
  const state = history.present

  const [uiError, setUiError] = useState<string | null>(null)
  const [selectedWinnerSuit, setSelectedWinnerSuit] = useState<Suit | undefined>(undefined)
  const [topUpAmounts, setTopUpAmounts] = useState<Record<string, number>>({})

  useEffect(() => {
    // If we re-enter the race phase (including undo), clear any in-progress selection.
    setSelectedWinnerSuit(undefined)
    setUiError(null)
  }, [state.phase])

  const oddsBySuit = useMemo(() => profitMultiplierBySuit(state.course), [state.course])

  const canConfirmCourse = useMemo(() => {
    if (state.phase !== 'course') return false
    const validation = validateCourseForConfirm(state.course)
    return validation.ok
  }, [state.phase, state.course])

  const canConfirmBets = useMemo(() => {
    if (state.phase !== 'betting') return false
    // Quick client-side validation for button enablement.
    for (const p of state.players) {
      const bets = state.betsByPlayer[p.id] ?? {}
      const total = totalBets(bets)
      if (total > p.chips) return false
      for (const s of SUITS) {
        const amt = bets[s] ?? 0
        if (!Number.isInteger(amt) || amt < 0) return false
      }
    }
    return true
  }, [state])

  const canConfirmRaceOutcome = useMemo(() => state.phase === 'race' && !!selectedWinnerSuit, [state.phase, selectedWinnerSuit])

  const currentHint = useMemo(() => {
    switch (state.phase) {
      case 'setup':
        return 'Set players and house bankroll, then start a new race.'
      case 'course':
        return state.course.reshuffleNeeded ? 'A suit appeared 5+ times. Reshuffle the course.' : 'Tap 7 course cards (suits). Odds update automatically.'
      case 'betting':
        return 'Place bets on any suits you choose. Then confirm bets.'
      case 'race':
        return 'Select which suit won the race, then confirm outcome.'
      case 'payout':
        return 'Payout is computed. Start the next race or fully reset.'
      case 'settled':
        return 'Settlement done. Use Full Reset to start a new session.'
    }
  }, [state.phase, state.course.reshuffleNeeded])

  function doAction(action: GameAction) {
    setUiError(null)
    dispatch(action)
  }

  function undo() {
    dispatch({ type: 'UNDO' })
  }

  function fullReset() {
    doAction({ type: 'FULL_RESET_TO_SETUP' })
  }

  return (
    <div>
      <div className="topbar">
        <div className="title">
          <h1>Horse Race House & Chip Tracker</h1>
          <div className="sub">{currentHint}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="phase-badge">
            Phase: <span style={{ color: 'var(--text)' }}>{state.phase}</span>
          </div>
          <button type="button" onClick={undo} disabled={history.past.length === 0}>
            Undo
          </button>
        </div>
      </div>

      {uiError ? (
        <div className="panel" style={{ marginTop: 14, borderColor: 'rgba(255, 92, 122, 0.65)' }}>
          <div style={{ color: 'var(--bad)', fontWeight: 700 }}>Input not accepted</div>
          <div className="muted" style={{ marginTop: 6 }}>
            {uiError}
          </div>
        </div>
      ) : null}

      <div className="grid">
        <div className="panel">
          {state.phase === 'setup' ? (
            <>
              <h2>Players</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Chips</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {state.players.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <input
                          className="input"
                          style={{ width: 180 }}
                          value={p.name}
                          onChange={(e) => doAction({ type: 'UPDATE_PLAYER_NAME', playerId: p.id, name: e.target.value })}
                        />
                      </td>
                      <td>{p.chips}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="danger"
                          disabled={state.players.length <= 3}
                          onClick={() => doAction({ type: 'REMOVE_PLAYER', playerId: p.id })}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="row" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="accent"
                  disabled={state.players.length >= 4}
                  onClick={() => doAction({ type: 'ADD_PLAYER', name: `Player ${state.players.length + 1}` })}
                >
                  Add Player
                </button>
                <div className="spacer" />
                <div className="muted" style={{ fontSize: 12 }}>
                  Allowed players: 3–4
                </div>
              </div>

              <h2 style={{ marginTop: 18 }}>House</h2>
              <div className="row">
                <label className="muted" style={{ fontSize: 13 }}>
                  Starting chips:
                  <input
                    className="input"
                    type="number"
                    value={state.startingChips}
                    onChange={(e) =>
                      doAction({
                        type: 'SET_SETTINGS',
                        startingChips: Number(e.target.value),
                        houseBankroll: state.houseBankroll,
                        chipsPerDollar: state.chipsPerDollar,
                        racesToPlay: state.racesToPlay,
                      })
                    }
                    min={0}
                    step={1}
                  />
                </label>
                <label className="muted" style={{ fontSize: 13 }}>
                  House bankroll:
                  <input
                    className="input"
                    type="number"
                    value={state.houseBankroll}
                    onChange={(e) =>
                      doAction({
                        type: 'SET_SETTINGS',
                        startingChips: state.startingChips,
                        houseBankroll: Number(e.target.value),
                        chipsPerDollar: state.chipsPerDollar,
                        racesToPlay: state.racesToPlay,
                      })
                    }
                    min={0}
                    step={1}
                  />
                </label>
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                <label className="muted" style={{ fontSize: 13 }}>
                  Chips per $1:
                  <input
                    className="input"
                    type="number"
                    value={state.chipsPerDollar}
                    onChange={(e) =>
                      doAction({
                        type: 'SET_SETTINGS',
                        startingChips: state.startingChips,
                        houseBankroll: state.houseBankroll,
                        chipsPerDollar: Number(e.target.value),
                        racesToPlay: state.racesToPlay,
                      })
                    }
                    min={1}
                    step={1}
                  />
                </label>
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                <label className="muted" style={{ fontSize: 13 }}>
                  Races to play (0 = unlimited):
                  <input
                    className="input"
                    type="number"
                    value={state.racesToPlay}
                    onChange={(e) =>
                      doAction({
                        type: 'SET_SETTINGS',
                        startingChips: state.startingChips,
                        houseBankroll: state.houseBankroll,
                        chipsPerDollar: state.chipsPerDollar,
                        racesToPlay: Number(e.target.value),
                      })
                    }
                    min={0}
                    step={1}
                  />
                </label>
              </div>

              <div className="row" style={{ marginTop: 16 }}>
                <button type="button" className="accent" onClick={() => doAction({ type: 'START_NEW_GAME' })} disabled={state.players.length < 3}>
                  Start New Race
                </button>
              </div>
            </>
          ) : null}

          {state.phase === 'course' ? (
            <>
              <h2>Course (top row)</h2>
              <div className="suitRow">
                {SUITS.map((s) => {
                  const count = state.course.cards.filter((x) => x === s).length
                  return (
                    <div key={s} className="lane" style={{ padding: 12 }}>
                      <div style={{ fontWeight: 700 }}>{SUIT_LABEL[s]}</div>
                      <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                        Count: {count}
                      </div>
                      <button
                        type="button"
                        style={{ width: '100%', marginTop: 10 }}
                        disabled={state.course.reshuffleNeeded || state.course.cards.length >= 7}
                        onClick={() => doAction({ type: 'ADD_COURSE_CARD', suit: s })}
                      >
                        Add
                      </button>
                    </div>
                  )
                })}
              </div>

              <div className="footnote">
                {state.course.reshuffleNeeded ? (
                  <span style={{ color: 'var(--bad)', fontWeight: 700 }}>Invalid course: a suit reached 5+ cards.</span>
                ) : (
                  <span>
                    Deal exactly 7 course cards. If any suit appears 5+ times, you must reshuffle.
                  </span>
                )}
              </div>

              <div className="courseCards" aria-label="Course cards">
                {state.course.cards.map((s, i) => (
                  <span className="cardPill" key={`${s}_${i}`}>
                    {SUIT_LABEL[s]}
                  </span>
                ))}
              </div>

              <div className="row" style={{ marginTop: 14 }}>
                <div className="spacer" />
                {state.course.reshuffleNeeded ? (
                  <button type="button" className="danger" onClick={() => doAction({ type: 'RESHuffle_COURSE' })}>
                    Reshuffle Course
                  </button>
                ) : (
                  <button type="button" className="accent" disabled={!canConfirmCourse} onClick={() => doAction({ type: 'CONFIRM_COURSE' })}>
                    Confirm Course & Set Odds
                  </button>
                )}
              </div>
            </>
          ) : null}

          {state.phase === 'betting' ? (
            <>
              <h2>Betting</h2>
              <div className="row" style={{ marginBottom: 12 }}>
                <div className="muted" style={{ fontSize: 13 }}>
                  Odds from course:
                </div>
                <div className="spacer" />
                <div className="muted" style={{ fontSize: 13 }}>
                  Bets must be less than or equal to each player's chips.
                </div>
              </div>

              <table className="table">
                <thead>
                  <tr>
                    <th>Player</th>
                    {SUITS.map((s) => (
                      <th key={s}>
                        {SUIT_LABEL[s]} ({formatOddsLabel(oddsBySuit[s])})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.bettingOrder
                    .map((id) => state.players.find((p) => p.id === id))
                    .filter((p): p is NonNullable<typeof p> => !!p)
                    .map((p) => {
                    const bets = state.betsByPlayer[p.id] ?? {}
                    const atRisk = totalBets(bets)
                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{p.name}</div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                            Chips: {p.chips} • At risk: {atRisk}
                          </div>
                        </td>
                        {SUITS.map((s) => {
                          const value = bets[s] ?? 0
                          return (
                            <td key={s}>
                              <input
                                className="input"
                                type="number"
                                min={0}
                                step={1}
                                value={value}
                                onChange={(e) => {
                                  const amount = Number(e.target.value)
                                  const betsForPlayer = bets
                                  const valid = isBetAmountValid(p.chips, betsForPlayer, amount, s)
                                  if (!valid.ok) {
                                    setUiError(valid.reason)
                                    return
                                  }
                                  setUiError(null)
                                  doAction({ type: 'SET_BET', playerId: p.id, suit: s, amount })
                                }}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="row" style={{ marginTop: 14 }}>
                <div className="spacer" />
                <button type="button" className="accent" disabled={!canConfirmBets} onClick={() => doAction({ type: 'CONFIRM_BETS' })}>
                  Confirm Bets
                </button>
              </div>
            </>
          ) : null}

          {state.phase === 'race' ? (
            <>
              <h2>Race Outcome</h2>
              <div className="muted" style={{ marginBottom: 10 }}>
                Instead of entering every dealt card, pick the winning horse/suit.
              </div>

              {suitButtons({
                disabled: false,
                activeSuit: selectedWinnerSuit,
                onPick: (s) => {
                  setSelectedWinnerSuit(s)
                },
              })}

              <div style={{ marginTop: 16 }}>
                <h2 style={{ margin: 0, fontSize: 15 }}>Bet preview (locked in)</h2>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  Bets by player are shown here while the dealer selects the winner.
                </div>

                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {state.players.map((p) => {
                    const bets = state.betsByPlayer[p.id] ?? {}
                    const items = SUITS.filter((s) => (bets[s] ?? 0) > 0).map((s) => `${SUIT_LABEL[s]}: ${bets[s] ?? 0}`)
                    const total = totalBets(bets)
                    return (
                      <div
                        key={p.id}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: 12,
                          padding: 10,
                          background: 'rgba(255, 255, 255, 0.03)',
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>{p.name}</div>
                        {items.length ? (
                          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                            {items.join(', ')}
                          </div>
                        ) : (
                          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                            No bets
                          </div>
                        )}
                        <div style={{ fontWeight: 800, marginTop: 6 }}>
                          Total: {total}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="row" style={{ marginTop: 14 }}>
                <div className="spacer" />
                <button type="button" className="accent" disabled={!canConfirmRaceOutcome} onClick={() => doAction({ type: 'CONFIRM_RACE_OUTCOME', winnerSuit: selectedWinnerSuit! })}>
                  Confirm Outcome
                </button>
              </div>

              <div className="footnote">
                After confirmation, the track will show the winner at the finish.
              </div>
            </>
          ) : null}

          {state.phase === 'payout' && state.payout ? (
            <>
              <h2>Payout</h2>
              <div className="row" style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 800 }}>
                  Winner: {SUIT_LABEL[state.payout.winnerSuit]} ({formatOddsLabel(state.payout.profitMultiplierK)})
                </div>
                <div className="spacer" />
                <div className="muted" style={{ fontSize: 13 }}>
                  House bankroll: {state.houseBankroll}
                </div>
              </div>

              <table className="table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Delta</th>
                    <th>New chips</th>
                  </tr>
                </thead>
                <tbody>
                  {state.players.map((p) => {
                    const delta = state.payout!.playerChipDeltas[p.id] ?? 0
                    const deltaClass = delta > 0 ? 'good' : delta < 0 ? 'danger' : 'muted'
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700 }}>{p.name}</td>
                        <td className={deltaClass} style={{ fontWeight: 800 }}>
                          {delta >= 0 ? `+${delta}` : delta}
                        </td>
                        <td style={{ fontWeight: 800 }}>{p.chips}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="row" style={{ marginTop: 14 }}>
                <div className="spacer" />
                <button type="button" className="accent" onClick={() => doAction({ type: 'NEW_RACE' })}>
                  New Race
                </button>
                <button type="button" className="danger" onClick={fullReset}>
                  Full Reset
                </button>
              </div>

              <div style={{ marginTop: 14 }}>
                <h2 style={{ margin: '0 0 10px', fontSize: 15 }}>Track (finish state)</h2>
                <div className="suitRow">
                  {SUITS.map((s) => (
                    <TrackLane
                      key={s}
                      suit={s}
                      position={state.race.finalPositions?.[s] ?? 0}
                      isWinner={s === state.race.winnerSuit}
                    />
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <h2 style={{ margin: 0, fontSize: 15 }}>Bet preview (payout)</h2>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  Bets by player for this race.
                </div>

                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {state.players.map((p) => {
                    const bets = state.betsByPlayer[p.id] ?? {}
                    const items = SUITS.filter((s) => (bets[s] ?? 0) > 0).map((s) => `${SUIT_LABEL[s]}: ${bets[s] ?? 0}`)
                    const total = totalBets(bets)
                    return (
                      <div
                        key={p.id}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: 12,
                          padding: 10,
                          background: 'rgba(255, 255, 255, 0.03)',
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>{p.name}</div>
                        {items.length ? (
                          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                            {items.join(', ')}
                          </div>
                        ) : (
                          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                            No bets
                          </div>
                        )}
                        <div style={{ fontWeight: 800, marginTop: 6 }}>
                          Total: {total}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : null}

          {state.phase === 'settled' ? (
            <>
              <h2>Settlement</h2>
              <div className="muted" style={{ marginBottom: 12 }}>
                {state.settlement?.houseNet ? (
                  state.settlement.houseNet > 0 ? (
                    <>
                      House profit split evenly across players: {state.settlement.houseNet} chips ({formatDollars(state.settlement.houseNet, state.chipsPerDollar)}).
                    </>
                  ) : (
                    <>
                      House debt settled by evenly collecting {Math.abs(state.settlement.houseNet)} chips ({formatDollars(Math.abs(state.settlement.houseNet), state.chipsPerDollar)}) from all players.
                    </>
                  )
                ) : (
                  <>No settlement needed.</>
                )}
              </div>

              <table className="table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Delta ($)</th>
                    <th>Chips after</th>
                    <th>Net ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {state.players.map((p) => {
                    const share = state.settlement?.shareByPlayer?.[p.id] ?? 0
                    const houseNet = state.settlement?.houseNet ?? 0
                    const delta = houseNet >= 0 ? share : -share
                    const net = p.chips - p.boughtChips
                    const deltaClass = delta > 0 ? 'good' : delta < 0 ? 'danger' : 'muted'
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700 }}>{p.name}</td>
                        <td className={deltaClass} style={{ fontWeight: 800 }}>
                          {delta >= 0 ? `+${formatDollars(delta, state.chipsPerDollar)}` : `-${formatDollars(-delta, state.chipsPerDollar)}`}
                        </td>
                        <td style={{ fontWeight: 800 }}>
                          {p.chips} ({formatDollars(p.chips, state.chipsPerDollar)})
                        </td>
                        <td style={{ fontWeight: 800 }}>
                          {net >= 0 ? `+${formatDollars(net, state.chipsPerDollar)}` : `-${formatDollars(-net, state.chipsPerDollar)}`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="row" style={{ marginTop: 14 }}>
                <div className="spacer" />
                <button type="button" className="danger" onClick={fullReset}>
                  Full Reset
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="panel">
          <h2>At a glance</h2>
          <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            House bankroll and current context.
          </div>

          <div className="row">
            <div className="muted">House</div>
            <div style={{ fontWeight: 800 }}>{state.houseBankroll}</div>
          </div>

          <div style={{ height: 10 }} />

          <div className="row">
            <div className="muted">Players</div>
            <div style={{ fontWeight: 800 }}>{state.players.length}</div>
          </div>

          <div style={{ height: 16 }} />

          {state.racesToPlay > 0 ? (
            <div className="row">
              <div className="muted">Races</div>
              <div style={{ fontWeight: 800 }}>
                {state.racesCompleted}/{state.racesToPlay}
              </div>
            </div>
          ) : null}

          {state.racesToPlay > 0 ? <div style={{ height: 16 }} /> : null}

          {state.phase === 'course' ? (
            <>
              <div className="muted" style={{ marginBottom: 8, fontSize: 13 }}>
                Odds preview once confirmed:
              </div>
              <div className="suitRow">
                {SUITS.map((s) => (
                  <div key={s} className="lane" style={{ padding: 12 }}>
                    <div style={{ fontWeight: 800 }}>{SUIT_LABEL[s]}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      If count stays at {state.course.cards.filter((x) => x === s).length}: {formatOddsLabel(oddsBySuit[s])}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {state.phase !== 'settled' ? (
            <>
              <div style={{ height: 14 }} />
              <h2 style={{ marginTop: 0, fontSize: 16 }}>Top up chips (real money tracking)</h2>
              <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                Conversion: {state.chipsPerDollar} chips = $1. “Bought chips” tracks your investment.
              </div>

              <table className="table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Chips</th>
                    <th>Bought</th>
                    <th>Bought ($)</th>
                    <th>Top up</th>
                  </tr>
                </thead>
                <tbody>
                  {state.players.map((p) => {
                    const amount = topUpAmounts[p.id] ?? 0
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700 }}>{p.name}</td>
                        <td style={{ fontWeight: 800 }}>{p.chips}</td>
                        <td style={{ fontWeight: 800 }}>{p.boughtChips}</td>
                        <td style={{ fontWeight: 800 }}>{formatDollars(p.boughtChips, state.chipsPerDollar)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              className="input"
                              type="number"
                              min={0}
                              step={1}
                              value={Number.isFinite(amount) ? amount : 0}
                              onChange={(e) => {
                                const v = Number(e.target.value)
                                setTopUpAmounts((prev) => ({ ...prev, [p.id]: v }))
                              }}
                              style={{ width: 96 }}
                            />
                            <button
                              type="button"
                              className="accent"
                              onClick={() => {
                                const v = topUpAmounts[p.id] ?? 0
                                if (v <= 0 || !Number.isFinite(v)) return
                                doAction({ type: 'TOPUP_CHIPS', playerId: p.id, amount: v })
                                setTopUpAmounts((prev) => ({ ...prev, [p.id]: 0 }))
                              }}
                            >
                              Top up {Math.max(0, Math.floor(amount))} chips
                            </button>
                          </div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                            Will add: {Math.max(0, Math.floor(amount))} chips
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div style={{ height: 12 }} />
              <button type="button" className="accent" onClick={() => doAction({ type: 'SETTLE_HOUSE_DEBT' })}>
                End & Settle house debt
              </button>
            </>
          ) : null}

          <div className="footnote">
            Undo rolls back the last committed step (course card, bet edits, race outcome).
          </div>
        </div>
      </div>
    </div>
  )
}

