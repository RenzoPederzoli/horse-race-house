import { useEffect, useRef } from 'react'
import type { Card } from '../game/types.ts'

const SUIT_SYMBOL: Record<string, string> = {
  clubs: '\u2663',
  diamonds: '\u2666',
  hearts: '\u2665',
  spades: '\u2660',
}

const SUIT_COLOR: Record<string, string> = {
  clubs: '#1a1a2e',
  diamonds: '#c0392b',
  hearts: '#c0392b',
  spades: '#1a1a2e',
}

const SIZE_MAP = {
  sm: { fontSize: 11, centerSize: 18 },
  md: { fontSize: 13, centerSize: 26 },
  lg: { fontSize: 16, centerSize: 34 },
}

const SIZE_CLASS: Record<string, string> = {
  sm: 'playing-card-sm',
  md: 'playing-card-md',
  lg: 'playing-card-lg',
}

export function PlayingCard(props: { card: Card; size?: 'sm' | 'md' | 'lg'; animate?: boolean }) {
  const size = props.size ?? 'md'
  const { fontSize, centerSize } = SIZE_MAP[size]
  const color = SUIT_COLOR[props.card.suit]
  const symbol = SUIT_SYMBOL[props.card.suit]
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!props.animate || !ref.current) return
    // Force reflow then add the animation class
    const el = ref.current
    el.classList.remove('playing-card-enter')
    // Force reflow so re-adding the class restarts the animation
    void el.offsetWidth
    el.classList.add('playing-card-enter')
  }, [props.animate, props.card.rank, props.card.suit])

  return (
    <div
      ref={ref}
      className={`playing-card ${SIZE_CLASS[size]} ${props.animate ? 'playing-card-enter' : ''}`}
      style={{ color, fontSize }}
    >
      <div className="playing-card-corner playing-card-top">
        <div>{props.card.rank}</div>
        <div>{symbol}</div>
      </div>
      <div className="playing-card-center" style={{ fontSize: centerSize }}>
        {symbol}
      </div>
      <div className="playing-card-corner playing-card-bottom">
        <div>{props.card.rank}</div>
        <div>{symbol}</div>
      </div>
    </div>
  )
}
