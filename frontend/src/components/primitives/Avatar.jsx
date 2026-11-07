export function Avatar({ name = 'AK', size = 28 }) {
  return (
    <div
      className="inline-flex items-center justify-center rounded-full bg-paper-2 text-ink-2 border border-rule font-mono font-medium flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {name}
    </div>
  )
}
