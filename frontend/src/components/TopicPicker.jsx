// Up to three domains, chosen once at first login and changeable any time
// from the profile page. Every generated assessment prompt is written against
// these (backend: apps/assessments/generation.py), so this is the single input
// that decides what the student spends the next eight assessments talking
// about.
import { useEffect, useState } from 'react'

import { useTopics, useUpdateProfile } from '../lib/authApi'
import { Button, Modal, Pill } from './primitives'

const OTHER_PREFIX = 'other:'

/** Shared between the first-login modal and the profile page, so the two can't
 *  drift apart on the selection rules. */
export function TopicGrid({ topics, selected, onToggle, max }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {topics.map((topic) => {
        const isSelected = selected.includes(topic.id)
        const isFull = selected.length >= max && !isSelected
        return (
          <button
            key={topic.id}
            type="button"
            onClick={() => onToggle(topic.id)}
            disabled={isFull}
            aria-pressed={isSelected}
            className={`text-left rounded-[10px] border p-3 transition-colors ${
              isSelected ? 'border-accent bg-accent-soft' : 'border-rule bg-white hover:border-accent'
            } ${isFull ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <div className="text-[13.5px] font-semibold text-ink">{topic.label}</div>
            <div className="text-[11px] text-ink-4 leading-snug mt-0.5">{topic.blurb}</div>
          </button>
        )
      })}
    </div>
  )
}

/**
 * The picker body. `onSaved` fires after the preferences persist.
 * `compact` drops the heading for use inside the profile page.
 */
export function TopicPicker({ onSaved, compact = false }) {
  const { data, isLoading } = useTopics()
  const updateProfile = useUpdateProfile()
  const [selected, setSelected] = useState([])
  const [custom, setCustom] = useState('')
  const [error, setError] = useState(null)

  const max = data?.max_topics ?? 3
  const topics = data?.topics ?? []

  useEffect(() => {
    if (data?.selected) setSelected(data.selected)
  }, [data])

  const toggle = (id) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((topic) => topic !== id)
        : current.length >= max
          ? current
          : [...current, id]
    )

  const addCustom = () => {
    const value = custom.trim()
    if (!value || selected.length >= max) return
    setSelected((current) => [...current, `${OTHER_PREFIX}${value}`])
    setCustom('')
  }

  const save = async () => {
    setError(null)
    try {
      await updateProfile.mutateAsync({ topic_preferences: selected })
      onSaved?.(selected)
    } catch (err) {
      setError(err.message)
    }
  }

  const customChoices = selected.filter((topic) => topic.startsWith(OTHER_PREFIX))

  if (isLoading) return <p className="text-ink-3 text-sm">Loading topics…</p>

  return (
    <div>
      {!compact && (
        <p className="text-[14.5px] text-ink-2 leading-[1.7] mb-5">
          Pick up to {max}. Every question you get — the speaking prompts, the passages, the
          slides you'll present — gets written around these, so choose what you'd actually
          have something to say about.
        </p>
      )}

      <TopicGrid topics={topics} selected={selected} onToggle={toggle} max={max} />

      <div className="mt-4">
        <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-2">
          Something else?
        </div>
        <div className="flex gap-2">
          <input
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), addCustom())}
            placeholder="e.g. Carnatic music, motorsport, archaeology"
            maxLength={40}
            disabled={selected.length >= max}
            className="lx-input flex-1"
          />
          <Button variant="secondary" onClick={addCustom} disabled={!custom.trim() || selected.length >= max}>
            Add
          </Button>
        </div>
      </div>

      {customChoices.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {customChoices.map((topic) => (
            <button key={topic} type="button" onClick={() => toggle(topic)} title="Remove">
              <Pill tone="accent">{topic.slice(OTHER_PREFIX.length)} ✕</Pill>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-bad text-sm mt-3">{error}</p>}

      <div className="flex items-center gap-4 mt-6">
        <span className="font-mono text-[11px] text-ink-4">
          {selected.length} of {max} chosen
        </span>
        <div className="flex-1" />
        <Button
          variant="accent"
          size="lg"
          onClick={save}
          disabled={selected.length === 0 || updateProfile.isPending}
        >
          {updateProfile.isPending ? 'Saving…' : compact ? 'Save topics' : 'Start my assessments'}
        </Button>
      </div>
    </div>
  )
}

/** First-login wrapper. Nothing else is reachable until they've chosen — the
 *  assessments literally cannot be written without this. */
export function TopicPickerModal({ onSaved }) {
  return (
    <Modal labelledBy="topics-title" width={620}>
      <div className="p-9">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4 mb-4">
          One quick thing
        </div>
        <h2 id="topics-title" className="font-ser text-[30px] leading-[1.15] mb-4" style={{ letterSpacing: -0.6 }}>
          What do you want to <em className="text-accent">talk about</em>?
        </h2>
        <TopicPicker onSaved={onSaved} />
      </div>
    </Modal>
  )
}
