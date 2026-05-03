'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { THEME_STORAGE_KEY } from '@/lib/theme/constants'

export type ThemeMode = 'dark' | 'light'

type ThemeState = {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

export function applyThemeToDocument(theme: ThemeMode) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  root.classList.remove('theme-dark', 'theme-light')
  root.classList.add(theme === 'light' ? 'theme-light' : 'theme-dark')
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'dark' ? 'light' : 'dark',
        })),
    }),
    {
      name: THEME_STORAGE_KEY,
      partialize: (state) => ({ theme: state.theme }),
    }
  )
)
