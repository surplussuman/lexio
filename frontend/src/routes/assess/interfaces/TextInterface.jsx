import { useEffect, useState } from 'react'

import { Button, Icon } from '../../../components/primitives'

const LIMIT_SECONDS = 15 * 60 // LLD §5.1: writing is a 15-minute task

export function TextInterface({ draft = {}, onDraftChange, onSubmit, isSubmitting }) {
  // Seeded from the saved draft, so walking away mid-sentence costs nothing.
  const [text, setText] = useState(draft.text ?? '')
  const [remaining, setRemaining] = useState(LIMIT_SECONDS)

  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  const update = (value) => {
    setText(value)
    onDraftChange?.({ text: value })
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0')
  const seconds = String(remaining % 60).padStart(2, '0')

  return (
    <div>
      <div className="bg-white border border-rule rounded-xl overflow-hidden">
        <div className="flex justify-between items-center px-5 py-3 border-b border-rule">
          <span className="font-mono text-[10px] uppercase tracking-wide text-ink-4">Your response</span>
          <div className="flex gap-4 items-center">
            <span className="font-mono text-[11px] text-ink-3">{words} words</span>
            <span className={`font-mono text-[13px] ${remaining < 60 ? 'text-bad' : 'text-ink'}`}>
              {minutes}:{seconds}
            </span>
          </div>
        </div>
        <textarea
          value={text}
          onChange={(event) => update(event.target.value)}
          onPaste={(event) => event.preventDefault()}
          aria-label="Your response"
          placeholder="Start writing…"
          className="w-full min-h-[340px] p-5 text-[15px] leading-relaxed text-ink outline-none resize-y font-sans"
        />
      </div>

      <div className="flex items-center mt-8">
        <span className="text-[13px] text-ink-3">
          Take the time you need — the timer is a guide, not a cut-off. Pasting is off here; this
          is meant to be written, not assembled.
        </span>
        <div className="flex-1" />
        <Button
          variant="accent"
          size="lg"
          icon={Icon.arrow}
          onClick={() => onSubmit({ text })}
          disabled={words === 0 || isSubmitting}
        >
          {isSubmitting ? 'Submitting…' : 'Submit response'}
        </Button>
      </div>
    </div>
  )
}
