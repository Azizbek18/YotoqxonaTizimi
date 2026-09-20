'use client'

import { motion } from 'framer-motion'
import { X, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { LeaderRole } from './leader-theme'
import { getLeaderTheme } from './leader-theme'

/**
 * Shared shell for the bespoke modals in both dashboards (new announcement,
 * navbatchilik picker) — icon medallion + title + close button on a glass
 * card, replacing the near-identical `fixed inset-0 … bg-[#0b1120]` block
 * each modal used to hand-roll. `ConfirmModal` (appoint/revoke, delete)
 * stays as its own shared component elsewhere — this is only for modals
 * that need custom body content.
 */
export default function ModalShell({
  role,
  icon: Icon,
  title,
  description,
  onClose,
  maxWidthClass = 'max-w-lg',
  children,
  isLight,
}: {
  role: LeaderRole
  icon: LucideIcon
  title: string
  description?: string
  onClose: () => void
  maxWidthClass?: string
  children: ReactNode
  isLight?: boolean
}) {
  const t = getLeaderTheme(role, isLight)
  return (
    <div className="fixed inset-0 z-50 flex min-w-0 items-center justify-center overflow-x-hidden bg-black/80 p-2 sm:p-4 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className={`relative min-w-0 w-full ${maxWidthClass} max-h-[94vh] overflow-y-auto overflow-x-hidden rounded-2xl sm:rounded-[2rem] border border-white/10 bg-[#0b1120] p-3 max-[340px]:p-2.5 min-[360px]:p-3.5 sm:p-7 shadow-2xl`}
      >
        <div className={`pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-[80px] ${t.auroraA}`} />

        <div className="relative flex min-w-0 items-start justify-between gap-2 min-[360px]:gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-2.5 min-[360px]:gap-3.5">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white min-[360px]:h-11 min-[360px]:w-11 min-[360px]:rounded-2xl ${t.gradient}`}>
              <Icon size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="break-words text-base font-black tracking-tight text-white min-[360px]:text-lg">{title}</h3>
              {description && <p className="mt-1 break-words text-[11px] leading-relaxed text-slate-400 min-[360px]:text-xs">{description}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={15} />
          </button>
        </div>

        <div className="relative mt-4 min-w-0 min-[360px]:mt-6">{children}</div>
      </motion.div>
    </div>
  )
}
