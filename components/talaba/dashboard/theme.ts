/**
 * The talaba dashboard's shared surface/text class bundle, keyed off the
 * current theme. Cards call this with `isLight` instead of each re-deriving
 * the same handful of strings.
 */
export function dashboardTheme(isLight: boolean) {
  return {
    surfaceBg: isLight
      ? 'bg-white/80 border-slate-200/80 shadow-xl shadow-slate-100/40'
      : 'bg-[#0f172a]/30 border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.3)]',
    textMuted: isLight ? 'text-slate-500' : 'text-slate-400',
    textStrong: isLight ? 'text-slate-900' : 'text-white',
    cardBorder: isLight ? 'border-slate-100' : 'border-white/5',
    cardInnerBg: isLight ? 'bg-slate-50/70 hover:bg-slate-100/50' : 'bg-white/5 hover:bg-white/10',
  };
}
