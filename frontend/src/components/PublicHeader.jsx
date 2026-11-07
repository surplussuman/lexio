// Pre-auth equivalent of the prototype's DShell header (design_extracted/
// lexio/desktop.jsx) — same visual language, but Login/Register in place of
// nav tabs + streak/XP/avatar, since a visitor has no session yet.
import { Link } from 'react-router-dom'

import { Button, Wordmark } from './primitives'

export function PublicHeader() {
  return (
    <header className="flex items-center px-9 py-4 border-b border-rule bg-paper gap-8">
      <Link to="/">
        <Wordmark size={22} />
      </Link>
      <div className="flex-1" />
      <Link to="/login" className="font-sans text-[13px] font-medium text-ink-2 px-3.5 py-2">
        Log in
      </Link>
      <Link to="/register">
        <Button variant="accent" size="sm">
          Sign up
        </Button>
      </Link>
    </header>
  )
}
