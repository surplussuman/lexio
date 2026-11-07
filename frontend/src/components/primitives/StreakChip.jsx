export function StreakChip({ days = 7 }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-soft border border-rule-2 text-accent-2 font-mono text-[11px] font-medium">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 1s1 2 1 3.5c0 .8-.4 1.5-1 1.5s-1-.7-1-1.5C5 3 4 2 4 2S2 4 2 7a4 4 0 108 0c0-2-2-4-4-6z" />
      </svg>
      {days} day streak
    </span>
  )
}
