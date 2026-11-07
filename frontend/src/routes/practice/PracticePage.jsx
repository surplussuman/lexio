// LLD §16.2 /practice — the session launcher.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { AppShell } from '../../components/AppShell'
import { Button, Icon, Pill, Rule } from '../../components/primitives'
import { usePracticeHistory, useSessionTypes, useStartPractice } from '../../lib/practiceApi'

const TYPE_ICONS = {
  mock_interview: '🎤',
  impromptu: '⏱',
  debate: '👥',
  presentation: '📊',
  writing_drill: '✍',
}

export function PracticePage() {
  const navigate = useNavigate()
  const { data: typesData, isLoading } = useSessionTypes()
  const { data: historyData } = usePracticeHistory()
  const startPractice = useStartPractice()
  const [topic, setTopic] = useState('')
  const [error, setError] = useState(null)

  const launch = async (sessionType) => {
    setError(null)
    try {
      const result = await startPractice.mutateAsync({ sessionType, topic: topic.trim() })
      navigate(`/practice/${result.session.id}`, { state: { openingLine: result.opening_line } })
    } catch (err) {
      setError(err.message)
    }
  }

  const sessions = (historyData?.results ?? []).filter((s) => s.status === 'complete')

  return (
    <AppShell>
      <div className="max-w-[900px] mx-auto px-8 py-10">
        <Pill tone="accent">◎ Practice</Pill>
        <h1 className="font-ser text-[40px] font-normal mt-3 mb-2" style={{ letterSpacing: -0.8 }}>
          Practise with a coach who's actually listening.
        </h1>
        <p className="text-[15px] text-ink-3 max-w-[600px] leading-relaxed mb-7">
          Echo follows you live — captions as you speak, coaching tips while there's still time to use
          them, and a full score at the end that feeds your learning path.
        </p>

        <label className="flex flex-col gap-1.5 max-w-[560px] mb-6">
          <span className="font-mono text-[10px] uppercase tracking-wide text-ink-4">
            Topic (optional — we'll pick one if you leave it blank)
          </span>
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            className="lx-input"
            placeholder="e.g. Tell me about a time you led a team"
          />
        </label>

        {error && <p className="text-bad text-sm mb-4">{error}</p>}
        {isLoading && <p className="text-ink-3 text-sm">Loading session types…</p>}

        <div className="grid grid-cols-2 gap-3">
          {(typesData?.session_types ?? []).map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => launch(type.id)}
              disabled={startPractice.isPending}
              className="bg-white border border-rule rounded-[10px] p-5 flex items-start gap-4 text-left hover:border-accent transition-colors disabled:opacity-60"
            >
              <span className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center text-lg flex-shrink-0">
                {TYPE_ICONS[type.id] ?? '◎'}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-ser text-[19px]" style={{ letterSpacing: -0.2 }}>
                    {type.title}
                  </span>
                  {type.multi_turn && (
                    <Pill size="sm" tone="accent">
                      Multi-turn
                    </Pill>
                  )}
                </div>
                <div className="text-[12.5px] text-ink-3 leading-snug mt-1">{type.blurb}</div>
              </div>
              <span className="text-accent">{Icon.arrow}</span>
            </button>
          ))}
        </div>

        {sessions.length > 0 && (
          <>
            <Rule label="PAST PRACTICE" />
            <div className="flex flex-col gap-2">
              {sessions.slice(0, 8).map((session) => (
                <Link
                  key={session.id}
                  to={`/practice/${session.id}/summary`}
                  className="bg-white border border-rule rounded-[10px] px-5 py-4 flex items-center gap-4 hover:border-accent transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-ser text-[18px]">{session.topic || session.session_type}</div>
                    <div className="font-mono text-[10px] text-ink-4 uppercase tracking-wide mt-0.5">
                      {session.session_type.replace('_', ' ')} ·{' '}
                      {new Date(session.started_at).toLocaleDateString()}
                    </div>
                  </div>
                  {session.overall_score != null && (
                    <div className="font-ser text-[26px] text-ink">{session.overall_score}</div>
                  )}
                  <span className="text-accent">{Icon.arrow}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
