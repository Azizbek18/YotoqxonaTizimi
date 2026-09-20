'use client'

import React from 'react'
import { ArrowLeft, LogOut, ShieldCheck, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import StatChip from './StatChip'
import type { LeaderRole } from './leader-theme'
import { getLeaderTheme } from './leader-theme'
import ThemeToggle from '@/components/theme/ThemeToggle'
import type { ThemeMode } from '@/lib/stores/theme-store'

export interface LeaderStat {
  icon: LucideIcon
  value: string | number
  label: string
  subtitle?: string
  accent?: 'indigo' | 'purple' | 'emerald' | 'amber' | 'rose'
  onClick?: () => void
  active?: boolean
}

/**
 * The hero header shared by Kengash and Sardor: an executive glowing medallion,
 * role badge, name, one-line mandate, and a strip of live stat cards.
 */
export default function LeaderHeader({
  role,
  icon: Icon = ShieldCheck,
  badgeText,
  name,
  subtitle,
  stats,
  backHref,
  themeToggle,
}: {
  role: LeaderRole
  icon?: LucideIcon
  badgeText: string
  name: string
  subtitle: string
  stats: LeaderStat[]
  backHref: string
  /** Panels that keep their own dark/light choice (e.g. Sardor) pass this to show a toggle. */
  themeToggle?: { theme: ThemeMode; onToggle: () => void }
}) {
  // Gradient-stop (`from-*`/`via-*`/`to-*`) utilities aren't covered by the
  // app-wide light-mode CSS retrofit (it only re-colours flat `bg-*`
  // classes), so this hero would otherwise stay a dark navy panel with
  // auto-darkened text on top of it — unreadable. Branch it explicitly,
  // same convention as app/talaba/tolova's receipt-review card.
  const isLight = themeToggle?.theme === 'light'
  const t = getLeaderTheme(role, isLight)

  return (
    <header
      className={`no-shelf relative min-w-0 overflow-hidden rounded-2xl border p-3 max-[340px]:p-2.5 min-[360px]:p-3.5 sm:rounded-[2rem] sm:p-7 backdrop-blur-2xl shadow-2xl ${
        isLight
          ? 'border-slate-200 bg-gradient-to-br from-white via-indigo-50/70 to-white shadow-slate-300/30'
          : 'border-white/15 bg-gradient-to-br from-slate-900/95 via-purple-950/40 to-slate-900/95 shadow-black/60'
      }`}
    >
      <div className={`pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full blur-[100px] ${isLight ? 'opacity-20' : 'opacity-40'} ${t.auroraA}`} />
      <div className={`pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full blur-[90px] ${isLight ? 'opacity-15' : 'opacity-25'} ${t.auroraB}`} />

      <div className="relative z-10 flex flex-col gap-3 sm:gap-6">
        {/* Top Control Bar: Back button, Role badge, and Exit link */}
        <div className="flex min-w-0 items-center justify-between gap-1.5 min-[360px]:gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href={backHref}
              className="no-shelf cursor-pointer flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border border-white/15 bg-white/5 text-slate-300 transition-all hover:bg-white/15 hover:text-white active:scale-95 shadow-sm"
              title="Talaba paneliga qaytish"
            >
              <ArrowLeft size={16} />
            </Link>

            <div className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider max-[340px]:hidden sm:px-3 sm:text-[10px] ${t.badgeBorder} ${t.badgeBg} ${t.text}`}>
              <span className="truncate">{badgeText}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 min-[360px]:gap-2">
            {themeToggle && (
              <div className="no-shelf">
                <ThemeToggle theme={themeToggle.theme} onToggle={themeToggle.onToggle} />
              </div>
            )}
            <Link
              href={backHref}
              className="no-shelf cursor-pointer flex h-9 w-9 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 p-0 text-[10px] font-black uppercase tracking-wider text-slate-300 shadow-sm transition-all hover:bg-white/15 hover:text-white active:scale-95 min-[360px]:h-auto min-[360px]:w-auto min-[360px]:px-2.5 min-[360px]:py-1.5 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-xs"
            >
              <LogOut size={12} />
              <span className="hidden sm:inline">Talaba paneliga</span>
              <span className="hidden min-[360px]:inline sm:hidden">Chiqish</span>
            </Link>
          </div>
        </div>

        {/* Identity Section: Icon Medallion + Name + Mandate Description */}
        <div className="flex items-center gap-3 sm:gap-4">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className={`flex h-10 w-10 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl text-white ${t.gradient} ${t.glow} border border-white/20`}
          >
            <Icon size={18} className="sm:hidden" />
            <Icon size={26} className="hidden sm:block" />
          </motion.div>

          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-2xl font-black tracking-tight text-white drop-shadow-sm leading-tight truncate">
              {name}
            </h1>
            <p className="mt-0.5 text-xs text-slate-400 font-medium leading-relaxed hidden sm:block max-w-xl">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        {stats.length > 0 && (
          <div className="grid min-w-0 grid-cols-2 gap-1.5 border-t border-white/10 pt-2 min-[360px]:gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-4">
            {stats.map((s) => (
              <StatChip
                key={s.label}
                icon={s.icon}
                value={s.value}
                label={s.label}
                subtitle={s.subtitle}
                accent={s.accent}
                onClick={s.onClick}
                active={s.active}
              />
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
