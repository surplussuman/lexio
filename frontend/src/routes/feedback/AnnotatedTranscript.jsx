// LLD §9.2/§9.3 — transcript with colour-coded inline annotations, numbered,
// click to see the full explanation. Ported from the prototype's
// DFeedback annotated transcript (design_extracted/lexio/desktop2.jsx).
import { useState } from 'react'

export const ANNOTATION_STYLES = {
  filler: { label: 'filler', className: 'bg-annotation-filler' },
  grammar: { label: 'grammar', className: 'bg-annotation-grammar' },
  hedge: { label: 'hedge', className: 'bg-annotation-hedge' },
  strong: { label: 'strong moment', className: 'bg-annotation-strong' },
  structure_gap: { label: 'structure', className: 'bg-annotation-structure' },
}

/** Splits the transcript into plain and annotated segments. Overlapping or
 *  out-of-range spans are skipped so a bad span can never scramble the text. */
function segment(transcript, annotations) {
  const sorted = [...annotations]
    .filter((a) => a.span_start >= 0 && a.span_end <= transcript.length && a.span_start < a.span_end)
    .sort((a, b) => a.span_start - b.span_start)

  const segments = []
  let cursor = 0
  sorted.forEach((annotation, index) => {
    if (annotation.span_start < cursor) return // overlaps the previous one
    if (annotation.span_start > cursor) {
      segments.push({ text: transcript.slice(cursor, annotation.span_start) })
    }
    segments.push({ text: transcript.slice(annotation.span_start, annotation.span_end), annotation, number: index + 1 })
    cursor = annotation.span_end
  })
  if (cursor < transcript.length) segments.push({ text: transcript.slice(cursor) })
  return segments
}

export function AnnotatedTranscript({ transcript, annotations }) {
  const [selected, setSelected] = useState(null)
  const segments = segment(transcript || '', annotations || [])

  return (
    <div className="bg-white border border-rule rounded-[10px] p-6">
      <div className="flex justify-between items-baseline mb-3.5 flex-wrap gap-2">
        <h2 className="font-ser text-[22px] font-normal">Annotated transcript</h2>
        <div className="flex gap-3 font-mono text-[11px] text-ink-3 flex-wrap">
          {Object.entries(ANNOTATION_STYLES).map(([type, style]) => (
            <span key={type} className="inline-flex items-center gap-1">
              <span className={`inline-block w-2.5 h-2.5 ${style.className}`} />
              {style.label}
            </span>
          ))}
        </div>
      </div>

      <p className="text-[15.5px] leading-[1.85] text-ink">
        {segments.map((seg, index) => {
          if (!seg.annotation) return <span key={index}>{seg.text}</span>
          const style = ANNOTATION_STYLES[seg.annotation.type] ?? ANNOTATION_STYLES.filler
          return (
            <button
              key={index}
              type="button"
              onClick={() => setSelected(selected?.number === seg.number ? null : { ...seg.annotation, number: seg.number })}
              className={`${style.className} rounded-sm px-1 cursor-pointer`}
            >
              {seg.text}
              <sup className="font-mono text-[10px] text-ink-4 ml-0.5">{seg.number}</sup>
            </button>
          )
        })}
      </p>

      {selected && (
        <div className="mt-4 p-3.5 bg-paper rounded-md border border-rule">
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4">
            Annotation {selected.number} · {ANNOTATION_STYLES[selected.type]?.label ?? selected.type}
          </div>
          <div className="text-[13px] text-ink-2 mt-1.5 leading-relaxed">{selected.message}</div>
        </div>
      )}

      {!annotations?.length && (
        <p className="text-[13px] text-ink-4 mt-4">No annotations were flagged for this response.</p>
      )}
    </div>
  )
}
