// LLD §16.2 /practice/:session_id — the live session. Layout ported from the
// prototype's DPractice (design_extracted/lexio/desktop2.jsx): interviewer
// card, live transcript, recorder bar, coaching sidebar.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { AppShell } from '../../components/AppShell'
import { Button, EchoMascot, Icon, Pill, Rule } from '../../components/primitives'
import { usePracticeSession } from '../../lib/practiceApi'
import { usePracticeSocket } from '../../lib/usePracticeSocket'
import { computeMetrics, useSpeechRecognition } from '../../lib/useSpeechRecognition'
import { usePracticeStore } from '../../stores/usePracticeStore'

const CHUNK_INTERVAL_MS = 30_000 // LLD §8.2: a nudge roughly every 30 seconds

export function LivePracticePage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const { data: session } = usePracticeSession(sessionId)
  const speech = useSpeechRecognition()
  const store = usePracticeStore()

  const [elapsed, setElapsed] = useState(0)
  const [typed, setTyped] = useState('')
  const [ending, setEnding] = useState(false)

  const startedAtRef = useRef(Date.now())
  const lastChunkSentAtRef = useRef(0)
  const lastChunkOffsetRef = useRef(0)

  const { isConnected, error: socketError, send } = usePracticeSocket(sessionId, {
    'practice:ready': (message) => {
      store.setTurns(message.turns ?? [])
      store.setStatus('live')
    },
    'practice:coaching_tip': (message) => store.addTip(message),
    'practice:next_question': (message) => {
      store.nextQuestion(message.question, message.question_number)
      speech.reset()
      lastChunkOffsetRef.current = 0
    },
    'practice:session_end': () => {
      store.setStatus('complete')
      navigate(`/practice/${sessionId}/summary`)
    },
    'practice:error': (message) => console.warn('practice socket:', message.message),
  })

  // The opening line comes through router state on launch so Echo speaks
  // immediately rather than after a round-trip.
  useEffect(() => {
    store.reset()
    const openingLine = location.state?.openingLine
    if (openingLine) store.setTurns([{ role: 'echo', text: openingLine }])
    return () => store.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const spokenText = speech.isSupported ? speech.finalTranscript : typed
  const metrics = useMemo(
    () => computeMetrics(spokenText, elapsed, speech.pauseCount),
    [spokenText, elapsed, speech.pauseCount]
  )

  useEffect(() => {
    store.updateMetrics(metrics)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics.word_count, metrics.filler_count, metrics.avg_wpm, metrics.pause_count])

  // Ship the last ~30s of speech for a coaching tip.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      if (now - lastChunkSentAtRef.current < CHUNK_INTERVAL_MS) return
      const chunk = spokenText.slice(lastChunkOffsetRef.current).trim()
      if (!chunk) return

      if (send({ type: 'practice:transcript_chunk', transcript: chunk, elapsed_s: elapsed })) {
        lastChunkSentAtRef.current = now
        lastChunkOffsetRef.current = spokenText.length
      }
    }, 5000)
    return () => clearInterval(id)
  }, [spokenText, elapsed, send])

  const currentAnswer = () => (speech.isSupported ? speech.finalTranscript : typed).trim()

  const handleNextQuestion = () => {
    send({ type: 'practice:request_question', answer: currentAnswer() })
    if (speech.isSupported) speech.reset()
    else setTyped('')
  }

  const handleEnd = () => {
    setEnding(true)
    store.setStatus('ending')
    speech.stop()
    send({ type: 'practice:end', answer: currentAnswer(), metrics })
  }

  const isMultiTurn = session?.session_type === 'mock_interview' || session?.session_type === 'debate'
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const seconds = String(elapsed % 60).padStart(2, '0')

  if (ending) {
    return (
      <AppShell>
        <div className="max-w-[560px] mx-auto px-8 py-24 text-center">
          <div className="flex justify-center mb-6">
            <EchoMascot size={72} talking />
          </div>
          <h1 className="font-ser text-3xl font-normal mb-3" style={{ letterSpacing: -0.6 }}>
            Scoring your session…
          </h1>
          <p className="text-ink-3 text-sm">Echo is reviewing everything you said.</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="px-9 py-8 grid grid-cols-[1fr_320px] gap-6 max-w-[1320px] mx-auto">
        <main>
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-2">
              <Pill tone={isConnected ? 'accent' : 'neutral'}>
                ◉ {isConnected ? 'Live' : 'Connecting…'}
              </Pill>
              <span className="font-mono text-[11px] text-ink-4 uppercase tracking-wide">
                {session?.session_type?.replace('_', ' ')}
              </span>
            </div>
            <span className="font-mono text-2xl text-ink" style={{ letterSpacing: -1 }}>
              {minutes}:{seconds}
            </span>
          </div>

          {socketError && <p className="text-bad text-sm mb-4">{socketError}</p>}
          {speech.error && <p className="text-warn text-sm mb-4">{speech.error}</p>}

          <div className="bg-white border border-rule rounded-xl p-6">
            <div className="flex flex-col gap-4 mb-5 max-h-[280px] overflow-auto">
              {store.turns.map((turn, index) => (
                <div key={index} className="flex gap-3 items-start">
                  {turn.role === 'echo' ? (
                    <EchoMascot size={32} />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-paper-2 border border-rule flex-shrink-0" />
                  )}
                  <div
                    className={`px-3.5 py-3 rounded-[10px] text-[14px] leading-relaxed flex-1 ${
                      turn.role === 'echo' ? 'bg-paper text-ink-2' : 'bg-accent-soft text-ink'
                    }`}
                  >
                    {turn.text}
                  </div>
                </div>
              ))}
            </div>

            <Rule label={speech.isSupported ? 'YOUR RESPONSE · LIVE CAPTIONS' : 'YOUR RESPONSE'} />

            {speech.isSupported ? (
              <div className="min-h-[120px] p-4 bg-paper rounded-md border border-dashed border-rule-2">
                <p className="text-[15px] leading-relaxed text-ink">
                  {speech.finalTranscript}
                  <span className="text-ink-4">{speech.interimTranscript}</span>
                  {!speech.finalTranscript && !speech.interimTranscript && (
                    <span className="text-ink-4">
                      {speech.isListening ? 'Listening — start speaking.' : 'Press Start speaking below.'}
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <>
                <p className="text-[12.5px] text-ink-4 mb-2">
                  Live captions need Chrome or Edge. You can still do the session by typing your answer.
                </p>
                <textarea
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  aria-label="Your response"
                  className="lx-input w-full min-h-[120px] resize-y"
                  placeholder="Type your response…"
                />
              </>
            )}

            <div className="flex items-center gap-3 mt-5">
              {speech.isSupported && (
                <Button
                  variant={speech.isListening ? 'secondary' : 'accent'}
                  onClick={speech.isListening ? speech.stop : speech.start}
                  icon={Icon.mic}
                >
                  {speech.isListening ? 'Pause' : 'Start speaking'}
                </Button>
              )}
              <div className="flex-1" />
              {isMultiTurn && (
                <Button variant="secondary" onClick={handleNextQuestion} disabled={!isConnected}>
                  Next question
                </Button>
              )}
              <Button variant="primary" onClick={handleEnd} disabled={!isConnected} icon={Icon.arrow}>
                End & score
              </Button>
            </div>
          </div>
        </main>

        <aside className="flex flex-col gap-4">
          <div className="bg-white border border-rule rounded-[10px] p-5">
            <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-3">Live metrics</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Words / min', store.metrics.avg_wpm],
                ['Filler words', store.metrics.filler_count],
                ['Pauses', store.metrics.pause_count],
                ['Words', store.metrics.word_count],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="font-ser text-[24px] text-ink leading-none">{value}</div>
                  <div className="font-mono text-[10px] text-ink-4 uppercase tracking-wide mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-rule rounded-[10px] p-5 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-3">Live coaching</div>
            {store.coachingTips.length === 0 ? (
              <p className="text-[12.5px] text-ink-4 leading-snug">
                Tips appear here every 30 seconds or so, while there's still time to use them.
              </p>
            ) : (
              <div className="flex flex-col">
                {store.coachingTips.map((tip, index) => (
                  <div key={index} className="py-2.5 border-t border-rule first:border-t-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[12.5px] font-medium text-ink">{tip.dimension}</span>
                      <span
                        className={`text-[10px] font-mono uppercase ${
                          tip.severity === 'warn' ? 'text-warn' : 'text-good'
                        }`}
                      >
                        ● {tip.severity}
                      </span>
                    </div>
                    <div className="text-[12.5px] text-ink-3 leading-snug">{tip.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  )
}
