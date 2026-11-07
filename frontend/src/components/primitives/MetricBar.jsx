const TONE_CLASS = { good: 'bg-good', bad: 'bg-bad', accent: 'bg-accent' }

export function MetricBar({ label, value, max = 100, tone = 'accent' }) {
  return (
    <div>
      <div className="flex justify-between mb-1.5 text-xs">
        <span className="text-ink-2 font-medium">{label}</span>
        <span className="font-mono text-ink-3">
          {value}
          <span className="opacity-40">/{max}</span>
        </span>
      </div>
      <div className="h-1 bg-rule rounded overflow-hidden">
        <div className={`h-full rounded ${TONE_CLASS[tone] ?? TONE_CLASS.accent}`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  )
}
