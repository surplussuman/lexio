// /report — the overview across all eight baseline assessments.
//
// This is what the per-assessment reports now sit underneath. A single mode's
// score is a data point; this is the first thing that's actually a picture of
// the student, which is why it's what unlocks rather than the individual runs.
import { Link } from 'react-router-dom'

import { AppShell } from '../../components/AppShell'
import { Button, EchoMascot, Icon, MetricBar, Pill, Rule, ScoreRing } from '../../components/primitives'
import { useBaselineReport } from '../../lib/assessmentApi'
import { ReportsLocked } from '../feedback/FeedbackCards'

const MODE_NAMES = {
  speak: 'Speaking', present: 'Presentation', write: 'Writing', vocab: 'Vocabulary',
  grammar: 'Grammar', read: 'Reading Comprehension', listen: 'Listening', gd: 'Group Discussion',
}

const AUTHENTICITY_FLAGS = {
  unclear: { label: 'AI check: worth a look', tone: 'warn' },
  likely_assisted: { label: 'AI check: had help?', tone: 'bad' },
}

const TIMING_FLAGS = {
  under: { label: 'Stopped early', tone: 'warn' },
  well_under: { label: 'Well short', tone: 'bad' },
  over: { label: 'Ran over', tone: 'warn' },
}

function toneFor(value) {
  if (value >= 80) return 'good'
  if (value < 60) return 'bad'
  return 'accent'
}

export function BaselineReportPage() {
  const { data, isLoading, error } = useBaselineReport()

  if (isLoading) {
    return (
      <AppShell>
        <p className="max-w-[900px] mx-auto px-8 py-16 text-ink-3 text-sm">Pulling your results together…</p>
      </AppShell>
    )
  }

  if (error) {
    return (
      <AppShell>
        <div className="max-w-[560px] mx-auto px-8 py-24 text-center">
          <h1 className="font-ser text-3xl font-normal mb-3">Couldn't load your report.</h1>
          <p className="text-ink-3 text-sm">{error.message}</p>
        </div>
      </AppShell>
    )
  }

  if (!data.baseline_complete) {
    const left = data.modes_total - data.modes_completed
    return (
      <AppShell>
        <ReportsLocked
          message={`You've done ${data.modes_completed} of ${data.modes_total}. ${left} to go.`}
        >
          <Link to="/onboarding">
            <Button variant="accent" icon={Icon.arrow}>
              Continue your assessments
            </Button>
          </Link>
        </ReportsLocked>
      </AppShell>
    )
  }

  const report = data.report
  const labels = report.dimension_labels

  return (
    <AppShell>
      <div className="max-w-[1100px] mx-auto px-8 py-12 pb-16">
        <Pill tone="accent">◎ Baseline complete</Pill>
        <h1 className="font-ser text-[44px] font-normal leading-[1.05] mt-3 mb-3" style={{ letterSpacing: -0.9 }}>
          Here's where you <em className="text-accent">actually</em> stand.
        </h1>
        <p className="text-[15px] text-ink-3 max-w-[640px] leading-relaxed mb-8">
          Eight assessments, one picture. Every per-assessment report is unlocked below — but read
          this first, because the pattern across them is the part no single one could show you.
        </p>

        <div className="grid grid-cols-[320px_1fr] gap-6 items-start">
          <div>
            <div className="bg-white border border-rule rounded-[10px] p-6 flex flex-col items-center">
              <ScoreRing value={report.overall_score} size={140} />
              <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mt-4">
                Composite score
              </div>
            </div>

            <div className="bg-white border border-rule rounded-[10px] p-5 mt-3.5">
              <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-3">
                All eight dimensions
              </div>
              <div className="flex flex-col gap-3">
                {Object.entries(report.dimension_scores).map(([dimension, value]) => (
                  <Link key={dimension} to={`/progress/${dimension}`}>
                    <MetricBar label={labels[dimension] ?? dimension} value={value} tone={toneFor(value)} />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div>
            {report.narrative && (
              <div className="bg-paper-2 rounded-[10px] p-6 flex gap-4 items-start">
                <EchoMascot size={48} talking />
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-2">
                    Echo's read on all eight
                  </div>
                  {report.narrative.split('\n\n').map((paragraph) => (
                    <p key={paragraph.slice(0, 32)} className="text-[14px] leading-[1.75] text-ink-2 mb-3 last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3.5 mt-3.5">
              <Highlights title="Your strengths" rows={report.strongest} tone="good" />
              <Highlights title="Where the gains are" rows={report.weakest} tone="bad" />
            </div>

            <Rule label="EVERY ASSESSMENT · TAP FOR THE FULL REPORT" />
            <div className="grid grid-cols-2 gap-3">
              {report.sessions.map((row) => {
                const authenticity = AUTHENTICITY_FLAGS[row.authenticity_band]
                const timing = TIMING_FLAGS[row.timing_band]
                return (
                  <Link
                    key={row.session_id}
                    to={`/feedback/${row.session_id}`}
                    className="bg-white border border-rule rounded-[10px] p-4 flex items-center gap-4 hover:border-accent transition-colors"
                  >
                    <ScoreRing value={row.overall_score} size={52} stroke={5} />
                    <div className="flex-1 min-w-0">
                      <div className="font-ser text-[17px]" style={{ letterSpacing: -0.2 }}>
                        {MODE_NAMES[row.mode] ?? row.mode_name}
                      </div>
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {timing && (
                          <Pill tone={timing.tone} size="sm">
                            {timing.label}
                          </Pill>
                        )}
                        {authenticity && (
                          <Pill tone={authenticity.tone} size="sm">
                            {authenticity.label}
                          </Pill>
                        )}
                      </div>
                    </div>
                    <span className="text-accent">{Icon.arrow}</span>
                  </Link>
                )
              })}
            </div>

            <div className="flex gap-2.5 items-center mt-6">
              <Link to="/dashboard">
                <Button variant="secondary">Back to dashboard</Button>
              </Link>
              <div className="flex-1" />
              <Link to="/path">
                <Button variant="accent" icon={Icon.arrow}>
                  Start your learning path
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

// Written out rather than interpolated — Tailwind only emits classes it can
// see as literal strings, so `text-${tone}` would produce no colour at all.
const HIGHLIGHT_TONE = { good: 'text-good', bad: 'text-bad' }

function Highlights({ title, rows, tone }) {
  return (
    <div className="bg-white border border-rule rounded-[10px] p-5">
      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-3">{title}</div>
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <div key={row.dimension} className="flex items-baseline gap-2">
            <span className={`font-ser text-[20px] ${HIGHLIGHT_TONE[tone]}`} style={{ letterSpacing: -0.3 }}>
              {row.score}
            </span>
            <span className="text-[13px] text-ink-2">{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
