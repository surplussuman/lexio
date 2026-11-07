// LLD §4.4 <AuthGuard> — Layout wrapper, redirects unauthenticated users to /login.
import { Navigate, Outlet } from 'react-router-dom'

import { useAuthStore } from '../stores/useAuthStore'

export function AuthGuard() {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) return null // avoids a flash-redirect while localStorage hydrates
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}
