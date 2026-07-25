import type { Variants } from 'framer-motion'

// Generalized from the fadeUp pattern originally hand-written in
// app/talaba/profil/page.tsx. `custom` is optional: pass an explicit index
// for manual per-item delay, or leave it unset when the element sits inside
// a `staggerContainer` (below), which times the stagger itself via
// `staggerChildren` instead.
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 1, 0.5, 1] },
  }),
}

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

// Shared tap/hover feel for interactive tiles (stat cards, quick actions),
// consistent with the "press down" feedback already built into the CSS
// shelf-shadow retrofit so CSS and framer-motion read as one system.
export const tapScale = { scale: 0.97 }
export const hoverLift = { y: -2 }
