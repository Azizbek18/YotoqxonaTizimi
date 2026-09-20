'use client'

import { motion } from 'framer-motion'
import type { LeaderRole } from './leader-theme'
import { getLeaderTheme } from './leader-theme'

/**
 * Two slow-drifting blurred gradient blobs behind the whole panel — the
 * "command center" atmosphere every Kengash/Sardor screen shares. Pure
 * `transform`/`opacity` animation (GPU compositing only, nothing that
 * triggers layout), fixed + pointer-events-none, so it never affects scroll,
 * input, or the mobile-perf budget the rest of the app holds to.
 */
export default function LeaderBackdrop({ role, isLight }: { role: LeaderRole; isLight?: boolean }) {
  const t = getLeaderTheme(role, isLight)
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.div
        className={`absolute -left-[10%] -top-[15%] h-[50vh] w-[50vh] rounded-full blur-[110px] ${t.auroraA}`}
        animate={{ x: [0, 40, -10, 0], y: [0, 30, -20, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className={`absolute -right-[15%] top-[20%] h-[45vh] w-[45vh] rounded-full blur-[110px] ${t.auroraB}`}
        animate={{ x: [0, -30, 20, 0], y: [0, -25, 15, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.03),transparent_60%)]" />
    </div>
  )
}
