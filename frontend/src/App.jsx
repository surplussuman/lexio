import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'

import { AuthGuard } from './components/AuthGuard'
import { AssessPage } from './routes/assess/AssessPage'
import { LoginPage } from './routes/auth/LoginPage'
import { RegisterPage } from './routes/auth/RegisterPage'
import { DashboardPage } from './routes/dashboard/DashboardPage'
import { FeedbackPage } from './routes/feedback/FeedbackPage'
import { LandingPage } from './routes/landing/LandingPage'
import { LeaderboardPage } from './routes/leaderboard/LeaderboardPage'
import { OnboardingPage } from './routes/onboarding/OnboardingPage'
import { ModulePage } from './routes/path/ModulePage'
import { PathPage } from './routes/path/PathPage'
import { LivePracticePage } from './routes/practice/LivePracticePage'
import { PracticePage } from './routes/practice/PracticePage'
import { PracticeSummaryPage } from './routes/practice/PracticeSummaryPage'
import { ProfilePage } from './routes/profile/ProfilePage'
import { DimensionProgressPage } from './routes/progress/DimensionProgressPage'
import { ComparisonReportPage } from './routes/reassessment/ComparisonReportPage'
import { ReassessmentPage } from './routes/reassessment/ReassessmentPage'
import { BaselineReportPage } from './routes/report/BaselineReportPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

/* CSS `user-select: none` (index.css) stops a drag-select, but copy/cut can
 * still fire from a keyboard shortcut or a right-click menu regardless of
 * selection — this is what actually stops content leaving the page. */
function useDisableCopy() {
  useEffect(() => {
    const block = (event) => event.preventDefault()
    document.addEventListener('copy', block)
    document.addEventListener('cut', block)
    return () => {
      document.removeEventListener('copy', block)
      document.removeEventListener('cut', block)
    }
  }, [])
}

export default function App() {
  useDisableCopy()
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route element={<AuthGuard />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/assess/:mode" element={<AssessPage />} />
            <Route path="/feedback/:sessionId" element={<FeedbackPage />} />
            <Route path="/report" element={<BaselineReportPage />} />
            <Route path="/path" element={<PathPage />} />
            <Route path="/path/module/:moduleId" element={<ModulePage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/practice/:sessionId" element={<LivePracticePage />} />
            <Route path="/practice/:sessionId/summary" element={<PracticeSummaryPage />} />
            <Route path="/reassessment" element={<ReassessmentPage />} />
            <Route path="/reassessment/:reassessmentId/report" element={<ComparisonReportPage />} />
            <Route path="/progress/:dimension" element={<DimensionProgressPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  )
}
