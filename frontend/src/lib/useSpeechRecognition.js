// Live captions for practice sessions.
//
// LLD §18.2 relays audio to a streaming STT provider; this uses the browser's
// own SpeechRecognition instead — no streaming-STT subscription, no audio
// relay latency, and §18.3 already puts the live metrics client-side. Only
// text crosses the socket. Recorded sessions still use AssemblyAI server-side.
//
// Chrome/Edge only, so `isSupported` is false elsewhere and the session falls
// back to typing (see LivePracticePage).
import { useCallback, useEffect, useRef, useState } from 'react'

const FILLER_WORDS = new Set([
  'um', 'uh', 'er', 'ah', 'like', 'basically', 'actually', 'honestly',
  'literally', 'sorta', 'kinda', 'hmm', 'erm',
])

const PAUSE_THRESHOLD_MS = 800 // LLD §18.3

// Chrome ends a continuous recognition session on its own every so often —
// sometimes within seconds — and needs restarting to keep captions running
// for a whole take. If nothing at all (no result, no restart) has happened
// for this long, the engine has gone silently stuck: no onend, no onerror,
// just dead air. This is what actually caused "worked for a bit, then never
// again" — the watchdog below is what recovers from it.
const STALL_TIMEOUT_MS = 7000
const WATCHDOG_INTERVAL_MS = 2000

function getRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
  return Recognition ? new Recognition() : null
}

export function useSpeechRecognition() {
  const [isSupported] = useState(() => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition))
  const [isListening, setIsListening] = useState(false)
  const [finalTranscript, setFinalTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [pauseCount, setPauseCount] = useState(0)
  const [error, setError] = useState(null)

  const recognitionRef = useRef(null)
  const lastResultAtRef = useRef(null)
  const lastActivityAtRef = useRef(null)
  const shouldRestartRef = useRef(false)
  const startFailuresRef = useRef(0)
  // Bumped on every (re)start. Callbacks close over the value at the moment
  // their instance was created, so a stray event from an instance that's
  // since been superseded — by a restart, a stop(), or the watchdog forcing
  // a fresh one — can tell it's stale and do nothing, instead of fighting
  // the instance that replaced it (two "active" recognitions at once is
  // exactly what produces "recording, but nothing is ever heard again").
  const generationRef = useRef(0)

  const stop = useCallback(() => {
    shouldRestartRef.current = false
    generationRef.current += 1
    recognitionRef.current?.abort()
    setIsListening(false)
  }, [])

  const startSessionRef = useRef(() => {})
  startSessionRef.current = () => {
    if (!isSupported) return
    const recognition = getRecognition()
    if (!recognition) return

    const generation = (generationRef.current += 1)
    lastActivityAtRef.current = Date.now()

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      if (generationRef.current !== generation) return
      const now = Date.now()
      lastActivityAtRef.current = now
      if (lastResultAtRef.current && now - lastResultAtRef.current > PAUSE_THRESHOLD_MS) {
        setPauseCount((count) => count + 1)
      }
      lastResultAtRef.current = now

      let interim = ''
      let settled = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        if (result.isFinal) settled += `${result[0].transcript} `
        else interim += result[0].transcript
      }
      if (settled) setFinalTranscript((previous) => `${previous}${settled}`)
      setInterimTranscript(interim)
    }

    recognition.onerror = (event) => {
      if (generationRef.current !== generation) return
      // 'no-speech' fires routinely during natural pauses — not an error the
      // student needs to see.
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(
          event.error === 'not-allowed'
            ? 'Microphone access was blocked. Allow it and start again.'
            : `Speech recognition error: ${event.error}`
        )
      }
    }

    recognition.onend = () => {
      if (generationRef.current !== generation || !shouldRestartRef.current) {
        if (generationRef.current === generation) setIsListening(false)
        return
      }
      setTimeout(() => {
        if (generationRef.current === generation && shouldRestartRef.current) startSessionRef.current()
      }, 250)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setIsListening(true)
      startFailuresRef.current = 0
    } catch {
      // start() itself can throw if called too soon after the previous
      // session's teardown — distinct from the silent-stall case above, and
      // worth a bounded retry rather than giving up on the first one.
      startFailuresRef.current += 1
      if (startFailuresRef.current > 6) {
        setIsListening(false)
        setError('Live captions dropped — your audio is still being recorded and scored.')
        return
      }
      setTimeout(() => {
        if (generationRef.current === generation && shouldRestartRef.current) startSessionRef.current()
      }, 300)
    }
  }

  const start = useCallback(() => {
    if (!isSupported) return
    shouldRestartRef.current = true
    startFailuresRef.current = 0
    setError(null)
    startSessionRef.current()
  }, [isSupported])

  // The watchdog: if we're supposed to be listening but nothing has happened
  // — no result, no restart — in STALL_TIMEOUT_MS, force a fresh instance
  // rather than trust onend/onerror to ever fire on their own.
  useEffect(() => {
    if (!isSupported) return undefined
    const watchdog = setInterval(() => {
      if (!shouldRestartRef.current || !lastActivityAtRef.current) return
      if (Date.now() - lastActivityAtRef.current > STALL_TIMEOUT_MS) {
        generationRef.current += 1 // orphan the stuck instance's callbacks
        recognitionRef.current?.abort()
        startSessionRef.current()
      }
    }, WATCHDOG_INTERVAL_MS)
    return () => clearInterval(watchdog)
  }, [isSupported])

  useEffect(() => () => {
    shouldRestartRef.current = false
    generationRef.current += 1
    recognitionRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    setFinalTranscript('')
    setInterimTranscript('')
    setPauseCount(0)
    lastResultAtRef.current = null
  }, [])

  return { isSupported, isListening, finalTranscript, interimTranscript, pauseCount, error, start, stop, reset }
}

/** LLD §18.3 — live metrics, computed client-side from the transcript. */
export function computeMetrics(transcript, elapsedSeconds, pauseCount) {
  const tokens = transcript
    .split(/\s+/)
    .map((token) => token.replace(/[.,!?;:]/g, '').toLowerCase())
    .filter(Boolean)

  const fillerCount = tokens.filter((token) => FILLER_WORDS.has(token)).length
  const minutes = elapsedSeconds / 60

  return {
    word_count: tokens.length,
    avg_wpm: minutes > 0 ? Math.round(tokens.length / minutes) : 0,
    filler_count: fillerCount,
    filler_ratio: tokens.length ? Math.round((fillerCount / tokens.length) * 1000) / 10 : 0,
    pause_count: pauseCount,
  }
}
