// Post-practice summary: score, metrics, the coaching tips Echo gave live,
// and the annotated transcript — the M6 feedback shape applied to M5.
import { Link, useParams } from 'react-router-dom'

import { AppShell } from '../../components/AppShell'
import { Button, EchoMascot, Icon, MetricBar, Pill, Rule, ScoreRing } from '../../components/primitives'
import { usePracticeSession } from '../../lib/practiceApi'
import { AnnotatedTranscript } from '../feedback/AnnotatedTranscript'

const DIMENSION_LABELS = {
  fluency: 'Fluency & Pace', clarity: 'Clarity & Pronunciation', grammar: 'Grammar Accuracy',
  structure: 'Structure & Coherence', tone: 'Tone & Empathy', confidence: 'Confidence & Delivery',
  vocabulary: 'Vocabulary Range', listening: 'Active Listening',
}

function toneFor(value) {
  if (value >= 80) return 'good'
  if (value < 60) return 'bad'
  return 'accent'
}

export function PracticeSummaryPage() {
  const { sessionId } = useParams()
  const { data: session, isLoading } = usePracticeSession(sessionId)

  if (isLoading) {
    return (
      <AppShell>
        <p className="max-w-[900px] mx-auto px-8 py-16 text-ink-3 text-sm">Loading your summary…</p>
      </AppShell>
    )
  }

  if (session?.status === 'abandoned') {
    return (
      <AppShell>
        <div className="max-w-[560px] mx-auto px-8 py-24 text-center">
          <h1 className="font-ser text-3xl font-normal mb-3" style={{ letterSpacing: -0.6 }}>
            Nothing was captured in that session.
          </h1>
          <p className="text-ink-3 text-sm mb-6">
            {session.error || 'No speech came through, so there was nothing to score.'}
          </p>
          <Link to="/practice">
            <Button variant="accent" icon={Icon.arrow}>
              Try another session
            </Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  const metrics = session?.session_metrics ?? {}

  return (
    <AppShell>
      <div className="px-9 py-8 pb-14 grid grid-cols-[380px_1fr] gap-7 max-w-[1320px] mx-auto">
        <aside>
          <Pill tone="accent">◎ Practice · {session.session_type?.replace('_', ' ')}</Pill>
          <h1 className="font-ser text-[34px] font-normal leading-tight mt-3 mb-4" style={{ letterSpacing: -0.7 }}>
            {session.topic}
          </h1>

          <div className="bg-white border border-rule rounded-[10px] p-5">
            <div className="flex items-center gap-4">
              <ScoreRing value={session.overall_score ?? 0} size={104} />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4">Session score</div>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <Pill size="sm">+{session.xp_awarded} XP</Pill>
                  {session.question_count > 0 && <Pill size="sm">{session.question_count} questions</Pill>}
                </div>
              </div>
            </div>

            <Rule label="PER-DIMENSION" />
            <div className="flex flex-col gap-3">
              {Object.entries(session.dimension_scores ?? {}).map(([dimension, value]) => (
                <MetricBar
                  key={dimension}
                  label={DIMENSION_LABELS[dimension] ?? dimension}
                  value={value}
                  tone={toneFor(value)}
                />
              ))}
            </div>
          </div>

          {metrics.word_count > 0 && (
            <div className="bg-white border border-rule rounded-[10px] p-5 mt-3.5">
              <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-3">Delivery metrics</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Words / min', metrics.avg_wpm],
                  ['Filler words', metrics.filler_count],
                  ['Pauses', metrics.pause_count],
                  ['Words spoken', metrics.word_count],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="font-ser text-[22px] text-ink leading-none">{value ?? 0}</div>
                    <div className="font-mono text-[10px] text-ink-4 uppercase tracking-wide mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {session.narrative && (
            <div className="bg-paper-2 rounded-[10px] p-4 mt-3.5 flex gap-3 items-start">
              <EchoMascot size={40} />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-1">Echo's take</div>
                {session.narrative.split('\n\n').map((paragraph) => (
                  <p key={paragraph.slice(0, 32)} className="text-[13px] leading-relaxed text-ink-2 mb-2 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="flex flex-col gap-5">
          <AnnotatedTranscript transcript={session.transcript} annotations={session.annotations} />

          {session.coaching_nudges?.length > 0 && (
            <div className="bg-white border border-rule rounded-[10px] p-6">
              <h2 className="font-ser text-[22px] font-normal mb-1">Tips Echo gave you live</h2>
              <p className="text-[13px] text-ink-3 mb-4">
                These arrived mid-session, while you could still act on them.
              </p>
              <div className="flex flex-col">
                {session.coaching_nudges.map((nudge, index) => (
                  <div key={index} className="py-3 border-t border-rule first:border-t-0 flex gap-4">
                    <span className="font-mono text-[11px] text-ink-4 w-12">
                      {String(Math.floor(nudge.timestamp_s / 60)).padStart(2, '0')}:
                      {String(nudge.timestamp_s % 60).padStart(2, '0')}
                    </span>
                    <span className="text-[14px] text-ink-2 flex-1">{nudge.message}</span>
                    <span
                      className={`font-mono text-[10px] uppercase ${
                        nudge.severity === 'warn' ? 'text-warn' : 'text-good'
                      }`}
                    >
                      {nudge.dimension}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2.5 items-center">
            <Link to="/practice">
              <Button variant="secondary">Practise again</Button>
            </Link>
            <div className="flex-1" />
            <Link to="/path">
              <Button variant="accent" icon={Icon.arrow}>
                See your learning path
              </Button>
            </Link>
          </div>
        </main>
      </div>
    </AppShell>
  )
}
