import { EchoMascot } from './EchoMascot'

export function Wordmark({ size = 22 }) {
  return (
    <span className="inline-flex items-center" style={{ gap: size * 0.35 }}>
      <EchoMascot size={size * 1.3} />
      <span
        className="font-ser text-ink leading-none"
        style={{ fontSize: size * 1.5, letterSpacing: -0.5, fontWeight: 400 }}
      >
        Lexio
      </span>
    </span>
  )
}
