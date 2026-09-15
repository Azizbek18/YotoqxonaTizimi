/**
 * Shared visual language for the two "student leadership" panels — Kengash
 * (talaba kengashi raisi, faculty-wide) and Sardor (qavat sardori,
 * floor-wide). Same command-center shell (LeaderBackdrop, LeaderHeader,
 * LeaderTabs, GlassCard, EmptyState), each role keeps its own accent so a
 * screenshot alone tells the two apart. Every class below is a complete
 * literal string (never built with `${}`) so Tailwind's JIT scanner actually
 * picks it up — do the same in any new file that reads from this table.
 */

export type LeaderRole = 'kengash' | 'sardor'

export interface LeaderTheme {
  /** Role label shown in the header badge. */
  label: string
  /** Full-strength gradient — hero medallion, primary buttons, active tab pill. */
  gradient: string
  /** Softer gradient for large decorative blooms. */
  softGradient: string
  text: string
  textSoft: string
  badgeBorder: string
  badgeBg: string
  soft: string
  softBorder: string
  ring: string
  glow: string
  /** Background-blur blob colour for LeaderBackdrop. */
  auroraA: string
  auroraB: string
}

export const leaderTheme: Record<LeaderRole, LeaderTheme> = {
  kengash: {
    label: 'Talaba kengashi raisi',
    gradient: 'bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600',
    softGradient: 'bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-transparent',
    text: 'text-indigo-300',
    textSoft: 'text-indigo-400',
    badgeBorder: 'border-indigo-500/30',
    badgeBg: 'bg-indigo-500/10',
    soft: 'bg-indigo-500/10',
    softBorder: 'border-indigo-500/25',
    ring: 'ring-indigo-500/30',
    glow: 'shadow-[0_0_60px_-15px_rgba(99,102,241,0.5)]',
    auroraA: 'bg-indigo-600/25',
    auroraB: 'bg-fuchsia-600/15',
  },
  sardor: {
    label: 'Qavat sardori',
    gradient: 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600',
    softGradient: 'bg-gradient-to-br from-purple-500/20 via-fuchsia-500/10 to-transparent',
    text: 'text-purple-300',
    textSoft: 'text-purple-400',
    badgeBorder: 'border-purple-500/30',
    badgeBg: 'bg-purple-500/10',
    soft: 'bg-purple-500/10',
    softBorder: 'border-purple-500/25',
    ring: 'ring-purple-500/30',
    glow: 'shadow-[0_0_60px_-15px_rgba(168,85,247,0.5)]',
    auroraA: 'bg-purple-600/25',
    auroraB: 'bg-indigo-600/15',
  },
}

/** Shared glass-card surface — every panel section, list container and
 *  modal in both dashboards is built on this one recipe so the "material"
 *  reads as one system. `hover` adds the lift used on interactive cards
 *  (person cards, room tiles); list containers that are not themselves
 *  clickable skip it. */
export function glassCard(opts: { hover?: boolean } = {}) {
  return [
    'relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl',
    'shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]',
    opts.hover ? 'transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06] hover:-translate-y-0.5' : '',
  ].filter(Boolean).join(' ')
}
