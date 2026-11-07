// One content item inside a module: embedded video, or an in-app micro-lesson.
import { useState } from 'react'

import { Button, Icon, Pill } from '../../components/primitives'

export function ResourceCard({ item, onComplete, isCompleting }) {
  const { resource } = item
  const [open, setOpen] = useState(false)
  const done = item.status === 'complete'

  return (
    <div className={`bg-white border rounded-[10px] overflow-hidden ${done ? 'border-good' : 'border-rule'}`}>
      <div className="p-5 flex items-start gap-4">
        <span className="w-9 h-9 rounded-lg bg-accent-soft flex items-center justify-center flex-shrink-0 text-accent">
          {resource.type === 'video' ? Icon.video : Icon.book}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-wide text-ink-4">{resource.source}</span>
            {done && (
              <Pill tone="good" size="sm">
                Done
              </Pill>
            )}
          </div>
          <div className="font-ser text-[18px] leading-tight" style={{ letterSpacing: -0.2 }}>
            {resource.title}
          </div>
          {resource.summary && <p className="text-[13px] text-ink-3 mt-1.5 leading-snug">{resource.summary}</p>}
          <div className="flex gap-3 items-center mt-3">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="text-[13px] text-accent font-medium"
            >
              {open ? 'Close' : resource.type === 'video' ? 'Watch here' : 'Read lesson'}
            </button>
            <span className="font-mono text-[11px] text-ink-4">{resource.duration_minutes} min</span>
            <div className="flex-1" />
            {!done && (
              <Button size="sm" variant="secondary" onClick={onComplete} disabled={isCompleting}>
                Mark complete
              </Button>
            )}
          </div>
        </div>
      </div>

      {open && (
        <div className="border-t border-rule p-5 bg-paper">
          {resource.type === 'video' && resource.youtube_id ? (
            <div className="aspect-video w-full">
              <iframe
                className="w-full h-full rounded-md"
                src={`https://www.youtube.com/embed/${resource.youtube_id}`}
                title={resource.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <article className="max-w-[640px]">
              {(resource.body?.sections ?? []).map((section) => (
                <section key={section.heading} className="mb-4 last:mb-0">
                  <h3 className="font-ser text-[19px] mb-1.5" style={{ letterSpacing: -0.2 }}>
                    {section.heading}
                  </h3>
                  <p className="text-[14px] leading-[1.7] text-ink-2">{section.text}</p>
                </section>
              ))}
              {!resource.body?.sections?.length && resource.url && (
                <a href={resource.url} target="_blank" rel="noreferrer" className="text-accent text-[14px]">
                  Open original ↗
                </a>
              )}
            </article>
          )}
        </div>
      )}
    </div>
  )
}
