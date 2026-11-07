import { useMutation, useQuery } from '@tanstack/react-query'

import { useAuthStore } from '../stores/useAuthStore'
import { api } from './api'

export function useRegister() {
  const login = useAuthStore((s) => s.login)
  return useMutation({
    mutationFn: (payload) => api.post('/auth/register', payload),
    onSuccess: (data) => login(data.user, data.token),
  })
}

export function useLogin() {
  const login = useAuthStore((s) => s.login)
  return useMutation({
    mutationFn: (payload) => api.post('/auth/login', payload),
    onSuccess: (data) => login(data.user, data.token),
  })
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout)
  const refreshToken = useAuthStore((s) => s.refreshToken)
  return useMutation({
    mutationFn: () => api.post('/auth/logout', { refresh: refreshToken }),
    onSettled: () => logout(),
  })
}

export function useMe(options = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get('/auth/me').then((d) => d.user),
    enabled: isAuthenticated,
    ...options,
  })
}

/** The domains assessment prompts get written against (backend is the source
 *  of truth for what a valid topic is). */
export function useTopics() {
  return useQuery({ queryKey: ['auth', 'topics'], queryFn: () => api.get('/auth/topics') })
}

export function useUpdateProfile() {
  const updateProfile = useAuthStore((s) => s.updateProfile)
  return useMutation({
    mutationFn: (payload) => api.put('/auth/profile', payload),
    onSuccess: (data) => updateProfile(data.user),
  })
}
