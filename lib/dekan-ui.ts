/**
 * Dekan panel design system.
 *
 * One accent — indigo — on a slate-neutral base. Everything structural
 * (surfaces, text, borders, dividers) is slate. Indigo appears only on
 * things you act on: primary buttons, the active nav item, links, focus
 * rings, chart marks.
 *
 * Status colours (emerald / amber / rose) are reserved for genuine state —
 * an approved/pending/rejected badge, a warning count — and always in the
 * muted `statusChip` form below. No decorative gradients, glows, or blur
 * orbs anywhere.
 */

export function dekanUI(isLight: boolean) {
  return {
    // Page shell / app background
    shell: isLight ? 'bg-slate-100' : 'bg-slate-950',

    // Primary surface (cards, panels)
    card: isLight
      ? 'bg-white border-slate-200'
      : 'bg-slate-900/60 border-slate-800',
    // Recessed surface inside a card (inputs, list rows, wells)
    inset: isLight
      ? 'bg-slate-50 border-slate-200'
      : 'bg-slate-800/40 border-slate-700/70',

    // Text
    strong: isLight ? 'text-slate-900' : 'text-slate-100',
    body: isLight ? 'text-slate-600' : 'text-slate-300',
    muted: isLight ? 'text-slate-500' : 'text-slate-400',
    faint: isLight ? 'text-slate-400' : 'text-slate-500',

    // Hairlines
    border: isLight ? 'border-slate-200' : 'border-slate-800',
    divide: isLight ? 'divide-slate-200' : 'divide-slate-800',

    // Accent — indigo, action only
    accentText: isLight ? 'text-indigo-600' : 'text-indigo-400',
    accentSolid: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-600/50',
    accentSoft: isLight
      ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
      : 'bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/15',
    accentBorder: isLight ? 'border-indigo-300' : 'border-indigo-500/40',
    ring: 'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500',

    // Form fields
    input: isLight
      ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
      : 'bg-slate-800/60 border-slate-700 text-slate-100 placeholder:text-slate-500',

    // Secondary (neutral) button
    btnGhost: isLight
      ? 'border border-slate-300 text-slate-700 hover:bg-slate-50'
      : 'border border-slate-700 text-slate-200 hover:bg-slate-800',

    // Destructive action — the one place rose is a button, kept restrained
    btnDanger: isLight
      ? 'bg-rose-600 text-white hover:bg-rose-700'
      : 'bg-rose-600 text-white hover:bg-rose-500',
    dangerSoft: isLight
      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
      : 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/15 border border-rose-500/25',
  }
}

/** Recharts / progress-bar colours — indigo primary, slate everywhere else. */
export const dekanChart = {
  primary: '#4f46e5', // indigo-600
  primarySoft: '#818cf8', // indigo-400
  track: (isLight: boolean) => (isLight ? '#e2e8f0' : '#1e293b'),
  grid: (isLight: boolean) => (isLight ? '#f1f5f9' : '#1e293b'),
  axis: (isLight: boolean) => (isLight ? '#64748b' : '#94a3b8'),
  tooltip: (isLight: boolean) => ({
    background: isLight ? '#ffffff' : '#0f172a',
    borderColor: isLight ? '#e2e8f0' : '#334155',
    color: isLight ? '#0f172a' : '#f1f5f9',
    fontSize: '11px',
    borderRadius: '10px',
  }),
  /** A short ordered series scale when a chart genuinely needs >1 colour. */
  series: ['#4f46e5', '#818cf8', '#c7d2fe', '#64748b', '#94a3b8'],
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
      chip: isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/10 text-emerald-300',
      text: isLight ? 'text-emerald-600' : 'text-emerald-400',
    },
    warning: {
      dot: 'bg-amber-500',
      chip: isLight ? 'bg-amber-50 text-amber-700' : 'bg-amber-500/10 text-amber-300',
      text: isLight ? 'text-amber-600' : 'text-amber-400',
    },
    danger: {
      dot: 'bg-rose-500',
      chip: isLight ? 'bg-rose-50 text-rose-700' : 'bg-rose-500/10 text-rose-300',
      text: isLight ? 'text-rose-600' : 'text-rose-400',
    },
    info: {
      dot: 'bg-indigo-500',
      chip: isLight ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-500/10 text-indigo-300',
      text: isLight ? 'text-indigo-600' : 'text-indigo-400',
    },
    neutral: {
      dot: isLight ? 'bg-slate-400' : 'bg-slate-500',
      chip: isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-300',
      text: isLight ? 'text-slate-500' : 'text-slate-400',
    },
  }
  return map[tone]
}
