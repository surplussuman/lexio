// Speaking and Group Discussion.
//
// Two things the first cut got wrong and this fixes:
//
// 1. The clock was decoration. You were asked to speak for three minutes,
//    stopped at thirty seconds, and nothing said so — not the interface, not
//    the score. Now the target is on screen the whole time, the bar shows how
//    much of it you've used, and stopping well short asks you to confirm.
//    (The scoring side of that is apps/analysis/rubrics.time_adherence.)
// 2. You couldn't see what you were saying until the analysis came back.
//    Captions now stream live, from the browser's own recogniser — the same
//    approach the practice engine uses, so nothing extra crosses the network.
import { useState } from 'react'

import { Recorder, useRecorder } from '../../../components/Recorder'
import { Button, Icon, Pill } from '../../../components/primitives'
import { useSpeechRecognition } from '../../../lib/useSpeechRecognition'

// Below this share of the target, we ask whether they meant to stop.
export const SHORT_RATIO = 0.6

export const formatTime = (total) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`

const DEFAULT_LABELS = {
  idle: "Record your answer when you're ready.",
  ready: 'Happy with that take? Submit it for scoring.',
  submit: 'Submit response',
}

export function VoiceInterface({ session, onSubmit, isSubmitting, labels = DEFAULT_LABELS }) {
  const copy = { ...DEFAULT_LABELS, ...labels }
  const target = session.target_seconds
  const recorder = useRecorder()
  const speech = useSpeechRecognition()
  const [confirmingShort, setConfirmingShort] = useState(false)

  const start = async () => {
    speech.reset()
    await recorder.start()
    speech.start()
    setConfirmingShort(false)
  }

  const stop = () => {
    recorder.stop()
    speech.stop()
  }

  const isShort = target ? recorder.seconds < target * SHORT_RATIO : false
  const progress = target ? Math.min(100, (recorder.seconds / target) * 100) : 0

  const handleSubmit = () => {
    if (isShort && !confirmingShort) {
      setConfirmingShort(true)
      return
    }
    onSubmit({ audioBlob: recorder.blob, durationSeconds: recorder.seconds })
  }

  return (
    <div>
      {target && (
        <div className="flex items-center gap-3 mb-4">
          <Pill tone="accent">Speak for {formatTime(target)}</Pill>
          <div className="flex-1 h-[3px] bg-rule rounded overflow-hidden">
            <div
              className={`h-full transition-all ${progress >= 85 ? 'bg-good' : 'bg-accent'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-ink-4">
            {Math.round(progress)}% of the time used
          </span>
        </div>
      )}

      <Recorder recorder={recorder} limitSeconds={target} onStart={start} onStop={stop} />

      {(recorder.isRecording || speech.finalTranscript) && (
        <div className="bg-paper-2 border border-rule rounded-[10px] p-4 mt-4 min-h-[88px]">
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-1.5">
            Live transcript
          </div>
          {speech.isSupported ? (
            <p className="text-[13.5px] text-ink-2 leading-relaxed">
              {speech.finalTranscript || <span className="text-ink-4">Listening…</span>}
              <span className="text-ink-4"> {speech.interimTranscript}</span>
            </p>
          ) : (
            <p className="text-[12.5px] text-ink-4 leading-relaxed">
              Live captions need Chrome or Edge. Your recording is still transcribed and scored the
              same way once you submit.
            </p>
          )}
        </div>
      )}

      {confirmingShort && (
        <div className="bg-paper-2 border border-warn rounded-[10px] p-4 mt-4">
          <div className="font-mono text-[10px] uppercase tracking-wide text-warn mb-1.5">
            That's {Math.round(progress)}% of the time you were given
          </div>
          <p className="text-[13px] text-ink-2 leading-relaxed">
            Holding the floor for the full {formatTime(target)} is part of what's being measured here —
            a short answer scores lower on structure and fluency however good the words were. Re-record
            if you've more to say. If you're done, submit and we'll score it honestly.
          </p>
        </div>
      )}

      <div className="flex items-center mt-8">
        <span className="text-[13px] text-ink-3">{recorder.blob ? copy.ready : copy.idle}</span>
        <div className="flex-1" />
        {recorder.blob && (
          <button
            type="button"
            onClick={() => {
              recorder.reset()
              speech.reset()
              setConfirmingShort(false)
            }}
            className="text-[13px] text-ink-2 px-4 py-2"
          >
            Re-record
          </button>
        )}
        <Button
          variant="accent"
          size="lg"
          icon={Icon.arrow}
          onClick={handleSubmit}
          disabled={!recorder.blob || recorder.isRecording || isSubmitting}
        >
          {isSubmitting ? 'Submitting…' : confirmingShort ? 'Submit it anyway' : copy.submit}
        </Button>
      </div>
    </div>
  )
}
