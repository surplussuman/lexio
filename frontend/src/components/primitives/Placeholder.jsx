export function Placeholder({ w = '100%', h = 120, label = 'thumbnail', aspect }) {
  const style = aspect ? { width: '100%', aspectRatio: aspect } : { width: w, height: h }
  return (
    <div
      className="border border-rule flex items-center justify-center text-ink-4 font-mono text-[10px] uppercase tracking-wide rounded"
      style={{
        ...style,
        background: 'repeating-linear-gradient(135deg, var(--color-paper-2) 0 8px, var(--color-paper) 8px 16px)',
      }}
    >
      {label}
    </div>
  )
}
