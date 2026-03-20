import { useEffect, useState } from 'react'
import { useSocket } from '../shared/useSocket.ts'
import { EVENTS } from '../shared/protocol.ts'
import type { PlayerView } from '../shared/protocol.ts'
import { SUITS, SUIT_LABEL } from '../game/types.ts'
import type { Suit } from '../game/types.ts'
import { BettingForm } from './BettingForm.tsx'

function getSessionId(): string {
  const KEY = 'hrh-session-id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    // crypto.randomUUID() requires a secure context (HTTPS).
    // LAN connections use plain HTTP, so fall back to Math.random.
    const hex = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0')
    id = `${hex()}-${hex()}-${hex()}-${hex()}`
    localStorage.setItem(KEY, id)
  }
  return id
}

function formatOddsLabel(k: number): string {
  if (k === 1) return '1-1'
  return `${k}-1`
}

export function PlayerApp() {
  const { socket, connected, error } = useSocket()
  const [playerName, setPlayerName] = useState('')
  const [joined, setJoined] = useState(false)
  const [view, setView] = useState<PlayerView | null>(null)
  const [topUpAmount, setTopUpAmount] = useState(0)
  const [showTopUp, setShowTopUp] = useState(false)

  useEffect(() => {
    if (!socket) return
    const handler = (v: PlayerView) => {
      setView(v)
      setJoined(true)
    }
    socket.on(EVENTS.STATE_PLAYER, handler)
    return () => { socket.off(EVENTS.STATE_PLAYER, handler) }
  }, [socket])

  // Auto-rejoin on reconnect if we have a session
  useEffect(() => {
    if (!socket || !connected) return
    const sessionId = getSessionId()
    const savedName = localStorage.getItem('hrh-player-name')
    if (savedName) {
      socket.emit(EVENTS.PLAYER_JOIN, { name: savedName, sessionId })
    }
  }, [socket, connected])

  function handleJoin() {
    if (!socket || !playerName.trim()) return
    const name = playerName.trim()
    localStorage.setItem('hrh-player-name', name)
    socket.emit(EVENTS.PLAYER_JOIN, { name, sessionId: getSessionId() })
  }

  function handleSetBet(suit: Suit, amount: number) {
    socket?.emit(EVENTS.PLAYER_ACTION, { action: { type: 'SET_BET', suit, amount } })
  }

  function handleUndo() {
    socket?.emit(EVENTS.PLAYER_UNDO)
  }

  function handleTopUp() {
    if (topUpAmount <= 0) return
    socket?.emit(EVENTS.PLAYER_ACTION, { action: { type: 'TOPUP_CHIPS', amount: topUpAmount } })
    setTopUpAmount(0)
    setShowTopUp(false)
  }

  if (!connected) {
    return (
      <div className="player-app">
        <div className="player-card" style={{ textAlign: 'center' }}>
          <div className="muted">{error ? `Connection error: ${error}` : 'Connecting...'}</div>
        </div>
      </div>
    )
  }

  if (!joined || !view) {
    return (
      <div className="player-app">
        <div className="player-card">
          <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>Horse Race House</h1>
          <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>Enter your name to join the game</div>
          <input
            className="input"
            style={{ width: '100%', fontSize: 18, padding: 14 }}
            placeholder="Your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            autoFocus
          />
          <button
            type="button"
            className="accent"
            style={{ width: '100%', marginTop: 12, padding: 14, fontSize: 16 }}
            onClick={handleJoin}
            disabled={!playerName.trim()}
          >
            Join Game
          </button>
        </div>
      </div>
    )
  }

  const totalBet = SUITS.reduce((sum, s) => sum + (view.bets[s] ?? 0), 0)

  return (
    <div className="player-app">
      {/* Header */}
      <div className="player-header">
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{view.playerName}</div>
          <div className="muted" style={{ fontSize: 12 }}>{view.phase.toUpperCase()}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, fontSize: 22 }}>{view.chips}</div>
          <div className="muted" style={{ fontSize: 12 }}>chips</div>
        </div>
      </div>

      {/* Waiting phases */}
      {(view.phase === 'setup' || view.phase === 'course') && (
        <div className="player-card">
          <div className="muted" style={{ textAlign: 'center', padding: 20 }}>
            Waiting for the dealer...
          </div>
          {view.courseCards.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Course odds:</div>
              <div className="player-suit-grid">
                {SUITS.map((s) => (
                  <div key={s} className="player-suit-card" style={{ padding: 10, textAlign: 'center' }}>
                    <div style={{ fontWeight: 700 }}>{SUIT_LABEL[s]}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{formatOddsLabel(view.oddsBySuit[s])}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Betting phase */}
      {view.phase === 'betting' && (
        <div className="player-card">
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Place your bets</h2>
          <BettingForm
            bets={view.bets}
            oddsBySuit={view.oddsBySuit}
            chips={view.chips}
            onSetBet={handleSetBet}
            onUndo={handleUndo}
            disabled={false}
          />
        </div>
      )}

      {/* Race phase */}
      {view.phase === 'race' && (
        <div className="player-card">
          <div className="muted" style={{ textAlign: 'center', padding: 20 }}>
            Waiting for the dealer to pick the winner...
          </div>
          <div style={{ marginTop: 8 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Your bets (locked):</div>
            {SUITS.filter((s) => (view.bets[s] ?? 0) > 0).map((s) => (
              <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>{SUIT_LABEL[s]} ({formatOddsLabel(view.oddsBySuit[s])})</span>
                <span style={{ fontWeight: 800 }}>{view.bets[s]}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
              <span style={{ fontWeight: 700 }}>Total at risk</span>
              <span style={{ fontWeight: 800 }}>{totalBet}</span>
            </div>
          </div>
        </div>
      )}

      {/* Payout phase */}
      {view.phase === 'payout' && view.raceResult && (
        <div className="player-card">
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Race Result</h2>
          <div style={{ textAlign: 'center', padding: 16 }}>
            <div className="muted" style={{ fontSize: 13 }}>Winner</div>
            <div style={{ fontWeight: 800, fontSize: 24, marginTop: 4 }}>
              {SUIT_LABEL[view.raceResult.winnerSuit]}
            </div>
            <div style={{ marginTop: 16 }}>
              <div className="muted" style={{ fontSize: 13 }}>Your result</div>
              <div
                style={{ fontWeight: 800, fontSize: 28, marginTop: 4 }}
                className={view.raceResult.myDelta > 0 ? 'good' : view.raceResult.myDelta < 0 ? 'danger' : 'muted'}
              >
                {view.raceResult.myDelta >= 0 ? `+${view.raceResult.myDelta}` : view.raceResult.myDelta}
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div className="muted" style={{ fontSize: 13 }}>New balance</div>
              <div style={{ fontWeight: 800, fontSize: 22, marginTop: 4 }}>{view.raceResult.myNewChips} chips</div>
            </div>
          </div>
        </div>
      )}

      {/* Settlement phase */}
      {view.phase === 'settled' && view.settlement && (
        <div className="player-card">
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Settlement</h2>
          <div style={{ textAlign: 'center', padding: 16 }}>
            <div className="muted" style={{ fontSize: 13 }}>Final chips</div>
            <div style={{ fontWeight: 800, fontSize: 24, marginTop: 4 }}>{view.settlement.myFinalChips}</div>
            <div style={{ marginTop: 16 }}>
              <div className="muted" style={{ fontSize: 13 }}>Net result</div>
              <div
                style={{ fontWeight: 800, fontSize: 28, marginTop: 4 }}
                className={view.settlement.myNet > 0 ? 'good' : view.settlement.myNet < 0 ? 'danger' : 'muted'}
              >
                {view.settlement.myNet >= 0 ? `+${(view.settlement.myNet / view.chipsPerDollar).toFixed(2)}$` : `-${(Math.abs(view.settlement.myNet) / view.chipsPerDollar).toFixed(2)}$`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Players list */}
      <div className="player-card" style={{ marginTop: 12 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Players in game:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {view.allPlayerNames.map((name) => (
            <span key={name} style={{ fontSize: 13, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border)', fontWeight: name === view.playerName ? 800 : 400 }}>
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Top-up floating button */}
      {view.phase !== 'settled' && (
        <>
          <button
            type="button"
            className="accent player-topup-fab"
            onClick={() => setShowTopUp(!showTopUp)}
          >
            + Top up
          </button>

          {showTopUp && (
            <div className="player-card" style={{ marginTop: 12 }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 15 }}>Top up chips</h2>
              <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                {view.chipsPerDollar} chips = $1 | Bought so far: {view.boughtChips}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  type="number"
                  min={1}
                  step={1}
                  value={topUpAmount || ''}
                  onChange={(e) => setTopUpAmount(Number(e.target.value))}
                  style={{ flex: 1, fontSize: 16, padding: 14 }}
                  placeholder="Amount"
                />
                <button type="button" className="accent" style={{ padding: '14px 20px', fontSize: 16 }} onClick={handleTopUp} disabled={topUpAmount <= 0}>
                  Add
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
