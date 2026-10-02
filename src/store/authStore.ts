import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (user: User) => void
  logout: () => void
}


export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (rawUser: any) => {
        const normalizedUser: User = rawUser?.user ? rawUser.user : rawUser
        set({ user: normalizedUser, isAuthenticated: true })
      },
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'sml-coldstore-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        if (state && (state.user as any)?.user) {
          state.user = (state.user as any).user
        }
      },
    }
  )
)
