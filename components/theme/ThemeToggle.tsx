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
      aria-label={isLight ? 'Dark mode ga otish' : 'Light mode ga otish'}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      className={`relative inline-flex h-8 w-14 items-center rounded-full border transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${isLight
        ? 'border-amber-300 bg-amber-100 focus-visible:ring-amber-400 focus-visible:ring-offset-white'
        : 'border-blue-500 bg-slate-800 focus-visible:ring-blue-400 focus-visible:ring-offset-slate-900'
        }`}
    >
      {/* Background glow */}
      <motion.div
        animate={{
          left: isLight ? '4px' : '28px',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="absolute h-6 w-6 rounded-full bg-white shadow-md"
      />

      {/* Icons */}
      <motion.div
        animate={{ opacity: isLight ? 1 : 0.3, x: isLight ? 0 : -4 }}
        transition={{ duration: 0.3 }}
        className="absolute left-1.5 flex items-center justify-center"
      >
        <Sun size={14} className="text-amber-500" />
      </motion.div>

      <motion.div
        animate={{ opacity: isLight ? 0.3 : 1, x: isLight ? 4 : 0 }}
        transition={{ duration: 0.3 }}
        className="absolute right-1.5 flex items-center justify-center"
      >
        <Moon size={14} className="text-blue-400" />
      </motion.div>
    </motion.button>
  )
}
