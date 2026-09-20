'use client'

import React from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import type { LeaderRole } from './leader-theme'
import { getLeaderTheme } from './leader-theme'

export interface LeaderTab {
  key: string
  label: string
  icon: LucideIcon
  count?: number
}

/**
 * Modern pill tab bar with sliding active indicator, counts, and .no-shelf support.
 */
export default function LeaderTabs({
  role,
  tabs,
  active,
  onChange,
  isLight,
}: {
  role: LeaderRole
  tabs: LeaderTab[]
  active: string
  onChange: (key: string) => void
  isLight?: boolean
}) {
  const t = getLeaderTheme(role, isLight)

  return (
    <div className="no-shelf flex w-full gap-1.5 overflow-x-auto no-scrollbar rounded-2xl border border-white/15 bg-slate-900/70 p-1.5 backdrop-blur-xl shadow-lg sm:w-fit">
      {tabs.map((tab) => {
        const isActive = tab.key === active
        const Icon = tab.icon
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`no-shelf cursor-pointer relative shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all duration-200 active:scale-95 ${
              isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId={`leader-tab-pill-${role}`}
                className={`absolute inset-0 rounded-xl ${t.gradient} shadow-md shadow-purple-950/40 border border-white/20`}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
