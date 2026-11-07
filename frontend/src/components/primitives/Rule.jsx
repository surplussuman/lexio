export function Rule({ label }) {
  return (
    <div className="flex items-center gap-3 my-6">
      {label && <span className="font-mono text-[10px] uppercase tracking-wider text-ink-4">{label}</span>}
      <div className="flex-1 h-px bg-rule" />
    </div>
  )
}
