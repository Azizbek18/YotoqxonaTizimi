'use client'

import type { LucideIcon } from 'lucide-react'
import type { LeaderRole } from './leader-theme'
import { leaderTheme } from './leader-theme'

/** Shared empty state: a glowing icon medallion instead of a bare grey
 *  icon, so an empty list still feels designed rather than unfinished. */
export default function EmptyState({
  role,
  icon: Icon,
  title,
  hint,
}: {
  role: LeaderRole
  icon: LucideIcon
  title: string
  hint?: string
}) {
  const t = leaderTheme[role]
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.015] py-16 text-center">
      <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${t.soft} ${t.text}`}>
        <Icon size={24} />
      </div>
      <p className="text-sm font-bold text-slate-300">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
