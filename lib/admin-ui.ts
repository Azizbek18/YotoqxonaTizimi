/**
 * Admin panel design system.
 *
 * One hue: indigo #4338ca over a slate-neutral base — the calm,
 * institutional blue that reads as "trusted university system", not
 * "consumer game". Depth is restrained-physical: a soft shelf edge under
 * cards and buttons, generous radii, bold headings, a small press on
 * `:active`. Status colours (emerald / amber / rose) appear only via
 * `adminStatusChip` for genuine state. No rainbow per-item hues, no
 * decorative blur orbs, no ping dots.
 *
 * Shares the indigo family with the dekan panel (lib/dekan-ui.ts) so the
 * whole staff product feels like one system; admin is the slightly
 * chunkier, more button-forward of the two.
 */

export const ADMIN = {
  primary: '#4f46e5', // indigo-600
  primaryHover: '#4338ca', // indigo-700
  primaryEdge: '#3730a3', // indigo-800 — shelf / bottom-edge shadow
  primaryDeep: '#312e81', // indigo-900
  primaryInk: '#4338ca',
  tintBg: '#eef2ff', // indigo-50 — light hover wash
  tintBgStrong: '#e0e7ff', // indigo-100 — light active wash
} as const

export function adminUI(isLight: boolean) {
  return {
    // Page shell
    shell: isLight ? 'bg-slate-100' : 'bg-slate-950',

    // Primary surface — a card that sits on a soft shelf edge
    card: isLight
      ? 'bg-white border-slate-200 shadow-[0_2px_0_0_rgba(51,65,85,0.08),0_12px_28px_-18px_rgba(79,70,229,0.18)]'
      : 'bg-slate-900/70 border-slate-800 shadow-[0_2px_0_0_rgba(2,6,23,0.6)]',
    // Feature / hero card — deeper shelf
    cardElevated: isLight
      ? 'bg-white border-slate-200 shadow-[0_4px_0_0_rgba(51,65,85,0.10),0_24px_48px_-24px_rgba(79,70,229,0.28)]'
      : 'bg-slate-900/80 border-slate-800 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.7)]',
    // Recessed surface inside a card
    inset: isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700/70',
    // Hover lift for interactive cards / tiles
    hoverLift:
      'transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-500/40',

    // Text — no pure black; headings sit at slate-700, body lighter still,
    // the way Duolingo uses a soft "eel" grey rather than #000.
    strong: isLight ? 'text-slate-700' : 'text-slate-100',
    body: isLight ? 'text-slate-500' : 'text-slate-300',
    muted: isLight ? 'text-slate-400' : 'text-slate-400',
    faint: isLight ? 'text-slate-400' : 'text-slate-500',

    // Hairlines
    border: isLight ? 'border-slate-200' : 'border-slate-800',
    divide: isLight ? 'divide-slate-200' : 'divide-slate-800',

    // Accent — indigo, action only
    accentText: isLight ? 'text-indigo-600' : 'text-indigo-400',
    // Primary button — indigo with a soft shelf edge + small press
    accentSolid:
      'bg-indigo-600 text-white font-bold shadow-[0_4px_0_0_#3730a3,0_10px_20px_-8px_rgba(79,70,229,0.4)] hover:bg-indigo-500 hover:shadow-[0_5px_0_0_#3730a3,0_14px_26px_-8px_rgba(79,70,229,0.45)] active:translate-y-[2px] active:shadow-[0_2px_0_0_#3730a3] transition-all disabled:opacity-50 disabled:shadow-none disabled:active:translate-y-0',
    accentSoft: isLight
      ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
      : 'bg-indigo-500/12 text-indigo-300 hover:bg-indigo-500/20',
    // Filled icon tile in the accent — stat cards, section headers, nav icons
    accentTile: 'bg-indigo-600 text-white shadow-[0_3px_0_0_#3730a3]',
    accentTileSoft: isLight
      ? 'bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100'
      : 'bg-indigo-500/12 text-indigo-300 ring-1 ring-inset ring-indigo-500/25',
    accentBorder: isLight ? 'border-indigo-300' : 'border-indigo-500/40',
    ring: 'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500',

    // Form fields
    input: isLight
      ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
      : 'bg-slate-800/60 border-slate-700 text-slate-100 placeholder:text-slate-500',

    // Secondary (neutral) button — still on a small shelf
    btnGhost: isLight
      ? 'border border-slate-300 bg-white text-slate-700 font-semibold shadow-[0_3px_0_0_rgba(51,65,85,0.12)] hover:bg-slate-50 hover:border-slate-400 active:translate-y-[2px] active:shadow-[0_1px_0_0_rgba(51,65,85,0.12)] transition-all'
      : 'border border-slate-700 bg-slate-800/40 text-slate-200 font-semibold hover:bg-slate-800 transition-colors',

    // Destructive action
    btnDanger:
      'bg-rose-600 text-white font-bold shadow-[0_4px_0_0_#9f1239,0_10px_20px_-8px_rgba(225,29,72,0.4)] hover:bg-rose-500 active:translate-y-[2px] active:shadow-[0_2px_0_0_#9f1239] transition-all',
    dangerSoft: isLight
      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
      : 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/15 border border-rose-500/25',
  }
}

/** Recharts / progress-bar colours — indigo primary, slate everywhere else. */
export const adminChart = {
  primary: '#4f46e5',
  primarySoft: '#818cf8',
  gradientFrom: '#6366f1',
  gradientTo: '#4338ca',
  track: (isLight: boolean) => (isLight ? '#e5e7eb' : '#1e293b'),
  grid: (isLight: boolean) => (isLight ? '#f1f5f9' : '#1e293b'),
  axis: (isLight: boolean) => (isLight ? '#64748b' : '#94a3b8'),
  tooltip: (isLight: boolean) => ({
    background: isLight ? '#ffffff' : '#0f172a',
    borderColor: isLight ? '#e5e7eb' : '#334155',
    color: isLight ? '#0f172a' : '#f1f5f9',
    fontSize: '11px',
    borderRadius: '14px',
    boxShadow: '0 8px 24px -8px rgba(79,70,229,0.25)',
  }),
  series: ['#4f46e5', '#818cf8', '#c7d2fe', '#64748b', '#94a3b8'],
}

export type AdminStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/** Muted pill for a genuine status. Nothing here is loud. */
export function adminStatusChip(tone: AdminStatusTone, isLight: boolean) {
  const map: Record<AdminStatusTone, { dot: string; chip: string; text: string }> = {
    success: {
      dot: 'bg-emerald-500',
      chip: isLight
        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100'
        : 'bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20',
      text: isLight ? 'text-emerald-600' : 'text-emerald-400',
    },
    warning: {
      dot: 'bg-amber-500',
      chip: isLight
        ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100'
        : 'bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20',
      text: isLight ? 'text-amber-600' : 'text-amber-400',
    },
    danger: {
      dot: 'bg-rose-500',
      chip: isLight
        ? 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100'
        : 'bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/20',
      text: isLight ? 'text-rose-600' : 'text-rose-400',
    },
    info: {
      dot: 'bg-indigo-500',
      chip: isLight
        ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100'
        : 'bg-indigo-500/10 text-indigo-300 ring-1 ring-inset ring-indigo-500/20',
      text: isLight ? 'text-indigo-600' : 'text-indigo-400',
    },
    neutral: {
      dot: isLight ? 'bg-slate-400' : 'bg-slate-500',
      chip: isLight
        ? 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'
        : 'bg-slate-800 text-slate-300 ring-1 ring-inset ring-slate-700',
      text: isLight ? 'text-slate-500' : 'text-slate-400',
    },
  }
  return map[tone]
}
