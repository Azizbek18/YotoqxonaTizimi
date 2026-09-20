/**
 * Shared visual language for the two "student leadership" panels — Kengash
 * (talaba kengashi raisi, faculty-wide) and Sardor (qavat sardori,
 * floor-wide). Same command-center shell (LeaderBackdrop, LeaderHeader,
 * LeaderTabs, GlassCard, EmptyState), each role keeps its own accent so a
 * screenshot alone tells the two apart. Every class below is a complete
 * literal string (never built with `${}`) so Tailwind's JIT scanner actually
 * picks it up — do the same in any new file that reads from this table.
 *
 * Each role has a `dark` and a `light` variant: these panels normally stay
 * permanently dark (see `PanelThemeContext`), but now that they can be
 * toggled to light, the `text`/`soft`/`softBorder` tokens — pale accent
 * colour on a near-black translucent tint — need a genuinely different,
 * readable pairing on a light background rather than just staying as-is.
 * Call `getLeaderTheme(role, isLight)` instead of indexing the table
 * directly.
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

const leaderThemeVariants: Record<LeaderRole, { dark: LeaderTheme; light: LeaderTheme }> = {
  kengash: {
    dark: {
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
    light: {
      label: 'Talaba kengashi raisi',
      gradient: 'bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600',
      softGradient: 'bg-gradient-to-br from-indigo-100 via-violet-100 to-transparent',
      text: 'text-indigo-700',
      textSoft: 'text-indigo-600',
      badgeBorder: 'border-indigo-200',
      badgeBg: 'bg-indigo-50',
      soft: 'bg-indigo-50',
      softBorder: 'border-indigo-200',
      ring: 'ring-indigo-300',
      glow: 'shadow-[0_0_40px_-15px_rgba(99,102,241,0.25)]',
      auroraA: 'bg-indigo-300/30',
      auroraB: 'bg-fuchsia-300/20',
    },
  },
  sardor: {
    dark: {
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
    light: {
      label: 'Qavat sardori',
      gradient: 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600',
      softGradient: 'bg-gradient-to-br from-purple-100 via-fuchsia-100 to-transparent',
      text: 'text-purple-700',
      textSoft: 'text-purple-600',
      badgeBorder: 'border-purple-200',
      badgeBg: 'bg-purple-50',
      soft: 'bg-purple-50',
      softBorder: 'border-purple-200',
      ring: 'ring-purple-300',
      glow: 'shadow-[0_0_40px_-15px_rgba(168,85,247,0.25)]',
      auroraA: 'bg-purple-300/30',
      auroraB: 'bg-indigo-300/20',
    },
  },
}

export function getLeaderTheme(role: LeaderRole, isLight = false): LeaderTheme {
  return isLight ? leaderThemeVariants[role].light : leaderThemeVariants[role].dark
}

export type AccentColor = 'indigo' | 'purple' | 'emerald' | 'amber' | 'rose' | 'blue' | 'sky' | 'cyan'

/**
 * One-off colour badges/banners scattered through both dashboards (room
 * tags, ariza/tushuntirish counts, e'lon type pills, the "sardor tayinlash"
 * hint) all use the same dark-only recipe — pale `text-*-300` on a
 * near-black `bg-*-500/15` tint. Fine on the permanently-dark command
 * console; nearly invisible once the panel can go light (pale-on-pale).
 * This is the light-readable counterpart for that recipe, picked by the
 * same semantic colour name already used at each call site.
 */
const accentChipVariants: Record<AccentColor, { dark: string; light: string }> = {
  indigo: { dark: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30', light: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  purple: { dark: 'bg-purple-500/15 text-purple-300 border-purple-500/30', light: 'bg-purple-50 text-purple-700 border-purple-200' },
  emerald: { dark: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', light: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  amber: { dark: 'bg-amber-500/15 text-amber-300 border-amber-500/30', light: 'bg-amber-50 text-amber-700 border-amber-200' },
  rose: { dark: 'bg-rose-500/15 text-rose-300 border-rose-500/30', light: 'bg-rose-50 text-rose-700 border-rose-200' },
  blue: { dark: 'bg-blue-500/15 text-blue-300 border-blue-500/30', light: 'bg-blue-50 text-blue-700 border-blue-200' },
  sky: { dark: 'bg-sky-500/15 text-sky-300 border-sky-500/30', light: 'bg-sky-50 text-sky-700 border-sky-200' },
  cyan: { dark: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30', light: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
}

/** Returns `"bg-* text-* border border-*"` — a complete `className` fragment. */
export function accentChip(color: AccentColor, isLight = false): string {
  return `${isLight ? accentChipVariants[color].light : accentChipVariants[color].dark} border`
}

/** Shared glass-card surface — every panel section, list container and
 *  modal in both dashboards is built on this one recipe so the "material"
 *  reads as one system. `hover` adds the lift used on interactive cards
 *  (person cards, room tiles); list containers that are not themselves
 *  clickable skip it. */
export function glassCard(opts: { hover?: boolean; isLight?: boolean } = {}) {
  if (opts.isLight) {
    return [
      'relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-xl',
      'shadow-[0_4px_20px_rgba(0,0,0,0.03)]',
      opts.hover ? 'transition-all duration-300 hover:border-purple-300 hover:bg-white hover:shadow-[0_12px_32px_rgba(147,51,234,0.08)] hover:-translate-y-0.5' : '',
    ].filter(Boolean).join(' ')
  }
  return [
    'relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl',
    'shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]',
    opts.hover ? 'transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06] hover:-translate-y-0.5' : '',
  ].filter(Boolean).join(' ')
}
