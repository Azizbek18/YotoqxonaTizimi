'use client'

import { motion } from 'framer-motion'
import { X, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { LeaderRole } from './leader-theme'
import { leaderTheme } from './leader-theme'

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
}: {
  role: LeaderRole
  icon: LucideIcon
  title: string
  description?: string
  onClose: () => void
  maxWidthClass?: string
  children: ReactNode
}) {
  const t = leaderTheme[role]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className={`relative w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0b1120] p-6 shadow-2xl sm:p-8`}
      >
        <div className={`pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-[80px] ${t.auroraA}`} />

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white ${t.gradient}`}>
              <Icon size={19} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-white">{title}</h3>
              {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={15} />
          </button>
        </div>

        <div className="relative mt-6">{children}</div>
      </motion.div>
    </div>
  )
}
