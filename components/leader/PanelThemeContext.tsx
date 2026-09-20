'use client'

import React, { createContext, useContext, useEffect, useRef } from 'react'
import { useThemeStore, type ThemeMode } from '@/lib/stores/theme-store'

const PanelThemeContext = createContext<{ theme: ThemeMode; toggleTheme: () => void } | null>(null)

/**
 * Kengash/Sardor panels keep their own dark/light choice (persisted under
 * `storageKey`, separate from the app-wide preference) instead of the
 * shared one talaba/dekan/etc. use. It still drives the *same* zustand
 * store `AppProviders` reads from — deliberately, not independent DOM
 * classes — because `AppProviders` re-applies `useThemeStore.getState().theme`
 * to `<html>` from its own mount effect, and React fires effects child-first:
 * a panel-local class toggle done here would just get clobbered the moment
 * that ancestor effect ran on the same initial commit. Routing through the
 * one store means whichever effect fires last re-applies the *same* value.
 * Whatever the store held before mounting is restored on unmount, so this
 * never leaks into what talaba/dekan render after the viewer navigates away.
 */
export function PanelThemeProvider({
  storageKey,
  children,
}: {
  storageKey: string
  children: React.ReactNode
}) {
  const previousTheme = useRef<ThemeMode | null>(null)
  const theme = useThemeStore((state) => state.theme)
  const setTheme = useThemeStore((state) => state.setTheme)

  useEffect(() => {
    previousTheme.current = useThemeStore.getState().theme

    let initial: ThemeMode = 'dark'
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored === 'light' || stored === 'dark') initial = stored
    } catch {
      // localStorage unavailable (private mode, etc.) — fall back to dark.
    }
    setTheme(initial)

    return () => {
      const before = previousTheme.current
      if (before) setTheme(before)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark'
    try {
      window.localStorage.setItem(storageKey, next)
    } catch {
      // ignore
    }
    setTheme(next)
  }

  return (
    <PanelThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </PanelThemeContext.Provider>
  )
}

export function usePanelTheme() {
  const ctx = useContext(PanelThemeContext)
  if (!ctx) throw new Error('usePanelTheme must be used within a PanelThemeProvider')
  return ctx
}
