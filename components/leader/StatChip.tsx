'use client'

import React from 'react'
import type { LucideIcon } from 'lucide-react'

export interface StatChipProps {
  icon: LucideIcon
  value: string | number
  label: string
  subtitle?: string
  onClick?: () => void
  active?: boolean
  accent?: 'indigo' | 'purple' | 'emerald' | 'amber' | 'rose'
}

/** One executive glass stat card in the leader header strip. */
export default function StatChip({
  icon: Icon,
  value,
  label,
  subtitle,
  onClick,
  active,
  accent = 'indigo',
}: StatChipProps) {
  const accentStyles = {
    indigo: {
      iconBg: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
      activeBorder: 'border-indigo-500/60 bg-indigo-500/15 shadow-lg shadow-indigo-950/40',
      dot: 'bg-indigo-400',
    },
    purple: {
      iconBg: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
      activeBorder: 'border-purple-500/60 bg-purple-500/15 shadow-lg shadow-purple-950/40',
      dot: 'bg-purple-400',
    },
    emerald: {
      iconBg: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      activeBorder: 'border-emerald-500/60 bg-emerald-500/15 shadow-lg shadow-emerald-950/40',
      dot: 'bg-emerald-400',
    },
    amber: {
      iconBg: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
      activeBorder: 'border-amber-500/60 bg-amber-500/15 shadow-lg shadow-amber-950/40',
      dot: 'bg-amber-400',
    },
    rose: {
      iconBg: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
      activeBorder: 'border-rose-500/60 bg-rose-500/15 shadow-lg shadow-rose-950/40',
      dot: 'bg-rose-400',
    },
  }

  const s = accentStyles[accent]
  const isButton = Boolean(onClick)
  const Wrapper = isButton ? 'button' : 'div'

  return (
    <Wrapper
      type={isButton ? 'button' : undefined}
      onClick={onClick}
      className={`no-shelf group flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border p-2 sm:px-4 sm:py-3 backdrop-blur-xl transition-all text-left ${
        active
          ? s.activeBorder
          : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07] active:scale-95'
      } ${isButton ? 'cursor-pointer' : ''}`}
    >
      <div className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl transition-transform group-hover:scale-105 shadow-xs ${s.iconBg}`}>
        <Icon size={15} className="sm:hidden" />
        <Icon size={18} className="hidden sm:block" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base sm:text-xl font-black tracking-tight text-white leading-none">{value}</p>
        <p className="mt-0.5 sm:mt-1 truncate text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
        {subtitle && (
          <p className="hidden sm:block text-[10px] text-slate-500 font-medium leading-none mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
    </Wrapper>
  )
}
