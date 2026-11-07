// LLD §16.2 /leaderboard — the full cohort ranking (§12.5 / §7.2).
import { AppShell } from '../../components/AppShell'
import { Avatar, Pill } from '../../components/primitives'
import { useLeaderboard } from '../../lib/pathApi'

export function LeaderboardPage() {
  const { data, isLoading } = useLeaderboard()

  const rankings = data?.rankings ?? []
  const scope = data?.scope ?? {}
  const scopeLabel = [scope.college, scope.batch_year].filter(Boolean).join(' · ') || 'All students'

  return (
    <AppShell>
      <div className="max-w-[720px] mx-auto px-8 py-10">
        <Pill tone="accent">◎ Leaderboard</Pill>
        <h1 className="font-ser text-[40px] font-normal mt-3 mb-1" style={{ letterSpacing: -0.8 }}>
          Your cohort.
        </h1>
        <p className="text-[14px] text-ink-3 mb-7">
          Ranked by XP across {scopeLabel}. Complete sessions and path items to climb.
        </p>

        {isLoading && <p className="text-ink-3 text-sm">Loading rankings…</p>}

        {!isLoading && rankings.length === 0 && (
          <p className="text-ink-3 text-sm">No one in your cohort has earned XP yet — be the first.</p>
        )}

        <div className="flex flex-col gap-2">
          {rankings.map((row) => (
            <Row key={row.id} row={row} isCurrentUser={row.id === data.current_user_id} />
          ))}

          {/* Outside the top ranks? Their own standing still shows. */}
          {data?.your_row && !data.in_top_ranks && (
            <>
              <div className="text-center font-mono text-[11px] text-ink-4 py-1">···</div>
              <Row row={data.your_row} isCurrentUser />
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function Row({ row, isCurrentUser }) {
  return (
    <div
      className={`flex items-center gap-4 px-5 py-4 rounded-[10px] border ${
        isCurrentUser ? 'border-accent bg-accent-soft' : 'border-rule bg-white'
      }`}
    >
      <span className="font-ser text-[22px] text-ink-4 w-8">{row.rank}</span>
      <Avatar name={(row.name || '??').slice(0, 2).toUpperCase()} size={34} />
      <span className="text-[15px] text-ink flex-1">
        {row.name}
        {isCurrentUser && <span className="text-ink-4 text-[13px]"> · you</span>}
      </span>
      <span className="font-mono text-[13px] text-ink-3">{row.xp} XP</span>
    </div>
  )
}
