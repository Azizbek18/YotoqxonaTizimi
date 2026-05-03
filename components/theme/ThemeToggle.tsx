'use client'

import { motion } from 'framer-motion'
import { Moon, Sparkles, Sun, Waves } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'

export default function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)
  const isLight = theme === 'light'

  return (
    <div className="fixed bottom-4 right-4 z-[1000] sm:bottom-6 sm:right-6">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative"
      >
        <div className="mb-3 flex justify-end">
          <div
            className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] backdrop-blur-xl ${
              isLight
                ? 'border border-sky-200/80 bg-white/70 text-slate-700 shadow-[0_12px_32px_rgba(148,163,184,0.22)]'
                : 'border border-white/15 bg-slate-950/80 text-slate-200 shadow-[0_12px_40px_rgba(15,23,42,0.35)]'
            }`}
          >
            {isLight ? 'Glass Day' : 'Night Shift'}
          </div>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isLight ? 'Dark mode ga otish' : 'Light mode ga otish'}
          className="group relative h-[88px] w-[178px] overflow-hidden rounded-[30px] border border-white/20 bg-transparent p-0 shadow-[0_22px_70px_rgba(15,23,42,0.38)] outline-none transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-sky-400/70"
        >
          <motion.div
            animate={{
              background: isLight
                ? 'linear-gradient(135deg, rgba(219,234,254,1) 0%, rgba(255,255,255,0.96) 36%, rgba(236,254,255,1) 62%, rgba(254,240,138,0.95) 100%)'
                : 'linear-gradient(135deg, rgba(8,15,35,1) 0%, rgba(30,41,59,1) 50%, rgba(37,99,235,0.9) 100%)',
            }}
            transition={{ duration: 0.55 }}
            className="absolute inset-0"
          />

          <motion.div
            animate={{
              opacity: isLight ? 1 : 0.24,
              scale: isLight ? 1 : 0.9,
            }}
            className="absolute inset-x-5 top-2 h-8 rounded-full bg-gradient-to-b from-white/90 to-transparent blur-md"
          />

          <motion.div
            animate={{
              opacity: isLight ? 0.5 : 0.85,
              scale: isLight ? 1.05 : 1,
            }}
            className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/70 blur-2xl"
          />

          <motion.div
            animate={{
              opacity: isLight ? 1 : 0.25,
              y: isLight ? 0 : 12,
            }}
            className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white/80 to-transparent"
          />

          <motion.div
            animate={{
              opacity: isLight ? 0.18 : 0.45,
            }}
            className="absolute inset-x-0 bottom-0 h-8 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.35),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(255,255,255,0.25),transparent_20%),radial-gradient(circle_at_80%_40%,rgba(255,255,255,0.35),transparent_25%)]"
          />

          <motion.div
            animate={{
              x: isLight ? 100 : 10,
              y: 12,
              rotate: isLight ? 0 : -18,
              boxShadow: isLight
                ? '0 16px 32px rgba(250,204,21,0.28)'
                : '0 12px 28px rgba(56,189,248,0.25)',
            }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="absolute flex h-[62px] w-[62px] items-center justify-center rounded-full border border-white/40 bg-white/90 text-amber-500"
          >
            <motion.div
              animate={{ rotate: isLight ? 0 : 180, scale: isLight ? 1 : 0.92 }}
              transition={{ duration: 0.45 }}
            >
              {isLight ? (
                <Sun size={28} strokeWidth={2.2} />
              ) : (
                <Moon size={28} strokeWidth={2.2} className="text-sky-700" />
              )}
            </motion.div>
          </motion.div>

          <motion.div
            animate={{ opacity: isLight ? 1 : 0.2, x: isLight ? 0 : -8 }}
            className="absolute left-4 top-4 flex items-center gap-1 text-white/90"
          >
            <Sparkles size={14} />
            <Sparkles size={10} />
          </motion.div>

          <motion.div
            animate={{ opacity: isLight ? 0.22 : 1, x: isLight ? 12 : 0 }}
            className="absolute right-5 top-4 flex items-center gap-2 text-sky-100"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-current" />
            <div className="h-2 w-2 rounded-full bg-current/90" />
            <div className="h-1 w-1 rounded-full bg-current/80" />
          </motion.div>

          <motion.div
            animate={{
              opacity: isLight ? 1 : 0.18,
              scale: isLight ? 1 : 0.8,
            }}
            className="absolute bottom-3 left-6 h-6 w-14 rounded-full border border-white/40 bg-white/45 blur-[1px]"
          />

          <motion.div
            animate={{
              opacity: isLight ? 1 : 0.14,
              y: isLight ? 0 : 6,
            }}
            className="absolute bottom-8 left-8 h-10 w-10 rounded-full bg-white/50 blur-md"
          />

          <motion.div
            animate={{
              opacity: isLight ? 0.95 : 0.22,
              x: isLight ? 0 : -10,
            }}
            className="absolute bottom-4 left-5 flex items-center gap-2 text-slate-700/75"
          >
            <Waves size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.22em]">Glass</span>
          </motion.div>

          <motion.div
            animate={{
              opacity: isLight ? 0.25 : 0.95,
              x: isLight ? 12 : 0,
            }}
            className="absolute bottom-4 right-5 flex items-center gap-2 text-sky-50"
          >
            <Moon size={14} />
            <span className="text-[10px] font-black uppercase tracking-[0.22em]">Night</span>
          </motion.div>
        </button>
      </motion.div>
    </div>
  )
}
