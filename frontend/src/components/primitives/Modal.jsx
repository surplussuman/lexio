// Shared dialog shell. The prototype has no modal, so this extends the same
// conventions the rest of the system uses: paper surface, hairline rule,
// serif heading, mono eyebrow.
import { useEffect } from 'react'

export function Modal({ children, onClose, labelledBy, width = 560 }) {
  // Esc closes, and the page behind must not scroll under the dialog.
  useEffect(() => {
    if (!onClose) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(11, 27, 59, 0.55)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="bg-paper border border-rule rounded-2xl w-full my-auto"
        style={{ maxWidth: width, boxShadow: '0 24px 60px rgba(11,27,59,0.28)' }}
      >
        {children}
      </div>
    </div>
  )
}
