import type { Card, Suit } from '../game/types.ts'
import { PlayingCard } from './PlayingCard.tsx'

const LANE_ORDER: Suit[] = ['spades', 'clubs', 'hearts', 'diamonds']
const TRACK_SLOTS = 8

function AceCard(props: { suit: Suit; size: 'sm' | 'md' }) {
  return <PlayingCard card={{ rank: 'A', suit: props.suit }} size={props.size} />
}

function RaceLane(props: {
  suit: Suit
  drawnCards: Card[]
  isWinner: boolean
  compact?: boolean
  animating?: boolean
}) {
  const cardSize = props.compact ? 'sm' : 'sm'
  const lastIdx = props.drawnCards.length - 1

  // Render 8 slots — filled with drawn cards or empty
  const slots = Array.from({ length: TRACK_SLOTS }, (_, i) =>
    props.drawnCards[i] ?? null,
  )

  return (
    <div className={`race-lane-v2 ${props.isWinner ? 'race-lane-v2-winner' : ''}`}>
      <div className="race-lane-v2-ace">
        <AceCard suit={props.suit} size={cardSize} />
      </div>
      <div className="race-lane-v2-track">
        <div className="race-lane-v2-line" />
        <div className="race-lane-v2-slots">
          {slots.map((card, i) =>
            card ? (
              <div key={`${card.rank}_${card.suit}_${i}`} className="race-lane-v2-slot">
                <PlayingCard
                  card={card}
                  size={cardSize}
                  animate={props.animating && i === lastIdx}
                />
              </div>
            ) : (
              <div key={`empty_${i}`} className="race-lane-v2-slot" />
            ),
          )}
        </div>
      </div>
    </div>
  )
}

export function RaceBoard(props: {
  courseCards?: Card[]
  drawnBySuit: Record<Suit, Card[]>
  winnerSuit?: Suit
  compact?: boolean
  animating?: boolean
}) {
  return (
    <div className={`race-board-v2 ${props.compact ? 'race-board-v2-compact' : ''}`}>
      {props.courseCards && props.courseCards.length > 0 && (
        <div className="race-board-v2-course">
          {props.courseCards.map((card, i) => (
            <PlayingCard key={`${card.rank}_${card.suit}_${i}`} card={card} size={props.compact ? 'sm' : 'sm'} />
          ))}
        </div>
      )}

      <div className="race-board-v2-arena">
        <div className="race-board-v2-lanes">
          {LANE_ORDER.map((s) => (
            <RaceLane
              key={s}
              suit={s}
              drawnCards={props.drawnBySuit[s]}
              isWinner={s === props.winnerSuit}
              compact={props.compact}
              animating={props.animating}
            />
          ))}
        </div>
        <div className="race-board-v2-finish">
          <div className="race-board-v2-finish-line" />
          <div className="race-board-v2-finish-label">FINISH</div>
        </div>
      </div>
    </div>
  )
}
