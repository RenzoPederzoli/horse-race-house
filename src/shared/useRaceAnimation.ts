import { useEffect, useRef, useState, useCallback } from 'react'
import type { Card, Suit } from '../game/types.ts'

const INITIAL_POSITIONS: Record<Suit, number> = { clubs: 0, diamonds: 0, hearts: 0, spades: 0 }

// --- Audio ---
let cardSoundBuffer: AudioBuffer | null = null
let audioCtx: AudioContext | null = null
let activeSource: AudioBufferSourceNode | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

async function loadCardSound() {
  if (cardSoundBuffer) return
  try {
    const ctx = getAudioContext()
    const response = await fetch('/card-place.wav')
    const arrayBuffer = await response.arrayBuffer()
    cardSoundBuffer = await ctx.decodeAudioData(arrayBuffer)
  } catch {
    // Sound loading failed — race will work silently
  }
}

function playCardSound() {
  if (!cardSoundBuffer) return
  try {
    if (activeSource) {
      try { activeSource.stop() } catch { /* already stopped */ }
      activeSource = null
    }
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') ctx.resume()
    const source = ctx.createBufferSource()
    source.buffer = cardSoundBuffer
    source.playbackRate.value = 2.0
    source.connect(ctx.destination)
    source.onended = () => { if (activeSource === source) activeSource = null }
    source.start()
    activeSource = source
  } catch {
    // Ignore playback errors
  }
}

// --- Fingerprint ---
// Content-based key so we detect new sequences via state (not refs).
// This avoids React strict-mode double-render issues with ref mutations during render.
function seqFingerprint(seq?: Card[]): string {
  if (!seq || seq.length === 0) return ''
  return seq.map(c => c.rank + c.suit[0]).join('')
}

// --- Hook ---

export function useRaceAnimation(
  raceSequence?: Card[],
  positionsAtStep?: Record<Suit, number>[],
  active: boolean = true,
) {
  const [currentStep, setCurrentStep] = useState(0)
  // Tracks which sequence we are currently animating / have completed
  const [animatingKey, setAnimatingKey] = useState('')
  const [completedKey, setCompletedKey] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Content-based key for the incoming sequence (empty when inactive or no sequence)
  const seqKey = active && raceSequence ? seqFingerprint(raceSequence) : ''

  // Pre-load sound
  useEffect(() => {
    if (raceSequence) loadCardSound()
  }, [raceSequence])

  // Is this a sequence we haven't started animating yet?
  const isNewSequence = seqKey !== '' && seqKey !== animatingKey

  // Start animation for new sequence
  useEffect(() => {
    if (isNewSequence) {
      setAnimatingKey(seqKey)
      setCompletedKey('')
      setCurrentStep(0)
    }
  }, [isNewSequence, seqKey])

  // Complete when the completed key matches the current sequence key
  const isComplete = seqKey !== '' && seqKey === completedKey

  // Clamp step: use 0 when we know a new sequence is pending reset, otherwise clamp to length
  const safeStep = raceSequence
    ? Math.min(isNewSequence ? 0 : currentStep, raceSequence.length)
    : 0

  // Advance timer
  useEffect(() => {
    if (isNewSequence || !active || !raceSequence || !positionsAtStep || isComplete) return
    if (currentStep >= raceSequence.length) {
      setCompletedKey(seqKey)
      return
    }

    const totalSteps = raceSequence.length
    const delay = 300 + (currentStep / totalSteps) * 900

    timerRef.current = setTimeout(() => {
      setCurrentStep((s) => s + 1)
    }, delay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentStep, raceSequence, positionsAtStep, isComplete, active, seqKey, isNewSequence])

  // Sound: play when step increases during active animation
  const prevStepRef = useRef(0)
  useEffect(() => {
    if (!isNewSequence && active && !isComplete && currentStep > 0 && currentStep > prevStepRef.current) {
      playCardSound()
    }
    prevStepRef.current = currentStep
  }, [currentStep, active, isComplete, isNewSequence])

  const positions = positionsAtStep?.[safeStep] ?? INITIAL_POSITIONS
  const currentCard = raceSequence && safeStep > 0 ? raceSequence[safeStep - 1] : undefined
  const isAnimating = active && !!raceSequence && !isComplete && !isNewSequence

  // Drawn cards per suit up to safeStep
  const drawnBySuit: Record<Suit, Card[]> = { clubs: [], diamonds: [], hearts: [], spades: [] }
  if (raceSequence) {
    for (let i = 0; i < safeStep; i++) {
      const card = raceSequence[i]
      drawnBySuit[card.suit].push(card)
    }
  }

  const skipToEnd = useCallback(() => {
    if (raceSequence) {
      setCurrentStep(raceSequence.length)
      setCompletedKey(seqKey)
    }
  }, [raceSequence, seqKey])

  return { currentStep: safeStep, positions, isAnimating, currentCard, isComplete, skipToEnd, drawnBySuit }
}

/** Get all drawn cards per suit from a full race sequence */
export function allDrawnBySuit(raceSequence: Card[]): Record<Suit, Card[]> {
  const result: Record<Suit, Card[]> = { clubs: [], diamonds: [], hearts: [], spades: [] }
  for (const card of raceSequence) {
    result[card.suit].push(card)
  }
  return result
}
