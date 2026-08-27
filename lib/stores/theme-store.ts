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

let themeAnimTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Flips the theme classes on <html>. `animate` briefly adds `.theme-anim`,
 * which globals.css uses to cross-fade colours/borders/shadows across the
 * whole tree instead of snapping — pass it only for a user-initiated
 * toggle, never for the initial hydration paint. Skipped under
 * prefers-reduced-motion.
 */
export function applyThemeToDocument(theme: ThemeMode, animate = false) {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (animate && !prefersReduced) {
    root.classList.add('theme-anim')
    clearTimeout(themeAnimTimer)
    themeAnimTimer = setTimeout(() => root.classList.remove('theme-anim'), 450)
  }

  root.dataset.theme = theme
  root.style.colorScheme = theme
  root.classList.remove('theme-dark', 'theme-light', 'dark', 'light')
  root.classList.add(theme === 'light' ? 'theme-light' : 'theme-dark')
  root.classList.add(theme)
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
