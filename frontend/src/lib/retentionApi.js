import { useQuery } from '@tanstack/react-query'

import { api } from './api'

export function useEchoState() {
  return useQuery({ queryKey: ['echo', 'state'], queryFn: () => api.get('/echo/state') })
}

export function useDailyChallenge() {
  return useQuery({ queryKey: ['daily-challenge'], queryFn: () => api.get('/daily-challenge') })
}
