import type { Suit } from '../game/types.ts'
import { SUITS, SUIT_LABEL } from '../game/types.ts'

function formatOddsLabel(k: number): string {
  if (k === 1) return '1-1'
  return `${k}-1`
}

export function BettingForm(props: {
  bets: Partial<Record<Suit, number>>
  oddsBySuit: Record<Suit, number>
  chips: number
  onSetBet: (suit: Suit, amount: number) => void
  onUndo: () => void
  disabled: boolean
}) {
  const totalBet = SUITS.reduce((sum, s) => sum + (props.bets[s] ?? 0), 0)
  const remaining = props.chips - totalBet

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>Available</div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{remaining}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="muted" style={{ fontSize: 12 }}>At risk</div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{totalBet}</div>
        </div>
      </div>

      <div className="player-suit-grid">
        {SUITS.map((s) => {
          const value = props.bets[s] ?? 0
          return (
            <div key={s} className="player-suit-card">
              <div style={{ fontWeight: 700, fontSize: 15 }}>{SUIT_LABEL[s]}</div>
              <div className="muted" style={{ fontSize: 12 }}>{formatOddsLabel(props.oddsBySuit[s])}</div>
              <div className="player-bet-controls">
                <button
                  type="button"
                  className="player-bet-btn"
                  disabled={props.disabled || value <= 0}
                  onClick={() => props.onSetBet(s, Math.max(0, value - 5))}
                >
                  -5
                </button>
                <button
                  type="button"
                  className="player-bet-btn"
                  disabled={props.disabled || value <= 0}
                  onClick={() => props.onSetBet(s, Math.max(0, value - 1))}
                >
                  -1
                </button>
                <div className="player-bet-value">{value}</div>
                <button
                  type="button"
                  className="player-bet-btn"
                  disabled={props.disabled || remaining <= 0}
                  onClick={() => props.onSetBet(s, value + 1)}
                >
                  +1
                </button>
                <button
                  type="button"
                  className="player-bet-btn"
                  disabled={props.disabled || remaining < 5}
                  onClick={() => props.onSetBet(s, value + 5)}
                >
                  +5
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        style={{ marginTop: 12, width: '100%' }}
        disabled={props.disabled}
        onClick={props.onUndo}
      >
        Undo last bet change
      </button>
    </div>
  )
}
