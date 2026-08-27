/**
 * Dekan panel design system.
 *
 * One hue — indigo (with violet as its deeper partner for hero / primary
 * surfaces, so it still reads as a single colour) — over a slate-neutral
 * base. Restrained, not flat: depth comes from layered soft shadows tinted
 * faintly indigo, generous radii, and a little hover motion. Status colours
 * (emerald / amber / rose) appear only via `statusChip` for genuine state.
 * No rainbow per-item hues, no decorative blur orbs.
 */

export function dekanUI(isLight: boolean) {
  return {
    // Page shell / app background
    shell: isLight ? 'bg-slate-100' : 'bg-slate-950',

    // Primary surface — a card that has presence, not just a hairline
    card: isLight
      ? 'bg-white border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_12px_28px_-18px_rgba(79,70,229,0.15)]'
      : 'bg-slate-900/70 border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.4)]',
    // A feature / hero card — deeper elevation
    cardElevated: isLight
      ? 'bg-white border-slate-200/70 shadow-[0_2px_8px_rgba(15,23,42,0.05),0_24px_48px_-24px_rgba(79,70,229,0.25)]'
      : 'bg-slate-900/80 border-slate-800 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.7)]',
    // Recessed surface inside a card (inputs, list rows, wells)
    inset: isLight
      ? 'bg-slate-50 border-slate-200'
      : 'bg-slate-800/40 border-slate-700/70',
    // Hover lift for interactive cards
    hoverLift: 'transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-indigo-300/70 dark:hover:border-indigo-500/40',

    // Text
    strong: isLight ? 'text-slate-900' : 'text-slate-100',
    body: isLight ? 'text-slate-600' : 'text-slate-300',
    muted: isLight ? 'text-slate-500' : 'text-slate-400',
    faint: isLight ? 'text-slate-400' : 'text-slate-500',

    // Hairlines
    border: isLight ? 'border-slate-200' : 'border-slate-800',
    divide: isLight ? 'divide-slate-200' : 'divide-slate-800',

    // Accent — indigo→violet, action only
    accentText: isLight ? 'text-indigo-600' : 'text-indigo-400',
    // Primary button — gradient + a soft coloured shadow so it lifts off the page
    accentSolid: 'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-[0_2px_8px_rgba(79,70,229,0.35)] hover:from-indigo-500 hover:to-indigo-700 hover:shadow-[0_4px_14px_rgba(79,70,229,0.45)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none',
    accentSoft: isLight
      ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
      : 'bg-indigo-500/12 text-indigo-300 hover:bg-indigo-500/18',
    // Filled icon tile in the accent — used for stat cards, section headers
    accentTile: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_4px_12px_-2px_rgba(79,70,229,0.4)]',
    // Subtler tinted icon tile
    accentTileSoft: isLight
      ? 'bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100'
      : 'bg-indigo-500/12 text-indigo-300 ring-1 ring-inset ring-indigo-500/20',
    accentBorder: isLight ? 'border-indigo-300' : 'border-indigo-500/40',
    ring: 'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500',

    // Form fields
    input: isLight
      ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
      : 'bg-slate-800/60 border-slate-700 text-slate-100 placeholder:text-slate-500',

    // Secondary (neutral) button
    btnGhost: isLight
      ? 'border border-slate-300 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50 hover:border-slate-400 transition-colors'
      : 'border border-slate-700 bg-slate-800/40 text-slate-200 hover:bg-slate-800 transition-colors',

    // Destructive action
    btnDanger: isLight
      ? 'bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-[0_2px_8px_rgba(225,29,72,0.3)] hover:to-rose-700'
      : 'bg-gradient-to-b from-rose-500 to-rose-600 text-white hover:to-rose-500',
    dangerSoft: isLight
      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
      : 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/15 border border-rose-500/25',
  }
}

/** Recharts / progress-bar colours — indigo primary, slate everywhere else. */
export const dekanChart = {
  primary: '#4f46e5', // indigo-600
  primarySoft: '#818cf8', // indigo-400
  gradientFrom: '#6366f1',
  gradientTo: '#7c3aed', // violet-600
  track: (isLight: boolean) => (isLight ? '#e2e8f0' : '#1e293b'),
  grid: (isLight: boolean) => (isLight ? '#f1f5f9' : '#1e293b'),
  axis: (isLight: boolean) => (isLight ? '#64748b' : '#94a3b8'),
  tooltip: (isLight: boolean) => ({
    background: isLight ? '#ffffff' : '#0f172a',
    borderColor: isLight ? '#e2e8f0' : '#334155',
    color: isLight ? '#0f172a' : '#f1f5f9',
    fontSize: '11px',
    borderRadius: '12px',
    boxShadow: '0 8px 24px -8px rgba(79,70,229,0.25)',
  }),
  series: ['#4f46e5', '#7c3aed', '#a5b4fc', '#64748b', '#94a3b8'],
}

export type DekanStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/**
 * Muted pill for a genuine status. `dot` gives the leading indicator colour,
 * `chip` the full `bg + text` for a small label. Nothing here is loud.
 */
export function statusChip(tone: DekanStatusTone, isLight: boolean) {
  const map: Record<DekanStatusTone, { dot: string; chip: string; text: string }> = {
    success: {
      dot: 'bg-emerald-500',
      chip: isLight ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100' : 'bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20',
      text: isLight ? 'text-emerald-600' : 'text-emerald-400',
    },
    warning: {
      dot: 'bg-amber-500',
      chip: isLight ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100' : 'bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20',
      text: isLight ? 'text-amber-600' : 'text-amber-400',
    },
    danger: {
      dot: 'bg-rose-500',
      chip: isLight ? 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100' : 'bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/20',
      text: isLight ? 'text-rose-600' : 'text-rose-400',
    },
    info: {
      dot: 'bg-indigo-500',
      chip: isLight ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100' : 'bg-indigo-500/10 text-indigo-300 ring-1 ring-inset ring-indigo-500/20',
      text: isLight ? 'text-indigo-600' : 'text-indigo-400',
    },
    neutral: {
      dot: isLight ? 'bg-slate-400' : 'bg-slate-500',
      chip: isLight ? 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200' : 'bg-slate-800 text-slate-300 ring-1 ring-inset ring-slate-700',
      text: isLight ? 'text-slate-500' : 'text-slate-400',
    },
  }
  return map[tone]
}
