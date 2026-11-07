import { useQuery } from '@tanstack/react-query'

import { api } from './api'

export function useGamificationStatus() {
  return useQuery({ queryKey: ['gamification', 'status'], queryFn: () => api.get('/gamification/status') })
}

export function useBadges() {
  return useQuery({ queryKey: ['gamification', 'badges'], queryFn: () => api.get('/gamification/badges') })
}
