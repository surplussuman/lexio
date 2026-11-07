// The three report panels that exist because of how an answer was produced
// rather than what was in it: whether it was the student's own work, whether
// they used the time they were given, and — for presentations — what the
// camera and the slide clock saw.
import { EchoMascot, MetricBar, Pill } from '../../components/primitives'
import { PRESENCE_LABELS } from '../../lib/useCameraPresence'

const AUTHENTICITY_TONE = { own_work: 'good', unclear: 'warn', likely_assisted: 'bad' }
const AUTHENTICITY_HEADING = {
  own_work: 'This one was yours',
  unclear: 'Worth a second look',
  likely_assisted: 'This looks like it had help',
}

const TIMING_TONE = { on_target: 'good', under: 'warn', well_under: 'bad', over: 'warn' }
const TIMING_HEADING = {
  on_target: 'You used the time',
  under: 'You stopped a little early',
  well_under: 'You stopped well short',
  over: 'You ran over',
}

const formatClock = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`

/**
 * Authenticity is reported, never enforced: it doesn't move the score and the
 * panel says so out loud. See apps/analysis/authenticity.py.
 */
export function AuthenticityCard({ authenticity }) {
  if (!authenticity?.band) return null
  const tone = AUTHENTICITY_TONE[authenticity.band]

  return (
    <div className="bg-white border-2 border-rule rounded-[10px] p-5 mt-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-4">
          Plagiarism / AI check
        </span>
        <div className="flex-1" />
        <Pill tone={tone} size="sm">
          {authenticity.ai_likelihood}% AI-like
        </Pill>
      </div>

      <div className="font-ser text-[19px] mb-2" style={{ letterSpacing: -0.2 }}>
        {AUTHENTICITY_HEADING[authenticity.band]}
      </div>
      <p className="text-[13px] text-ink-2 leading-relaxed">{authenticity.message}</p>

      {authenticity.signals?.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {authenticity.signals.map((signal) => (
            <li key={signal} className="text-[12px] text-ink-3 flex gap-2">
              <span className="text-ink-4">·</span>
              {signal}
            </li>
          ))}
        </ul>
      )}

      <p className="font-mono text-[9.5px] text-ink-4 leading-relaxed mt-3 pt-3 border-t border-rule">
        {authenticity.disclaimer}
      </p>
    </div>
  )
}

/** How much of the allotted time was used, and what that cost. */
export function TimingCard({ timing }) {
  if (!timing?.band) return null
  const capped = Object.entries(timing.uncapped ?? {})

  return (
    <div className="bg-white border border-rule rounded-[10px] p-5 mt-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-4">Time used</span>
        <div className="flex-1" />
        <Pill tone={TIMING_TONE[timing.band]} size="sm">
          {timing.percent_used}%
        </Pill>
      </div>

      <div className="font-ser text-[19px] mb-1.5" style={{ letterSpacing: -0.2 }}>
        {TIMING_HEADING[timing.band]}
      </div>
      <p className="text-[13px] text-ink-2 leading-relaxed">
        You were given {formatClock(timing.target_seconds)} and spoke for{' '}
        {formatClock(timing.actual_seconds)}.
        {timing.band !== 'on_target' &&
          ' Developing an idea across the full time is part of what this measures, so it shows up in the score.'}
      </p>

      <div className="h-[4px] bg-rule rounded overflow-hidden mt-3">
        <div
          className={`h-full ${timing.band === 'on_target' ? 'bg-good' : 'bg-warn'}`}
          style={{ width: `${Math.min(100, timing.percent_used)}%` }}
        />
      </div>

      {capped.length > 0 && (
        <p className="font-mono text-[9.5px] text-ink-4 leading-relaxed mt-3 pt-3 border-t border-rule">
          Capped at {timing.ceiling}: {capped.map(([dimension, was]) => `${dimension} was ${was}`).join(', ')}
        </p>
      )}
    </div>
  )
}

const SLIDE_VERDICTS = {
  covered: { label: 'Covered', tone: 'good' },
  rushed: { label: 'Rushed', tone: 'warn' },
  dwelt: { label: 'Dwelt on', tone: 'warn' },
  shown_not_presented: { label: 'Barely spoken to', tone: 'warn' },
  skipped: { label: 'Never reached', tone: 'bad' },
}

/** Presentation only: the slide clock and the camera read, side by side. */
export function PresentationPanel({ coverage, visual }) {
  if (!coverage?.length && !visual?.samples) return null

  return (
    <div className="bg-white border border-rule rounded-[10px] p-6">
      <h2 className="font-ser text-[22px] font-normal mb-1">How you presented it</h2>
      <p className="text-[13px] text-ink-3 mb-5">
        Slide by slide, and what the camera saw. The camera signals were measured in your browser
        while you presented — no video was uploaded or kept.
      </p>

      <div className="grid grid-cols-[1fr_220px] gap-6 items-start">
        <div className="flex flex-col gap-2">
          {coverage.map((slide) => {
            const verdict = SLIDE_VERDICTS[slide.verdict] ?? SLIDE_VERDICTS.covered
            return (
              <div key={slide.index} className="border border-rule rounded-lg p-3.5">
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="font-mono text-[10px] text-ink-4">
                    {String(slide.index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[14px] text-ink leading-snug flex-1 truncate">{slide.title}</span>
                  <Pill tone={verdict.tone} size="sm">
                    {verdict.label}
                  </Pill>
                </div>
                <div className="font-mono text-[10.5px] text-ink-4 pl-7">
                  {slide.seconds ? `${formatClock(slide.seconds)} · ${slide.words} words` : 'no time spent'}
                  {slide.wpm ? ` · ${slide.wpm} wpm` : ''}
                </div>
              </div>
            )
          })}
        </div>

        <div>
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-3">Camera read</div>
          {visual?.reliable ? (
            <div className="flex flex-col gap-3">
              {Object.entries(PRESENCE_LABELS).map(([key, label]) =>
                visual[key] == null ? null : (
                  <MetricBar
                    key={key}
                    label={label}
                    value={visual[key]}
                    tone={visual[key] >= 70 ? 'good' : visual[key] >= 45 ? 'accent' : 'bad'}
                  />
                )
              )}
              <p className="font-mono text-[9.5px] text-ink-4 leading-relaxed mt-1">
                Visible on camera for {visual.face_seconds}s across {visual.samples} samples. These read
                framing and movement, not expression.
              </p>
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-4 leading-relaxed">
              {visual?.samples
                ? 'Too few camera samples to read your delivery — this run was scored on what you said.'
                : 'The camera wasn’t running, so this run was scored on what you said.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/** Shown when a baseline report is requested before all eight modes are done. */
export function ReportsLocked({ message, children }) {
  return (
    <div className="max-w-[560px] mx-auto px-8 py-24 text-center">
      <div className="flex justify-center mb-6">
        <EchoMascot size={64} />
      </div>
      <h1 className="font-ser text-3xl font-normal mb-3" style={{ letterSpacing: -0.6 }}>
        Not yet — finish the set first.
      </h1>
      <p className="text-ink-3 text-sm mb-7 leading-relaxed">
        {message} One assessment tells you about one assessment. Eight of them tell you something
        about how you communicate, and that's the report worth reading.
      </p>
      {children}
    </div>
  )
}
