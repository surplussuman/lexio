// Ported from design_extracted/lexio/desktop.jsx `DShell` — same header
// pattern (logo, nav, streak, XP, avatar), wired to real router links and
// real user data instead of the prototype's hardcoded persona.
import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'

import { useMe } from '../lib/authApi'
import { useAssessmentGuardStore } from '../stores/useAssessmentGuardStore'
import { useAuthStore } from '../stores/useAuthStore'
import { IntegrityPledge, useIntegrityPledge } from './IntegrityPledge'
import { TopicPickerModal } from './TopicPicker'
import { Avatar, EchoMascot, Icon, StreakChip } from './primitives'

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/onboarding', label: 'Assessments' },
  { to: '/practice', label: 'Practice' },
  { to: '/path', label: 'Learning path' },
  { to: '/reassessment', label: 'Reassess' },
  { to: '/leaderboard', label: 'Leaderboard' },
]

export function AppShell({ children }) {
  // XP and streak change as the student works, so read the live server copy
  // rather than the snapshot persisted at login — otherwise the header keeps
  // showing 0 XP while the dashboard shows the real figure.
  const storedUser = useAuthStore((s) => s.user)
  const { data: freshUser } = useMe()
  const user = freshUser ?? storedUser

  const location = useLocation()
  const initials = (user?.name || user?.email || '??').slice(0, 2).toUpperCase()

  // A live assessment guards more than the browser back button (see
  // AssessPage) — clicking straight past it via this header's own nav has to
  // be caught too, since AppShell sits right alongside it on /assess/:mode.
  const guardActive = useAssessmentGuardStore((s) => s.active)
  const guardAttempt = useAssessmentGuardStore((s) => s.attempt)
  const guardedClick = (to) => (event) => {
    if (!guardActive) return
    event.preventDefault()
    guardAttempt?.(to)
  }

  // Two things are asked for once, before anything else: the domains that
  // decide what every assessment question is about, and the pledge that makes
  // the whole exercise worth doing. Topics come first — without them there is
  // nothing to be honest about yet.
  const queryClient = useQueryClient()
  const pledge = useIntegrityPledge()
  const needsTopics = Boolean(user) && (user.topic_preferences ?? []).length === 0

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      {needsTopics ? (
        <TopicPickerModal onSaved={() => queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })} />
      ) : (
        pledge.isOpen && <IntegrityPledge name={user?.name} onAccept={pledge.accept} />
      )}
      <header className="flex items-center px-9 py-4 border-b border-rule bg-paper gap-8 flex-shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2.5" onClick={guardedClick('/dashboard')}>
          <EchoMascot size={28} />
          <span className="font-ser text-[26px] leading-none" style={{ letterSpacing: -0.5 }}>
            Lexio
          </span>
        </Link>
        <nav className="flex gap-1.5 ml-6">
          {NAV.map((n) => {
            const active = location.pathname.startsWith(n.to)
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={guardedClick(n.to)}
                className={`text-[13px] font-medium px-3.5 py-2 rounded-full ${active ? 'bg-ink text-paper' : 'text-ink-2'}`}
              >
                {n.label}
              </Link>
            )
          })}
        </nav>
        <div className="flex-1" />
        <StreakChip days={user?.streak_days ?? 0} />
        <div className="font-mono text-[11px] text-ink-3 flex items-center gap-1.5">
          {Icon.bolt} {user?.total_xp ?? 0} XP
        </div>
        <Link to="/profile" aria-label="Profile" onClick={guardedClick('/profile')}>
          <Avatar name={initials} size={32} />
        </Link>
      </header>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}
