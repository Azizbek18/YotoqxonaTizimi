'use client'

import type { LucideIcon } from 'lucide-react'
import type { LeaderRole } from './leader-theme'
import { getLeaderTheme } from './leader-theme'

/** Shared empty state: a glowing icon medallion instead of a bare grey
 *  icon, so an empty list still feels designed rather than unfinished. */
export default function EmptyState({
  role,
  icon: Icon,
  title,
  hint,
  isLight,
}: {
  role: LeaderRole
  icon: LucideIcon
  title: string
  hint?: string
  isLight?: boolean
}) {
  const t = getLeaderTheme(role, isLight)
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-3 py-10 text-center min-[360px]:rounded-3xl min-[360px]:px-5 min-[360px]:py-16">
      <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl min-[360px]:mb-4 min-[360px]:h-14 min-[360px]:w-14 min-[360px]:rounded-2xl ${t.soft} ${t.text}`}>
        <Icon size={24} />
      </div>
      <p className="mx-auto max-w-full break-words text-xs font-bold leading-relaxed text-slate-300 min-[360px]:text-sm">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-xs break-words text-[11px] leading-relaxed text-slate-500 min-[360px]:text-xs">{hint}</p>}
    </div>
  )
}
