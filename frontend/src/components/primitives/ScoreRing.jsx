// Colors need real hex values here (not Tailwind classes) since they drive
// SVG stroke attributes, computed from `value` — ported as-is from
// design_extracted/lexio/primitives.jsx.
const COLORS = { good: '#1F7A4A', accent: '#133A7A', bad: '#A84242', rule: '#DCE3EE', ink: '#0B1B3B', ink4: '#6B7A96' }

export function ScoreRing({ value = 72, size = 120, stroke = 8 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c - (value / 100) * c
  const band = value >= 80 ? COLORS.good : value >= 60 ? COLORS.accent : COLORS.bad
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.rule} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={band}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-ser leading-none" style={{ fontSize: size * 0.36, color: COLORS.ink }}>
          {value}
        </div>
        <div className="font-mono text-[9px] uppercase tracking-wide mt-1" style={{ color: COLORS.ink4 }}>
          / 100
        </div>
      </div>
    </div>
  )
}
