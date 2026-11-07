// Blocks a student from wandering off mid-take on a mode where a partial
// attempt isn't a fair attempt at the whole thing (Presentation, for now).
//
// Two escape routes exist and both need catching:
//  - The browser Back/Forward button. There's no data router in this app
//    (plain <BrowserRouter>, see App.jsx), so react-router's `useBlocker`
//    isn't available; this uses the standard trick instead — push a dummy
//    history entry on top of the current one, and treat popping back to the
//    real entry beneath it as "the student tried to leave" rather than
//    letting it become an actual navigation.
//  - Closing or refreshing the tab, via `beforeunload`. Browsers no longer
//    allow a custom message here, only their own generic prompt.
//
// This hook only *detects* the attempt and reports it via `onBlockedBack` —
// it doesn't own any modal state, so the caller can share one confirmation
// dialog between this and any in-app "leave" buttons it also wants guarded.
import { useEffect, useRef } from 'react'

export function useLeaveGuard(active, { onBlockedBack } = {}) {
  const activeRef = useRef(active)
  activeRef.current = active
  const onBlockedBackRef = useRef(onBlockedBack)
  onBlockedBackRef.current = onBlockedBack

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!activeRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => {
    if (!active) return undefined

    window.history.pushState({ __leaveGuard: true }, '')
    const onPopState = () => {
      if (!activeRef.current) return
      // Re-arm immediately so the URL/page never actually changes, and a
      // second back-press is caught the same way.
      window.history.pushState({ __leaveGuard: true }, '')
      onBlockedBackRef.current?.(() => {
        activeRef.current = false
        window.history.go(-2)
      })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [active])
}
