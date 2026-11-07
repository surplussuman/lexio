export function XPBar({ xp = 280, max = 500, title = 'Level 3 · Conversationalist' }) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-3">{title}</span>
        <span className="font-mono text-[11px] text-ink">
          {xp}
          <span className="text-ink-4"> xp / {max}</span>
        </span>
      </div>
      <div className="h-1.5 bg-rule rounded-full overflow-hidden">
        <div
          className="h-full"
          style={{ width: `${(xp / max) * 100}%`, background: 'linear-gradient(90deg, var(--color-accent) 0%, var(--color-accent-2) 100%)' }}
        />
      </div>
    </div>
  )
}
