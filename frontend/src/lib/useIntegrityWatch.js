// Watches how an answer was produced, not what's in it.
//
// This is not proctoring. Nothing here blocks anything, nothing is recorded
// beyond four counters, and the backend is explicit that none of it can move
// a score (apps/analysis/authenticity.py). It exists so the authenticity read
// on the report has something more reliable behind it than a model's opinion
// of someone's prose — a 900-character paste is a fact; "this reads like AI"
// is a guess.
import { useCallback, useEffect, useRef } from 'react'

export function useIntegrityWatch(enabled = true) {
  const signalsRef = useRef({ paste_count: 0, pasted_chars: 0, away_count: 0, away_seconds: 0 })
  const leftAtRef = useRef(null)

  useEffect(() => {
    if (!enabled) return undefined

    const onPaste = (event) => {
      const pasted = event.clipboardData?.getData('text') ?? ''
      if (!pasted) return
      signalsRef.current.paste_count += 1
      signalsRef.current.pasted_chars += pasted.length
    }

    const onVisibility = () => {
      if (document.hidden) {
        leftAtRef.current = Date.now()
        return
      }
      if (leftAtRef.current) {
        signalsRef.current.away_count += 1
        signalsRef.current.away_seconds += Math.round((Date.now() - leftAtRef.current) / 1000)
        leftAtRef.current = null
      }
    }

    document.addEventListener('paste', onPaste)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled])

  // Read at submit time; counts the tab switch still in progress, if any.
  const snapshot = useCallback(() => {
    const signals = { ...signalsRef.current }
    if (leftAtRef.current) {
      signals.away_count += 1
      signals.away_seconds += Math.round((Date.now() - leftAtRef.current) / 1000)
    }
    return signals
  }, [])

  return { snapshot }
}
