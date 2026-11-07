const TONES = {
  neutral: 'bg-paper-2 text-ink-3 border-rule',
  accent: 'bg-accent-soft text-accent-2 border-rule-2',
  good: 'bg-good-soft text-good border-good-soft',
  ink: 'bg-ink text-paper border-ink',
}

export function Pill({ children, tone = 'neutral', size = 'md' }) {
  const pad = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'
  const fs = size === 'sm' ? 'text-[10px]' : 'text-[11px]'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono uppercase tracking-wide font-medium whitespace-nowrap ${pad} ${fs} ${TONES[tone] ?? TONES.neutral}`}
    >
      {children}
    </span>
  )
}
