// Echo — the mascot. Geometric ink circle with a waveform mouth.
// Ported from design_extracted/lexio/primitives.jsx.
export function EchoMascot({ size = 64, talking = false, color = 'var(--color-accent)', bg = '#fff' }) {
  const bars = [0.45, 0.8, 0.55, 1.0, 0.6, 0.85, 0.4]
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="Echo mascot">
      <circle cx="32" cy="32" r="30" fill={color} />
      <circle cx="32" cy="32" r="30" fill="url(#echo-grad)" opacity="0.2" />
      <defs>
        <radialGradient id="echo-grad" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.8" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="22" cy="26" r="2.2" fill={bg} />
      <circle cx="42" cy="26" r="2.2" fill={bg} />
      <g transform="translate(18,38)">
        {bars.map((h, i) => (
          <rect
            key={i}
            x={i * 4.5}
            y={8 - h * 7}
            width="2.2"
            height={h * 14}
            rx="1.1"
            fill={bg}
            style={talking ? { animation: `echo-talk 0.7s ${i * 0.08}s infinite ease-in-out alternate` } : undefined}
          />
        ))}
      </g>
      <style>{`
        @keyframes echo-talk { from { transform: scaleY(0.4); } to { transform: scaleY(1.2); } }
      `}</style>
    </svg>
  )
}
