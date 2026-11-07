// Presentation mode (LLD §5.1, redesigned).
//
// The other voice modes hand you a topic. This one hands you a deck you have
// never seen, gives you a moment to read it, and then asks you to present it —
// on camera, slide by slide, with the clock running. That is the actual skill:
// standing up in front of material and making it make sense out loud.
//
// Three phases: prep (read the deck) → present (camera on, advance slides) →
// review (submit). What gets sent up is the audio, the per-slide timings and
// transcript, and the five aggregate camera signals. The video itself never
// leaves the browser — see lib/useCameraPresence.js.
import { useEffect, useRef, useState } from 'react'

import { useRecorder } from '../../../components/Recorder'
import {
  AVATAR_IDS,
  AvatarPlayer,
  Button,
  EchoMascot,
  Icon,
  Pill,
  avatarGender,
  avatarName,
} from '../../../components/primitives'
import { useGenerateDoubts } from '../../../lib/assessmentApi'
import { speakLine } from '../../../lib/tts'
import { PRESENCE_LABELS, useCameraPresence } from '../../../lib/useCameraPresence'
import { useSpeechRecognition } from '../../../lib/useSpeechRecognition'

const PREP_SECONDS = 90
const TARGET_SECONDS = 300

const formatTime = (total) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(Math.floor(total % 60)).padStart(2, '0')}`

const countWords = (text) => text.split(/\s+/).filter(Boolean).length

function Slide({ slide, index, total, large = false }) {
  return (
    <div
      className={`bg-white border border-rule rounded-xl ${large ? 'p-10 min-h-[320px]' : 'p-6'} flex flex-col`}
    >
      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-3">
        Slide {index + 1} of {total}
      </div>
      <h3
        className={`font-ser ${large ? 'text-[34px]' : 'text-[20px]'} leading-tight mb-5`}
        style={{ letterSpacing: -0.5 }}
      >
        {slide.title}
      </h3>
      <ul className={`${large ? 'text-[17px]' : 'text-[13.5px]'} text-ink-2 leading-relaxed space-y-2.5`}>
        {slide.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-3">
            <span className="text-accent flex-shrink-0">—</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AudioLevels({ levels }) {
  // The recorder's own analyser feed (see components/Recorder.jsx), rendered
  // here so there's visible proof the mic is actually picking something up —
  // Presentation never rendered <Recorder> itself, so this waveform simply
  // didn't exist anywhere in the mode before.
  return (
    <div className="mb-3">
      <div className="font-mono text-[9.5px] uppercase tracking-wide text-ink-4 mb-1">Mic level</div>
      <svg width="100%" height="22" viewBox="0 0 220 22" preserveAspectRatio="none">
        {levels.map((level, index) => {
          const height = Math.max(2, level * 20)
          return (
            <rect
              key={index}
              x={index * 3.15}
              y={11 - height / 2}
              width="1.6"
              height={height}
              rx="0.8"
              fill={level > 0.02 ? 'var(--color-accent)' : 'var(--color-rule-2)'}
            />
          )
        })}
      </svg>
    </div>
  )
}

function PresenceMeter({ label, value, muted }) {
  const tone = value >= 70 ? 'bg-good' : value >= 45 ? 'bg-warn' : 'bg-bad'
  return (
    <div className={muted ? 'opacity-40' : ''}>
      <div className="flex justify-between font-mono text-[9.5px] uppercase tracking-wide text-ink-4 mb-1">
        <span>{label}</span>
        <span>{value == null ? '—' : value}</span>
      </div>
      <div className="h-[3px] bg-rule rounded overflow-hidden">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  )
}

/** The sticky sidebar: camera preview, mic level, the five presence meters.
 * Shared between the presenting and doubts phases so the take looks like one
 * continuous page rather than jumping to a different screen the moment the
 * slides end — the camera keeps running through the follow-up round too. */
function CameraPanel({ camera, recorder }) {
  return (
    <div className="bg-white border border-rule rounded-xl p-3 sticky top-4">
      <div className="relative rounded-lg overflow-hidden bg-ink mb-3" style={{ aspectRatio: '4 / 3' }}>
        {/* Mirrored: an unmirrored self-view is disorienting to present into. */}
        <video
          ref={camera.videoRef}
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        {camera.isActive && !camera.faceVisible && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/70 px-3">
            <span className="font-mono text-[10px] text-paper text-center leading-relaxed">
              We can't see you — move into frame
            </span>
          </div>
        )}
      </div>

      <AudioLevels levels={recorder.levels} />

      <div className="space-y-2.5">
        {Object.entries(PRESENCE_LABELS).map(([key, label]) => (
          <PresenceMeter
            key={key}
            label={label}
            value={camera.live?.[key]}
            muted={!camera.isActive || camera.live?.[key] == null}
          />
        ))}
      </div>

      <p className="font-mono text-[9px] text-ink-4 leading-relaxed mt-3 pt-3 border-t border-rule">
        Measured in your browser from framing and movement. Nothing is uploaded or recorded.
      </p>

      {camera.error && <p className="text-bad text-[11px] mt-2 leading-snug">{camera.error}</p>}
      {recorder.error && <p className="text-bad text-[11px] mt-2 leading-snug">{recorder.error}</p>}
    </div>
  )
}

/** A chat bubble anchored to the avatar, tail pointing at it — the "ask" and
 * "I've answered" actions live inside it rather than as a button floating
 * disconnected underneath, so the whole thing reads as one unit: the
 * character, talking. */
function SpeechBubble({ children }) {
  return (
    <div className="relative bg-paper-2 border border-rule rounded-2xl px-5 py-4 max-w-[320px]">
      <div
        className="absolute -left-[7px] top-8 w-3.5 h-3.5 bg-paper-2 border-l border-b border-rule"
        style={{ transform: 'rotate(45deg)' }}
      />
      {children}
    </div>
  )
}

export function PresentInterface({ session, onSubmit, isSubmitting }) {
  const slides = session.prompt.payload?.slides ?? []
  const [phase, setPhase] = useState('prep') // prep | presenting | doubts | review
  const [slideIndex, setSlideIndex] = useState(0)
  const [prepLeft, setPrepLeft] = useState(PREP_SECONDS)
  const [elapsed, setElapsed] = useState(0)
  const [doubtQuestions, setDoubtQuestions] = useState([])
  const [doubtIndex, setDoubtIndex] = useState(0)
  const [doubtStatus, setDoubtStatus] = useState('ready') // ready | asking | answering
  const [doubtsLoading, setDoubtsLoading] = useState(false)

  const recorder = useRecorder()
  const camera = useCameraPresence()
  const speech = useSpeechRecognition()
  const generateDoubts = useGenerateDoubts()
  const avatarId = useRef(AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)]).current
  const speechRef = useRef(null)

  // Per-slide accounting. Refs, not state: these are written from an interval
  // and from event handlers, and a stale closure here would silently lose a
  // slide's timing.
  const timingsRef = useRef([])
  const slideStartRef = useRef(0)
  const transcriptMarkRef = useRef(0)
  const transcriptRef = useRef('')
  transcriptRef.current = speech.finalTranscript

  useEffect(() => () => speechRef.current?.cancel(), [])

  // The doubt round's live captions went dead: recognition kept running
  // continuously right through it, at the same time the avatar's own TTS
  // audio was also active — Chrome's speech-recognition engine and
  // speechSynthesis/audio playback contend for the same audio subsystem, and
  // recognition can silently stall when both run at once. The fix is also
  // just correct behaviour: the student isn't supposed to be talking while
  // the avatar is asking, so pause capture for exactly that window and start
  // a clean session the moment it's actually their turn to answer.
  useEffect(() => {
    if (phase !== 'doubts') return undefined
    if (doubtStatus === 'answering') {
      transcriptMarkRef.current = transcriptRef.current.length
      speech.start()
    } else {
      speech.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, doubtStatus])

  useEffect(() => {
    if (phase !== 'prep' || prepLeft <= 0) return undefined
    const timer = setInterval(() => setPrepLeft((left) => Math.max(0, left - 1)), 1000)
    return () => clearInterval(timer)
  }, [phase, prepLeft])

  useEffect(() => {
    if (phase !== 'presenting') return undefined
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000)
    return () => clearInterval(timer)
  }, [phase])

  const closeSegment = (index) => {
    const transcript = transcriptRef.current.slice(transcriptMarkRef.current)
    timingsRef.current.push({
      index,
      seconds: (Date.now() - slideStartRef.current) / 1000,
      words: countWords(transcript),
      transcript: transcript.trim(),
    })
    transcriptMarkRef.current = transcriptRef.current.length
    slideStartRef.current = Date.now()
  }

  const closeSlide = () => closeSegment(slideIndex)

  const startPresenting = async () => {
    timingsRef.current = []
    transcriptMarkRef.current = 0
    slideStartRef.current = Date.now()
    setSlideIndex(0)
    setElapsed(0)
    await recorder.start()
    await camera.start()
    speech.reset()
    speech.start()
    setPhase('presenting')
  }

  const nextSlide = () => {
    closeSlide()
    setSlideIndex((index) => Math.min(slides.length - 1, index + 1))
  }

  /** Stops all capture and moves to review — the actual end of the take. */
  const finishRecording = () => {
    recorder.stop()
    camera.stop()
    speech.stop()
    setPhase('review')
  }

  /** Every slide is done. Recording keeps running while a couple of
   * on-the-spot follow-ups are generated from what was actually said —
   * if that fails or comes back empty, this falls straight through to the
   * normal finish rather than ever blocking on it. */
  const finishSlides = async () => {
    closeSlide()
    setDoubtsLoading(true)
    try {
      const { questions } = await generateDoubts.mutateAsync({
        sessionId: session.id,
        slideTimings: timingsRef.current,
      })
      if (questions?.length) {
        setDoubtQuestions(questions)
        setDoubtIndex(0)
        setDoubtStatus('ready')
        slideStartRef.current = Date.now()
        setDoubtsLoading(false)
        setPhase('doubts')
        return
      }
    } catch {
      // Generation failed — fall straight through to the normal finish.
    }
    setDoubtsLoading(false)
    finishRecording()
  }

  const endEarly = () => {
    closeSlide()
    finishRecording()
  }

  const askCurrentDoubt = () => {
    const text = doubtQuestions[doubtIndex]
    speechRef.current?.cancel()
    speechRef.current = speakLine(text, { gender: avatarGender(avatarId), seed: avatarId }, {
      onStart: () => setDoubtStatus('asking'),
      onEnd: () => setDoubtStatus('answering'),
    })
  }

  const nextDoubtOrFinish = () => {
    closeSegment(slides.length + doubtIndex)
    if (doubtIndex + 1 < doubtQuestions.length) {
      setDoubtIndex((index) => index + 1)
      setDoubtStatus('ready')
    } else {
      finishRecording()
    }
  }

  const submit = () =>
    onSubmit({
      audioBlob: recorder.blob,
      durationSeconds: recorder.seconds,
      slideTimings: timingsRef.current,
      visualMetrics: camera.summary(),
      doubtQuestions,
    })

  if (!slides.length) {
    return <p className="text-bad text-sm">This presentation has no slides — try starting it again.</p>
  }

  if (phase === 'prep') {
    return (
      <div>
        <div className="flex items-start gap-3 bg-paper-2 rounded-[10px] p-4 mb-6">
          <EchoMascot size={32} />
          <div className="flex-1">
            <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-1">Read it through</div>
            <p className="text-[13px] text-ink-2 leading-relaxed">
              These are cues, not a script — there's nothing here to read aloud. Work out what you'd
              actually <em>say</em> on each one, then start. You'll present them one at a time with
              the camera on, and you get about {Math.round(TARGET_SECONDS / 60)} minutes.
            </p>
          </div>
          <div className="font-mono text-[22px] text-ink" style={{ letterSpacing: -1 }}>
            {formatTime(prepLeft)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {slides.map((slide, index) => (
            <Slide key={slide.title} slide={slide} index={index} total={slides.length} />
          ))}
        </div>

        <div className="flex items-center mt-8">
          <span className="text-[13px] text-ink-3">
            {prepLeft > 0 ? 'Take the time you need — the clock is only a nudge.' : 'Time to present.'}
          </span>
          <div className="flex-1" />
          <Button variant="accent" size="lg" icon={Icon.arrow} onClick={startPresenting}>
            I'm ready — start presenting
          </Button>
        </div>
      </div>
    )
  }

  if (phase === 'presenting') {
    const overTime = elapsed > TARGET_SECONDS
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Pill tone={overTime ? 'bad' : 'accent'}>● LIVE</Pill>
          <span className="font-mono text-[11px] text-ink-3">
            {formatTime(elapsed)} / {formatTime(TARGET_SECONDS)}
          </span>
          <div className="flex-1 h-[3px] bg-rule rounded overflow-hidden">
            <div
              className={`h-full ${overTime ? 'bg-bad' : 'bg-accent'} transition-all`}
              style={{ width: `${Math.min(100, (elapsed / TARGET_SECONDS) * 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_240px] gap-5 items-start">
          <div>
            <Slide slide={slides[slideIndex]} index={slideIndex} total={slides.length} large />

            <div className="bg-paper-2 border border-rule rounded-[10px] p-4 mt-4 min-h-[76px]">
              <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-1.5">
                What you're saying on this slide
              </div>
              {speech.isSupported ? (
                <p className="text-[13px] text-ink-2 leading-relaxed">
                  {speech.finalTranscript.slice(transcriptMarkRef.current) || (
                    <span className="text-ink-4">Listening…</span>
                  )}
                  <span className="text-ink-4"> {speech.interimTranscript}</span>
                </p>
              ) : (
                <p className="text-[12.5px] text-ink-4">
                  Live captions need Chrome or Edge. Your audio is still being recorded and scored.
                </p>
              )}
              {speech.error && <p className="text-bad text-[11px] mt-1.5">{speech.error}</p>}
            </div>
          </div>

          <CameraPanel camera={camera} recorder={recorder} />
        </div>

        <div className="flex items-center gap-3 mt-6">
          <span className="text-[13px] text-ink-3">
            Slide {slideIndex + 1} of {slides.length}
          </span>
          <div className="flex-1" />
          {slideIndex < slides.length - 1 ? (
            <Button variant="accent" size="lg" icon={Icon.arrow} onClick={nextSlide}>
              Next slide
            </Button>
          ) : (
            <Button variant="accent" size="lg" onClick={finishSlides} disabled={doubtsLoading}>
              {doubtsLoading ? 'One moment…' : 'Finish presenting'}
            </Button>
          )}
          {slideIndex < slides.length - 1 && (
            <button type="button" onClick={endEarly} className="text-[13px] text-ink-3 px-4 py-2">
              End early
            </button>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'doubts') {
    const question = doubtQuestions[doubtIndex]
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Pill tone="accent">◎ Quick check — {doubtIndex + 1} of {doubtQuestions.length}</Pill>
          <span className="font-mono text-[11px] text-ink-3">Still recording, no slide to lean on</span>
        </div>

        <div className="grid grid-cols-[1fr_240px] gap-5 items-start">
          <div>
            <div className="bg-white border border-rule rounded-xl p-10 min-h-[320px] flex items-end justify-center gap-3">
              <AvatarPlayer avatarId={avatarId} height={220} talking={doubtStatus === 'asking'} />
              <SpeechBubble>
                {doubtStatus === 'ready' && (
                  <>
                    <p className="text-[13.5px] text-ink-2 leading-relaxed mb-3">
                      Based on what you just said, {avatarName(avatarId)} has a follow-up for you.
                    </p>
                    <button
                      type="button"
                      onClick={askCurrentDoubt}
                      className="font-mono text-[11px] uppercase tracking-wide text-white bg-accent rounded-full px-4 py-2"
                    >
                      Ask {avatarName(avatarId)}
                    </button>
                  </>
                )}
                {doubtStatus !== 'ready' && (
                  <>
                    <p className="font-ser text-[18px] leading-snug mb-3" style={{ letterSpacing: -0.3 }}>
                      {question}
                    </p>
                    {doubtStatus === 'asking' ? (
                      <span className="font-mono text-[10px] uppercase tracking-wide text-ink-4">Asking…</span>
                    ) : (
                      <button
                        type="button"
                        onClick={nextDoubtOrFinish}
                        className="font-mono text-[11px] uppercase tracking-wide text-white bg-accent rounded-full px-4 py-2"
                      >
                        {doubtIndex + 1 < doubtQuestions.length ? "I've answered — next" : "I've answered — finish"}
                      </button>
                    )}
                  </>
                )}
              </SpeechBubble>
            </div>

            {doubtStatus === 'answering' && (
              <div className="bg-paper-2 border border-rule rounded-[10px] p-4 mt-4 min-h-[76px]">
                <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-1.5">
                  Your answer
                </div>
                {speech.isSupported ? (
                  <p className="text-[13px] text-ink-2 leading-relaxed">
                    {speech.finalTranscript.slice(transcriptMarkRef.current) || (
                      <span className="text-ink-4">Listening…</span>
                    )}
                    <span className="text-ink-4"> {speech.interimTranscript}</span>
                  </p>
                ) : (
                  <p className="text-[12.5px] text-ink-4">
                    Live captions need Chrome or Edge. Your audio is still being recorded and scored.
                  </p>
                )}
                {speech.error && <p className="text-bad text-[11px] mt-1.5">{speech.error}</p>}
              </div>
            )}
          </div>

          <CameraPanel camera={camera} recorder={recorder} />
        </div>
      </div>
    )
  }

  const summary = camera.summary()
  const covered = timingsRef.current.filter((entry) => entry.index < slides.length && entry.words >= 12).length

  return (
    <div>
      <h2 className="font-ser text-[26px] mb-1" style={{ letterSpacing: -0.4 }}>
        That's your run.
      </h2>
      <p className="text-[14px] text-ink-3 mb-6">
        You presented {covered} of {slides.length} slides in {formatTime(recorder.seconds)}. Echo will
        take it from here.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white border border-rule rounded-xl p-5">
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-3">Time per slide</div>
          {timingsRef.current
            .filter((entry) => entry.index < slides.length)
            .map((entry) => (
              <div key={entry.index} className="flex justify-between text-[13px] text-ink-2 py-1">
                <span className="truncate pr-3">{slides[entry.index]?.title}</span>
                <span className="font-mono text-ink-3 flex-shrink-0">{formatTime(entry.seconds)}</span>
              </div>
            ))}
        </div>
        <div className="bg-white border border-rule rounded-xl p-5">
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-3">Camera read</div>
          {summary ? (
            <div className="space-y-2.5">
              {Object.entries(PRESENCE_LABELS).map(([key, label]) => (
                <PresenceMeter key={key} label={label} value={summary[key]} />
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-4 leading-relaxed">
              The camera wasn't running, so this run is scored on what you said alone.
            </p>
          )}
        </div>
      </div>

      {doubtQuestions.length > 0 && (
        <div className="bg-white border border-rule rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AvatarPlayer avatarId={avatarId} height={36} />
            <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4">
              Follow-up questions from {avatarName(avatarId)}
            </div>
          </div>
          <div className="space-y-3">
            {doubtQuestions.map((question, index) => {
              const answer = timingsRef.current.find((entry) => entry.index === slides.length + index)
              return (
                <div key={question} className="text-[13px]">
                  <p className="text-ink font-medium mb-1">{question}</p>
                  <p className="text-ink-3 leading-relaxed">
                    {answer?.transcript || 'No audible answer was captured.'}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {recorder.blob && (
        <audio className="w-full mb-6" controls src={URL.createObjectURL(recorder.blob)}>
          <track kind="captions" />
        </audio>
      )}

      <div className="flex items-center">
        <span className="text-[13px] text-ink-3">There's no retake on a baseline assessment.</span>
        <div className="flex-1" />
        <Button
          variant="accent"
          size="lg"
          icon={Icon.arrow}
          onClick={submit}
          disabled={!recorder.blob || isSubmitting}
        >
          {isSubmitting ? 'Submitting…' : 'Submit presentation'}
        </Button>
      </div>
    </div>
  )
}
