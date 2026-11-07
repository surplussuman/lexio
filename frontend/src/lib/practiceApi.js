import { useMutation, useQuery } from '@tanstack/react-query'

import { api } from './api'

export function useSessionTypes() {
  return useQuery({ queryKey: ['practice', 'types'], queryFn: () => api.get('/practice/types') })
}

export function useStartPractice() {
  return useMutation({
    mutationFn: ({ sessionType, topic }) =>
      api.post('/practice/start', { session_type: sessionType, topic }),
  })
}

export function usePracticeSession(sessionId) {
  return useQuery({
    queryKey: ['practice', 'session', sessionId],
    queryFn: () => api.get(`/practice/${sessionId}`).then((d) => d.session),
    enabled: Boolean(sessionId),
  })
}

export function usePracticeHistory() {
  return useQuery({ queryKey: ['practice', 'history'], queryFn: () => api.get('/practice/history') })
}
