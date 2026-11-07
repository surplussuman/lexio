import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'

export function useReassessmentStatus() {
  return useQuery({
    queryKey: ['reassessment', 'status'],
    queryFn: () => api.get('/reassessment/status'),
  })
}

export function useStartReassessment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/reassessment/start'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reassessment'] }),
  })
}

export function useReassessmentReport(reassessmentId) {
  return useQuery({
    queryKey: ['reassessment', 'report', reassessmentId],
    queryFn: () => api.get(`/reassessment/${reassessmentId}/report`),
    enabled: Boolean(reassessmentId),
    retry: false, // a 409 means "not finished yet", not a transient failure
  })
}

export function useReassessmentHistory() {
  return useQuery({
    queryKey: ['reassessment', 'history'],
    queryFn: () => api.get('/reassessment/history'),
  })
}
