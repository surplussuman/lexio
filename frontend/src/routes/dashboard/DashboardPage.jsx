// LLD §7 (Module 4). Layout ported from the prototype's DDashboard
// (design_extracted/lexio/desktop.jsx): score column left, activity right.
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { AppShell } from '../../components/AppShell'
import { DailyDrillCard } from '../../components/DailyDrillCard'
import { Avatar, Button, Icon, MetricBar, Pill, Rule, ScoreRing, XPBar } from '../../components/primitives'
import { useHistory } from '../../lib/assessmentApi'
import { useDashboardSummary, useLeaderboard, useProgress } from '../../lib/pathApi'
import { useAuthStore } from '../../stores/useAuthStore'

const MODE_NAMES = {
  speak: 'Speaking', present: 'Presentation', write: 'Writing', vocab: 'Vocabulary',
  grammar: 'Grammar', read: 'Reading Comprehension', listen: 'Listening', gd: 'Group Discussion',
}

function toneFor(value) {
  if (value >= 80) return 'good'
  if (value < 60) return 'bad'
  return 'accent'
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { data: summary, isLoading } = useDashboardSummary()
  const { data: progressData } = useProgress(30)
  const { data: leaderboardData } = useLeaderboard()
  const { data: historyData } = useHistory()

  if (isLoading) {
    return (
      <AppShell>
        <p className="max-w-[900px] mx-auto px-8 py-16 text-ink-3 text-sm">Loading your dashboard…</p>
      </AppShell>
    )
  }

  // Nothing scored yet at all.
  if (summary && summary.modes_completed === 0) {
    return (
      <AppShell>
        <div className="max-w-[720px] mx-auto px-8 py-16 text-center">
          <Pill tone="accent">◎ Welcome</Pill>
          <h1 className="font-ser text-5xl font-normal mt-5 mb-3" style={{ letterSpacing: -1 }}>
            Hey {user?.name || 'there'} — let's find your baseline.
          </h1>
          <p className="text-ink-3 text-base leading-relaxed max-w-[480px] mx-auto mb-8">
            You haven't completed an assessment yet. Once you finish all eight, this page fills
            in with your communication score, today's learning path, and progress over time.
          </p>
          <Link to="/onboarding">
            <Button variant="accent" size="lg" icon={Icon.arrow}>
              Start baseline assessment
            </Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  // Some modes are done, but not all eight — the score, the dimension bars
  // and the recommended path are held back the same way the per-assessment
  // report is (apps/analysis/overview.py): nothing derived from a single
  // assessment belongs on screen until the whole picture exists. Echo's daily
  // drill stays — it's a standing habit-loop nudge (§21.4/§21.5), not a
  // result, and it's meant to run through the baseline, not after it.
  if (summary && !summary.baseline_complete) {
    const remaining = summary.modes_total - summary.modes_completed
    return (
      <AppShell>
        <div className="max-w-[720px] mx-auto px-8 py-16">
          <div className="text-center mb-10">
            <Pill tone="accent">◎ Baseline in progress</Pill>
            <h1 className="font-ser text-5xl font-normal mt-5 mb-3" style={{ letterSpacing: -1 }}>
              {summary.modes_completed} of {summary.modes_total} done.
            </h1>
            <p className="text-ink-3 text-base leading-relaxed max-w-[480px] mx-auto mb-6">
              Your score, dimensions and recommended practice all come from the full picture, not
              one assessment at a time — so this page stays quiet until the other {remaining}
              {remaining === 1 ? ' is' : ' are'} done.
            </p>
            <div className="max-w-[360px] mx-auto h-[3px] bg-rule rounded overflow-hidden mb-8">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${(summary.modes_completed / summary.modes_total) * 100}%` }}
              />
            </div>
            <Link to="/onboarding">
              <Button variant="accent" size="lg" icon={Icon.arrow}>
                Continue your assessments
              </Button>
            </Link>
          </div>
          <DailyDrillCard />
        </div>
      </AppShell>
    )
  }

  const sessions = (historyData?.results ?? []).filter((s) => s.overall_score != null)
  const points = progressData?.data_points ?? []
  const rankings = leaderboardData?.rankings ?? []
  const labels = summary.dimension_labels ?? {}

  return (
    <AppShell>
      <div className="px-9 py-8 pb-14 grid grid-cols-[360px_1fr] gap-6 max-w-[1320px] mx-auto">
        <aside className="flex flex-col gap-4">
          <div className="bg-white border border-rule rounded-[10px] p-6">
            <div className="flex items-center gap-5">
              <ScoreRing value={summary.overall_score} size={116} />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4">Communication score</div>
                <div className="font-ser text-[24px] mt-1" style={{ letterSpacing: -0.3 }}>
                  {summary.level_title}
                </div>
                <div className="font-mono text-[11px] text-ink-3 mt-1">
                  {summary.modes_completed}/{summary.modes_total} modes assessed
                </div>
              </div>
            </div>
            <Rule label="LEVEL" />
            <XPBar
              xp={summary.total_xp}
              max={summary.xp_to_next_level ? summary.total_xp + summary.xp_to_next_level : summary.total_xp}
              title={`Level ${summary.level} · ${summary.level_title}`}
            />
          </div>

          <div className="bg-white border border-rule rounded-[10px] p-6">
            <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-4">Dimensions</div>
            <div className="flex flex-col gap-3">
              {Object.entries(summary.dimension_scores).map(([dimension, value]) => (
                <Link key={dimension} to={`/progress/${dimension}`} className="block">
                  <MetricBar label={labels[dimension] ?? dimension} value={value} tone={toneFor(value)} />
                </Link>
              ))}
            </div>
          </div>

          {rankings.length > 0 && (
            <div className="bg-white border border-rule rounded-[10px] p-6">
              <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-3">
                Leaderboard{leaderboardData?.scope?.college ? ` · ${leaderboardData.scope.college}` : ''}
              </div>
              <div className="flex flex-col gap-2">
                {rankings.map((row) => {
                  const isCurrentUser = row.id === leaderboardData.current_user_id
                  return (
                    <div
                      key={row.id}
                      className={`flex items-center gap-3 px-2 py-1.5 rounded-md ${isCurrentUser ? 'bg-accent-soft' : ''}`}
                    >
                      <span className="font-mono text-[11px] text-ink-4 w-5">{row.rank}</span>
                      <Avatar name={(row.name || '??').slice(0, 2).toUpperCase()} size={24} />
                      <span className="text-[13px] text-ink flex-1 truncate">{row.name}</span>
                      <span className="font-mono text-[11px] text-ink-3">{row.xp} XP</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </aside>

        <main className="flex flex-col gap-5">
          <DailyDrillCard />

          {summary.todays_tasks?.length > 0 && (
            <div>
              <div className="flex justify-between items-baseline mb-3">
                <h2 className="font-ser text-[22px] font-normal">Today's path</h2>
                <Link to="/path" className="font-mono text-[11px] text-accent uppercase tracking-wide">
                  Full path →
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {summary.todays_tasks.map((task) => (
                  <Link
                    key={task.item_id}
                    to={`/path/module/${task.module_id}`}
                    className="bg-white border border-rule rounded-[10px] p-4 flex flex-col gap-2 hover:border-accent transition-colors"
                  >
                    <Pill tone="accent" size="sm">
                      {task.dimension}
                    </Pill>
                    <div className="font-ser text-[17px] leading-tight flex-1">{task.title}</div>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] text-ink-4 uppercase">{task.type}</span>
                      <span className="font-mono text-[11px] text-ink-4">{task.duration_minutes} min</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {points.length > 1 && (
            <div className="bg-white border border-rule rounded-[10px] p-6">
              <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-4">Last 30 days</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={points}>
                  <CartesianGrid stroke="var(--color-rule)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-ink-4)' }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--color-ink-4)' }} tickLine={false} width={30} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-paper-2 rounded-[10px] p-5 flex items-center gap-4">
            <div className="flex-1">
              <div className="font-ser text-[20px]">Your baseline report is ready</div>
              <div className="text-[13px] text-ink-3 mt-0.5">
                The overview across all eight, plus each assessment in full.
              </div>
            </div>
            <Link to="/report">
              <Button variant="accent" icon={Icon.arrow}>
                Open report
              </Button>
            </Link>
          </div>

          <div>
            <Rule label="RECENT SESSIONS" />
            <div className="flex flex-col gap-2">
              {sessions.slice(0, 8).map((session) => (
                <Link
                  key={session.id}
                  to={`/feedback/${session.id}`}
                  className="bg-white border border-rule rounded-[10px] px-5 py-4 flex items-center gap-4 hover:border-accent transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-ser text-[18px]">{MODE_NAMES[session.mode] ?? session.mode}</div>
                    <div className="font-mono text-[10px] text-ink-4 uppercase tracking-wide mt-0.5">
                      {new Date(session.completed_at || session.started_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="font-ser text-[26px] text-ink">{session.overall_score}</div>
                  <span className="text-accent">{Icon.arrow}</span>
                </Link>
              ))}
            </div>
          </div>
        </main>
      </div>
    </AppShell>
  )
}
