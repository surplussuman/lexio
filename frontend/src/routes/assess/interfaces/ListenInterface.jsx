// Listening — the clip is spoken through the shared TTS pipeline (lib/tts.js:
// Sarvam's Indian-English female voice, browser speech synthesis only as the
// last-resort fallback), so it sounds like the AI personas elsewhere.
import { useEffect, useRef, useState } from 'react'

import { Rule } from '../../../components/primitives'
import { speakLine } from '../../../lib/tts'
import { QuestionList, QuestionSubmitBar, useAnswers } from './QuestionList'

const MAX_PLAYS = 2 // LLD §5.1 listening: "you can replay it once"

export function ListenInterface({ session, draft = {}, onDraftChange, onSubmit, isSubmitting }) {
  const { script = '', questions = [] } = session.prompt.payload ?? {}
  const { answers, setAnswer, answered } = useAnswers(questions.length, draft.answers, (next) =>
    onDraftChange?.({ answers: next })
  )
  const [plays, setPlays] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [notes, setNotes] = useState('')
  const speechRef = useRef(null)

  useEffect(() => () => speechRef.current?.cancel(), [])

  const play = () => {
    if (plays >= MAX_PLAYS) return
    speechRef.current?.cancel()
    speechRef.current = speakLine(script, { gender: 'female', seed: 'listening' }, {
      onEnd: () => setIsPlaying(false),
    })
    setIsPlaying(true)
    setPlays((count) => count + 1)
  }

  const stop = () => {
    speechRef.current?.cancel()
    setIsPlaying(false)
  }

  return (
    <div>
      <div className="bg-white border border-rule rounded-xl p-6 flex items-center gap-5">
        <button
          type="button"
          onClick={isPlaying ? stop : play}
          disabled={!isPlaying && plays >= MAX_PLAYS}
          aria-label={isPlaying ? 'Stop clip' : 'Play clip'}
          className="w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center disabled:opacity-40"
        >
          {isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 4l13 8-13 8V4z" />
            </svg>
          )}
        </button>
        <div className="flex-1">
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-1">Audio briefing</div>
          <div className="text-[13.5px] text-ink-2">
            {isPlaying
              ? 'Playing — take notes as you listen.'
              : `${MAX_PLAYS - plays} play${MAX_PLAYS - plays === 1 ? '' : 's'} remaining.`}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label className="font-mono text-[10px] uppercase tracking-wide text-ink-4 block mb-1.5" htmlFor="listen-notes">
          Your notes (not scored — just for you)
        </label>
        <textarea
          id="listen-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="lx-input w-full min-h-[90px] resize-y"
          placeholder="Jot down what you hear…"
        />
      </div>

      <Rule label="QUESTIONS" />
      <QuestionList questions={questions} answers={answers} onAnswer={setAnswer} />
      <QuestionSubmitBar
        answered={answered}
        total={questions.length}
        isSubmitting={isSubmitting}
        onSubmit={() => onSubmit({ answers })}
      />
    </div>
  )
}
