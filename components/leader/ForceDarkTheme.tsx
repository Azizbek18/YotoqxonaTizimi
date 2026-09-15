'use client'

import { useEffect, useRef } from 'react'
import { useThemeStore, type ThemeMode } from '@/lib/stores/theme-store'

/**
 * Kengash/Sardor are permanently-dark "command console" panels with no
 * light-mode toggle of their own. Forcing `<html>`'s classes directly isn't
 * enough on its own — shared components like `ConfirmModal` and
 * `CustomSelect` read `useThemeStore().theme` straight from React state to
 * decide their own light/dark branch, so a DOM-only fix left them rendering
 * light (white confirm dialogs) even while the page around them was dark.
 *
 * This instead flips the *store's* theme to `'dark'` for as long as one of
 * these routes is mounted — `AppProviders`' own effect then applies the DOM
 * classes for us, so every themed component (this page's, and every shared
 * one it opens) agrees. The viewer's real preference is restored to the
 * store the moment they navigate away.
 */
export default function ForceDarkTheme() {
  const previousTheme = useRef<ThemeMode | null>(null)

  useEffect(() => {
    previousTheme.current = useThemeStore.getState().theme
    if (previousTheme.current !== 'dark') {
      useThemeStore.getState().setTheme('dark')
    }
    return () => {
      const before = previousTheme.current
      if (before && before !== 'dark') {
        useThemeStore.getState().setTheme(before)
      }
    }
  }, [])

  return null
}
