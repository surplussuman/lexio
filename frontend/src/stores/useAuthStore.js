// LLD §16.3: useAuthStore — user, token, isAuthenticated, isLoading /
// login, logout, updateProfile. Zustand holds client state only; the actual
// register/login/profile network calls live in src/lib/authApi.js and are
// driven through TanStack Query — this store is just where the result ends
// up, plus the token used by src/lib/api.js.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      login: (user, token) =>
        set({
          user,
          accessToken: token.access,
          refreshToken: token.refresh,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isLoading: false }),

      updateProfile: (user) => set({ user }),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'lexio-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => state?.setLoading(false),
    }
  )
)
