// Whether a live assessment is currently on screen, and — while it is —
// where to send a click that tries to navigate away from it. AssessPage owns
// this (it's the only thing that knows how to abandon a session), but the
// leave-guard has to reach further than AssessPage's own markup: AppShell's
// header nav (Dashboard, Practice, Learning path, …) sits right alongside it
// on the same page and would otherwise navigate straight past the guard —
// browser back and tab-close aren't the only way out. AppShell reads this
// store instead of owning its own copy of the abandon flow.
import { create } from 'zustand'

export const useAssessmentGuardStore = create((set) => ({
  active: false,
  attempt: null, // (to: string) => void — set by AssessPage while a session is live
  setGuard: (active, attempt) => set({ active, attempt: attempt ?? null }),
}))
