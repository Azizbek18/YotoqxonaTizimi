'use client'

import { motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { useThemeStore, type ThemeMode } from '@/lib/stores/theme-store'

/**
 * Reads/writes the app-wide theme store by default. Pass `theme`+`onToggle`
 * to control it from elsewhere instead — used by panels (Sardor) that keep
 * their own theme separate from the shared store, see `PanelThemeContext`.
 */
export default function ThemeToggle({
  theme: themeProp,
  onToggle,
}: { theme?: ThemeMode; onToggle?: () => void } = {}) {
  const storeTheme = useThemeStore((state) => state.theme)
  const storeToggle = useThemeStore((state) => state.toggleTheme)
  const theme = themeProp ?? storeTheme
  const toggleTheme = onToggle ?? storeToggle
  const isLight = theme === 'light'

  return (
    <motion.button
      type="button"
      data-student-button="plain"
      onClick={toggleTheme}
      aria-label={isLight ? "Tungi rejimga o'tish" : "Kunduzgi rejimga o'tish"}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      className={`no-shelf relative inline-flex h-8 w-13 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        isLight
          ? 'border-slate-200 bg-slate-100 hover:bg-slate-200/80 focus-visible:ring-blue-500 focus-visible:ring-offset-white'
          : 'border-slate-800 bg-slate-900 hover:bg-slate-800 focus-visible:ring-blue-400 focus-visible:ring-offset-slate-900'
      }`}
    >
      {/* The knob carries the active icon, so it is never covered. */}
      <motion.span
        animate={{ x: isLight ? 0 : 20 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className={`flex h-6.5 w-6.5 items-center justify-center rounded-full shadow-xs border ${
          isLight
            ? 'bg-white border-slate-200/80 text-amber-500'
            : 'bg-slate-800 border-slate-700 text-blue-400'
        }`}
      >
        {isLight
          ? <Sun size={13} className="text-amber-500" />
          : <Moon size={13} className="text-blue-400" />}
      </motion.span>
    </motion.button>
  )
}
