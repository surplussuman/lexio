// LLD §9 /feedback/:session_id. Layout ported from the prototype's DFeedback
// (design_extracted/lexio/desktop2.jsx): score column on the left, annotated
// transcript on the right.
import { Link, useParams } from 'react-router-dom'

import { AppShell } from '../../components/AppShell'
import { Button, EchoMascot, Icon, MetricBar, Pill, Rule, ScoreRing } from '../../components/primitives'
import { useFeedback } from '../../lib/assessmentApi'
import { AnnotatedTranscript } from './AnnotatedTranscript'
import { AuthenticityCard, PresentationPanel, ReportsLocked, TimingCard } from './FeedbackCards'

const MODE_NAMES = {
  speak: 'Speaking', present: 'Presentation', write: 'Writing', vocab: 'Vocabulary',
  grammar: 'Grammar', read: 'Reading Comprehension', listen: 'Listening', gd: 'Group Discussion',
}

function toneFor(value) {
  if (value >= 80) return 'good'
  if (value < 60) return 'bad'
  return 'accent'
}

export function FeedbackPage() {
  const { sessionId } = useParams()
  const { data, isLoading, error } = useFeedback(sessionId)

  if (isLoading) {
    return (
      <AppShell>
        <p className="max-w-[900px] mx-auto px-8 py-16 text-ink-3 text-sm">Loading your feedback…</p>
      </AppShell>
    )
  }
  if (error?.code === 'reports_locked') {
    return (
      <AppShell>
        <ReportsLocked message={error.message}>
          <Link to="/onboarding">
            <Button variant="accent" icon={Icon.arrow}>
              Back to your assessments
            </Button>
          </Link>
        </ReportsLocked>
      </AppShell>
    )
  }
  if (error) {
    return (
      <AppShell>
        <div className="max-w-[560px] mx-auto px-8 py-24 text-center">
          <h1 className="font-ser text-3xl font-normal mb-3">Couldn't load this feedback.</h1>
          <p className="text-ink-3 text-sm mb-6">{error.message}</p>
          <Link to="/onboarding">
            <Button variant="secondary">Back to all modes</Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  const { session, score, annotations, transcript, delta, dimension_labels: labels } = data
  const isObjective = score.answer_breakdown?.length > 0
  const audio = score.audio_features ?? {}

  return (
    <AppShell>
      <div className="px-9 py-8 pb-14 grid grid-cols-[380px_1fr] gap-7 max-w-[1320px] mx-auto">
        <aside>
          <Pill tone="accent">◎ {MODE_NAMES[session.mode] ?? session.mode}</Pill>
          <h1 className="font-ser text-[38px] font-normal leading-[1.05] mt-3 mb-3.5" style={{ letterSpacing: -0.8 }}>
            {score.overall_score >= 80
              ? 'Strong work — let\'s push the edges.'
              : score.overall_score >= 60
                ? 'A solid base — here\'s what to sharpen.'
                : 'Good start. Here\'s where the gains are.'}
          </h1>

          <div className="bg-white border border-rule rounded-[10px] p-5">
            <div className="flex items-center gap-4.5">
              <ScoreRing value={score.overall_score} size={104} />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4">Session score</div>
                <div className="font-ser text-[26px] mt-0.5" style={{ letterSpacing: -0.3 }}>
                  {delta ? `${delta.overall >= 0 ? '+' : ''}${delta.overall} vs last` : 'First run'}
                </div>
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {delta && (
                    <Pill tone={delta.overall >= 0 ? 'good' : 'neutral'} size="sm">
                      {delta.overall >= 0 ? '▲' : '▼'} {Math.abs(delta.overall)}
                    </Pill>
                  )}
                  {session.duration_seconds > 0 && <Pill size="sm">{Math.round(session.duration_seconds / 60) || 1} min</Pill>}
                  <Pill size="sm">+50 XP</Pill>
                </div>
              </div>
            </div>

            <Rule label="PER-DIMENSION" />
            <div className="flex flex-col gap-3">
              {Object.entries(score.dimension_scores).map(([dimension, value]) => (
                <MetricBar key={dimension} label={labels[dimension] ?? dimension} value={value} tone={toneFor(value)} />
              ))}
            </div>
          </div>

          {/* Whether it was actually yours sits right under the score itself —
              this used to be the last card in the column and was easy to
              scroll past entirely. */}
          <AuthenticityCard authenticity={score.authenticity} />

          {audio.word_count > 0 && (
            <div className="bg-white border border-rule rounded-[10px] p-5 mt-3.5">
              <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-3">Delivery metrics</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Words / min', audio.wpm],
                  ['Filler words', audio.filler_count],
                  ['Pauses > 0.8s', audio.pause_count],
                  ['Words spoken', audio.word_count],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="font-ser text-[22px] text-ink leading-none">{value}</div>
                    <div className="font-mono text-[10px] text-ink-4 uppercase tracking-wide mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <TimingCard timing={score.timing} />

          {score.narrative && (
            <div className="bg-paper-2 rounded-[10px] p-4.5 mt-3.5 flex gap-3 items-start">
              <EchoMascot size={40} />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-1">Echo's take</div>
                {score.narrative.split('\n\n').map((paragraph) => (
                  <p key={paragraph.slice(0, 32)} className="text-[13px] leading-relaxed text-ink-2 mb-2 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="flex flex-col gap-5">
          {isObjective ? (
            <AnswerReview breakdown={score.answer_breakdown} />
          ) : (
            <AnnotatedTranscript transcript={transcript} annotations={annotations} />
          )}

          {session.mode === 'present' && (
            <PresentationPanel coverage={score.slide_coverage} visual={score.visual_metrics} />
          )}

          {data.resources?.length > 0 && <Recommendations recommendations={data.resources} labels={labels} />}

          <div className="flex gap-2.5 items-center">
            <Link to="/dashboard">
              <Button variant="secondary">Back to dashboard</Button>
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

// LLD §9.2 ResourceRecommendations — "picked for what you lacked".
function Recommendations({ recommendations, labels }) {
  return (
    <div className="bg-white border border-rule rounded-[10px] p-6">
      <h2 className="font-ser text-[22px] font-normal mb-1">Picked for what you lacked</h2>
      <p className="text-[13px] text-ink-3 mb-4">
        Chosen for your weakest dimensions in this session, and the specific issues Echo flagged.
      </p>
      <div className="grid grid-cols-3 gap-3.5">
        {recommendations.map(({ id, dimension, resource }) => (
          <a
            key={id}
            href={resource.url || '#'}
            target={resource.url ? '_blank' : undefined}
            rel="noreferrer"
            className="border border-rule rounded-lg overflow-hidden flex flex-col hover:border-accent transition-colors"
          >
            {resource.thumbnail_url ? (
              <img src={resource.thumbnail_url} alt="" className="w-full aspect-video object-cover" />
            ) : (
              <div className="w-full aspect-video bg-paper-2 flex items-center justify-center font-mono text-[10px] uppercase tracking-wide text-ink-4">
                {resource.type}
              </div>
            )}
            <div className="p-3.5 flex flex-col gap-2 flex-1">
              <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] text-ink-4 uppercase tracking-wide truncate">
                  {resource.source}
                </span>
                <Pill tone="accent" size="sm">
                  {labels[dimension] ?? dimension}
                </Pill>
              </div>
              <div className="font-ser text-[16px] leading-tight flex-1" style={{ letterSpacing: -0.2 }}>
                {resource.title}
              </div>
              <span className="font-mono text-[11px] text-ink-4">{resource.duration_minutes} min</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

function AnswerReview({ breakdown }) {
  const correct = breakdown.filter((item) => item.is_correct).length
  return (
    <div className="bg-white border border-rule rounded-[10px] p-6">
      <div className="flex justify-between items-baseline mb-4">
        <h2 className="font-ser text-[22px] font-normal">Answer review</h2>
        <span className="font-mono text-[11px] text-ink-3">
          {correct} / {breakdown.length} correct
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {breakdown.map((item, index) => (
          <div
            key={item.question}
            className={`rounded-md border p-3.5 ${item.is_correct ? 'border-rule bg-paper' : 'border-rule bg-annotation-grammar'}`}
          >
            <div className="flex gap-2.5">
              <span className="font-mono text-[11px] text-ink-4 mt-0.5">{String(index + 1).padStart(2, '0')}</span>
              <div className="flex-1">
                <div className="text-[14px] text-ink leading-snug">{item.question}</div>
                <div className="text-[12.5px] mt-1.5 text-ink-3">
                  {item.is_correct ? (
                    <span className="text-good">✓ {item.options[item.answer]}</span>
                  ) : (
                    <>
                      <span className="text-bad">
                        ✕ {item.given != null ? item.options[item.given] : 'No answer'}
                      </span>
                      <span className="text-good ml-3">✓ {item.options[item.answer]}</span>
                    </>
                  )}
                </div>
                {!item.is_correct && item.explanation && (
                  <div className="text-[12.5px] text-ink-2 mt-1.5">{item.explanation}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
