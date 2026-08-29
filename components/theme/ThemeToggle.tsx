'use client'

import { motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'

export default function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)
  const isLight = theme === 'light'

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? "Tungi rejimga o'tish" : "Kunduzgi rejimga o'tish"}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border px-1 transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${isLight
        ? 'border-amber-300 bg-amber-100 focus-visible:ring-amber-400 focus-visible:ring-offset-white'
        : 'border-blue-500/60 bg-slate-800 focus-visible:ring-blue-400 focus-visible:ring-offset-slate-900'
        }`}
    >
      {/* The knob carries the active icon, so it is never covered. */}
      <motion.span
        animate={{ x: isLight ? 0 : 22 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md"
      >
        {isLight
          ? <Sun size={14} className="text-amber-500" />
          : <Moon size={14} className="text-blue-500" />}
      </motion.span>
    </motion.button>
  )
}
