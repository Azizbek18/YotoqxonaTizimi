'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { fadeUp, staggerContainer } from '@/lib/motion/variants'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'

// Wraps a grid/list of tiles so they fade+rise in on mount, staggered by
// framer-motion's own staggerChildren timing (each StaggerItem child just
// declares `fadeUp` with no per-item delay math needed). Falls back to a
// plain, unanimated container when the viewer prefers reduced motion.
export function StaggerList({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()

  if (reduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div className={className} variants={staggerContainer} initial="hidden" animate="show">
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()

  if (reduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  )
}
