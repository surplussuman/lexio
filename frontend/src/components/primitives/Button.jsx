// Ported from design_extracted/lexio/primitives.jsx `LButton`.
const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4.5 py-2.5 text-[13px]',
  lg: 'px-6 py-3.5 text-sm',
}

const VARIANTS = {
  primary: 'bg-ink text-paper border-ink',
  accent: 'bg-accent text-white border-accent',
  secondary: 'bg-transparent text-ink border-ink-2',
  ghost: 'bg-transparent text-ink-2 border-transparent',
  danger: 'bg-bad text-white border-bad',
}

export function Button({ children, variant = 'primary', size = 'md', icon, onClick, full = false, as: Tag = 'button', type = 'button', ...rest }) {
  return (
    <Tag
      type={Tag === 'button' ? type : undefined}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full border font-medium leading-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${SIZES[size]} ${VARIANTS[variant]} ${full ? 'w-full' : 'w-auto'}`}
      {...rest}
    >
      {children}
      {icon}
    </Tag>
  )
}
