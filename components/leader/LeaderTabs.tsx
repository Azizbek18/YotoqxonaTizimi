'use client'

import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import type { LeaderRole } from './leader-theme'
import { leaderTheme } from './leader-theme'

export interface LeaderTab {
  key: string
  label: string
  icon: LucideIcon
  count?: number
}

/**
 * Pill tab bar with a sliding active background (framer-motion `layoutId`)
 * instead of the old static className swap — the highlight glides between
 * tabs rather than jump-cutting. Tabs the caller omits (a revoked
 * permission) simply aren't in `tabs`, same as before.
 */
export default function LeaderTabs({
  role,
  tabs,
  active,
  onChange,
}: {
  role: LeaderRole
  tabs: LeaderTab[]
  active: string
  onChange: (key: string) => void
}) {
  const t = leaderTheme[role]
  return (
    <div className="flex w-full gap-1.5 overflow-x-auto no-scrollbar rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 backdrop-blur-xl sm:w-fit">
      {tabs.map((tab) => {
        const isActive = tab.key === active
        const Icon = tab.icon
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`relative shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-colors duration-200 ${
              isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="leader-tab-pill"
                className={`absolute inset-0 rounded-xl ${t.gradient}`}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Icon size={14} />
              {tab.label}
              {tab.count !== undefined && <span className="opacity-80">({tab.count})</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
