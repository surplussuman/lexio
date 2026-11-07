import { useQuery } from '@tanstack/react-query'

import { api } from './api'

export function useDimensionProgress(dimension) {
  return useQuery({
    queryKey: ['progress', dimension],
    queryFn: () => api.get(`/progress/${dimension}`),
    enabled: Boolean(dimension),
  })
}
