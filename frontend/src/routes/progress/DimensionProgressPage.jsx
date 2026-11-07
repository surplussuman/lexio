// LLD §22.3 /progress/:dimension — a skill-specific timeline, distinct from
// the dashboard's composite chart, plus the §22.5 attribution records.
import { Link, useParams } from 'react-router-dom'

import { AppShell } from '../../components/AppShell'
import { Button, Icon, Pill, Rule } from '../../components/primitives'
import { useDimensionProgress } from '../../lib/progressApi'

const EVENT_LABELS = {
  content_started: 'Started',
  content_completed: 'Completed',
  module_mastered: 'Mastered',
  session_scored: 'Assessed',
}

export function DimensionProgressPage() {
  const { dimension } = useParams()
  const { data, isLoading, error } = useDimensionProgress(dimension)

  if (isLoading) {
    return (
      <AppShell>
        <p className="max-w-[820px] mx-auto px-8 py-16 text-ink-3 text-sm">Loading your timeline…</p>
      </AppShell>
    )
  }

  if (error) {
    return (
      <AppShell>
        <div className="max-w-[560px] mx-auto px-8 py-24 text-center">
          <h1 className="font-ser text-3xl font-normal mb-3">Couldn't load that dimension.</h1>
          <p className="text-ink-3 text-sm mb-6">{error.message}</p>
          <Link to="/dashboard">
            <Button variant="secondary">Back to dashboard</Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  const timeline = data.timeline ?? []
  const attributions = data.attributions ?? []

  return (
    <AppShell>
      <div className="max-w-[820px] mx-auto px-8 py-10">
        <Pill tone="accent">◎ {data.label}</Pill>
        <div className="flex items-end justify-between mt-3 mb-7">
          <h1 className="font-ser text-[38px] font-normal" style={{ letterSpacing: -0.8 }}>
            How this skill has moved.
          </h1>
          {data.current_score != null && (
            <div className="text-right">
              <div className="font-ser text-[44px] leading-none">{data.current_score}</div>
              <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mt-1">Current</div>
            </div>
          )}
        </div>

        {attributions.length > 0 && (
          <>
            <Rule label="WHAT MOVED, AND WHAT YOU'D STUDIED" />
            <div className="flex flex-col gap-2">
              {attributions.map((record, index) => (
                <div key={index} className="bg-white border border-rule rounded-[10px] px-5 py-4 flex items-center gap-4">
                  <span
                    className={`font-ser text-[26px] leading-none w-16 ${
                      record.delta > 0 ? 'text-good' : record.delta < 0 ? 'text-bad' : 'text-ink-4'
                    }`}
                  >
                    {record.delta > 0 ? '+' : ''}
                    {record.delta}
                  </span>
                  <div className="flex-1">
                    <div className="text-[14px] text-ink">
                      {record.score_before} → {record.score_after}
                    </div>
                    <div className="font-mono text-[10px] text-ink-4 uppercase tracking-wide mt-0.5">
                      after {record.resource_count} resource{record.resource_count === 1 ? '' : 's'} ·{' '}
                      {new Date(record.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* The LLD is emphatic that this must not read as proof. */}
            <p className="text-[12px] text-ink-4 leading-snug mt-3 max-w-[560px]">{data.caveat}</p>
          </>
        )}

        <Rule label="TIMELINE" />
        {timeline.length === 0 ? (
          <p className="text-[13.5px] text-ink-3">
            Nothing logged for this dimension yet. Take an assessment that measures it, or work
            through a module in your path.
          </p>
        ) : (
          <div className="flex flex-col">
            {timeline.map((event, index) => (
              <div key={index} className="flex gap-4 items-start py-3 border-t border-rule first:border-t-0">
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-4 w-20 mt-1">
                  {EVENT_LABELS[event.event_type] ?? event.event_type}
                </span>
                <span className="text-[14px] text-ink-2 flex-1">{event.label}</span>
                {event.score_at_event != null && (
                  <span className="font-ser text-[18px] text-ink">{event.score_at_event}</span>
                )}
                <span className="font-mono text-[10px] text-ink-4 w-20 text-right mt-1">
                  {new Date(event.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 flex items-center">
          <Link to="/dashboard">
            <Button variant="secondary">Back to dashboard</Button>
          </Link>
          <div className="flex-1" />
          <Link to="/path">
            <Button variant="accent" icon={Icon.arrow}>
              Work on this
            </Button>
          </Link>
        </div>
      </div>
    </AppShell>
  )
}
