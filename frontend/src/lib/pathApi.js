import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'

export function useDashboardSummary() {
  return useQuery({ queryKey: ['dashboard', 'summary'], queryFn: () => api.get('/dashboard/summary') })
}

export function useProgress(days = 30) {
  return useQuery({
    queryKey: ['dashboard', 'progress', days],
    queryFn: () => api.get(`/dashboard/progress?days=${days}`),
  })
}

export function useLeaderboard() {
  return useQuery({ queryKey: ['dashboard', 'leaderboard'], queryFn: () => api.get('/dashboard/leaderboard') })
}

export function usePath() {
  return useQuery({ queryKey: ['path'], queryFn: () => api.get('/path/') })
}

export function useModule(moduleId) {
  return useQuery({
    queryKey: ['path', 'module', moduleId],
    queryFn: () => api.get(`/path/module/${moduleId}`).then((d) => d.module),
    enabled: Boolean(moduleId),
  })
}

function useInvalidatePath() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['path'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
  }
}

export function useCompleteItem() {
  const invalidate = useInvalidatePath()
  return useMutation({
    mutationFn: (itemId) => api.post(`/path/item/${itemId}/complete`),
    onSuccess: invalidate,
  })
}

export function useCompleteModule() {
  const invalidate = useInvalidatePath()
  return useMutation({
    mutationFn: (moduleId) => api.post(`/path/module/${moduleId}/complete`),
    onSuccess: invalidate,
  })
}
