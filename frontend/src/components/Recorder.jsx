// Voice capture for assessment modes. MediaRecorder + Web Audio analyser,
// per LLD §18.2 (audio/webm;codecs=opus) and §18.3 (client-side levels).
// The waveform and timer are ported from the prototype's recorder panel in
// design_extracted/lexio/desktop.jsx (DOnboarding).
import { useEffect, useRef, useState } from 'react'

const BAR_COUNT = 70

export function useRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [blob, setBlob] = useState(null)
  const [levels, setLevels] = useState(() => new Array(BAR_COUNT).fill(0))
  const [error, setError] = useState(null)

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const rafRef = useRef(null)
  const timerRef = useRef(null)

  const cleanup = () => {
    cancelAnimationFrame(rafRef.current)
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    audioCtxRef.current?.close().catch(() => {})
    streamRef.current = null
    audioCtxRef.current = null
  }

  useEffect(() => cleanup, [])

  const start = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data)
      recorder.onstop = () => setBlob(new Blob(chunksRef.current, { type: 'audio/webm' }))
      recorder.start(250) // LLD §18.2: 250ms chunks
      recorderRef.current = recorder

      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      audioCtx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)

      const tick = () => {
        analyser.getByteFrequencyData(data)
        const average = data.reduce((sum, value) => sum + value, 0) / data.length / 255
        setLevels((previous) => [...previous.slice(1), average])
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()

      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
      setBlob(null)
      setIsRecording(true)
    } catch (err) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it in your browser and try again.'
          : `Could not start recording: ${err.message}`
      )
    }
  }

  const stop = () => {
    recorderRef.current?.state === 'recording' && recorderRef.current.stop()
    cleanup()
    setIsRecording(false)
  }

  const reset = () => {
    setBlob(null)
    setSeconds(0)
    setLevels(new Array(BAR_COUNT).fill(0))
  }

  return { isRecording, seconds, blob, levels, error, start, stop, reset }
}

function formatTime(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * `onStart`/`onStop` let a caller wrap the transport — the assessment
 * interfaces use them to run live captions alongside the recording. They
 * replace the default handlers rather than supplementing them, so the caller
 * stays in charge of ordering.
 */
export function Recorder({ recorder, limitSeconds, onStart, onStop }) {
  const { isRecording, seconds, blob, levels, error, start, stop } = recorder

  return (
    <div>
      <div className="bg-white border border-rule rounded-xl p-8 grid grid-cols-[auto_1fr_auto] items-center gap-7">
        <button
          type="button"
          onClick={isRecording ? (onStop ?? stop) : (onStart ?? start)}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          className={`w-20 h-20 rounded-full border-none flex items-center justify-center text-white ${isRecording ? 'bg-bad' : 'bg-accent'}`}
          style={{ boxShadow: '0 0 0 8px var(--color-accent-soft)' }}
        >
          {isRecording ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          )}
        </button>

        <div>
          <div className="font-mono text-[11px] uppercase tracking-wide text-ink-4 mb-2.5">
            {isRecording ? 'Recording — tap to stop' : blob ? 'Recorded — tap to record again' : 'Live waveform — tap to record'}
          </div>
          <svg width="100%" height="40" viewBox="0 0 600 40" preserveAspectRatio="none">
            {levels.map((level, index) => {
              const height = Math.max(3, level * 38)
              return (
                <rect
                  key={index}
                  x={index * 8.4}
                  y={20 - height / 2}
                  width="3"
                  height={height}
                  rx="1.5"
                  fill={level > 0.02 ? 'var(--color-accent)' : 'var(--color-rule-2)'}
                />
              )
            })}
          </svg>
        </div>

        <div className="font-mono text-2xl text-ink" style={{ letterSpacing: -1 }}>
          {formatTime(seconds)}
          {limitSeconds && <span className="text-ink-4 text-sm"> / {formatTime(limitSeconds)}</span>}
        </div>
      </div>

      {error && <p className="text-bad text-sm mt-3">{error}</p>}
      {blob && !isRecording && (
        <audio className="mt-4 w-full" controls src={URL.createObjectURL(blob)}>
          <track kind="captions" />
        </audio>
      )}
    </div>
  )
}
