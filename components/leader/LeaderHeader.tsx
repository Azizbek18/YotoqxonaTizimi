'use client'

import { ArrowLeft, LogOut, ShieldCheck, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import StatChip from './StatChip'
import type { LeaderRole } from './leader-theme'
import { leaderTheme } from './leader-theme'

export interface LeaderStat {
  icon: LucideIcon
  value: string | number
  label: string
}

/**
 * The hero header shared by Kengash and Sardor: a glowing medallion, the
 * role badge, name, one-line mandate, and a strip of live stat chips —
 * replaces the old plain "badge above an h1" block with an actual command
 * console feel while keeping every piece (back link, logout) it had.
 */
export default function LeaderHeader({
  role,
  icon: Icon = ShieldCheck,
  badgeText,
  name,
  subtitle,
  stats,
  backHref,
}: {
  role: LeaderRole
  icon?: LucideIcon
  badgeText: string
  name: string
  subtitle: string
  stats: LeaderStat[]
  backHref: string
}) {
  const t = leaderTheme[role]
  return (
    <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl sm:p-7">
      <div className={`pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-[90px] opacity-40 ${t.auroraA}`} />

      <div className="relative flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link
              href={backHref}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft size={16} />
            </Link>

            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white ${t.gradient} ${t.glow}`}
              >
                <Icon size={26} />
              </motion.div>
              <div>
                <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${t.badgeBorder} ${t.badgeBg} ${t.text}`}>
                  {badgeText}
                </div>
                <h1 className="mt-1.5 text-xl font-black tracking-tight text-white sm:text-2xl">{name}</h1>
                <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
              </div>
            </div>
          </div>

          <Link
            href={backHref}
            className="hidden shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-300 transition-all hover:bg-white/10 hover:text-white sm:flex"
          >
            <LogOut size={13} />
            Talaba paneliga
          </Link>
        </div>

        {stats.length > 0 && (
          <div className="flex flex-wrap gap-2.5">
            {stats.map((s) => (
              <StatChip key={s.label} icon={s.icon} value={s.value} label={s.label} />
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
