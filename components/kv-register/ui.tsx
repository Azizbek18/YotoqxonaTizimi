'use client'

import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Shared look for the KV-talaba wizard so the five steps stay visually
// identical: one input height (48px, 16px text so iOS never zooms on focus),
// sentence-case labels, one primary/back button pair.
export function kvStyles(isLight: boolean) {
  const field = isLight
    ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100'
    : 'bg-white/[0.04] border-white/12 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20'
  return {
    label: `block text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`,
    hint: `text-xs leading-snug ${isLight ? 'text-slate-500' : 'text-slate-400'}`,
    icon: isLight ? 'text-slate-400' : 'text-slate-500',
    input: `h-12 w-full rounded-xl border pl-11 pr-3 text-base font-medium outline-none transition-all disabled:cursor-not-allowed disabled:opacity-40 ${field}`,
    inputPlain: `h-12 w-full rounded-xl border px-3.5 text-base font-medium outline-none transition-all disabled:opacity-50 ${field}`,
    select: `h-12 w-full rounded-xl border px-3.5 text-base ${
      isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-white/[0.04] border-white/12 text-white'
    }`,
    title: isLight ? 'text-slate-900' : 'text-white',
  }
}

/** Slim segmented progress: "Qadam 2/5 · Aloqa" + one bar per step. Never overflows. */
export function KvStepper({ current, names, isLight }: { current: number; names: string[]; isLight: boolean }) {
  const total = names.length
  return (
    <div className="mb-5" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current}>
      <div className="mb-2 flex items-baseline justify-between text-xs">
        <span className={`font-bold ${isLight ? 'text-blue-700' : 'text-blue-300'}`}>{names[current - 1]}</span>
        <span className={`font-semibold tabular-nums ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          {current}/{total}
        </span>
      </div>
      <div className="flex gap-1.5">
        {names.map((name, i) => (
          <span
            key={name}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i < current
                ? 'bg-gradient-to-r from-blue-600 to-indigo-500'
                : isLight ? 'bg-slate-200' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export function KvStepHeader({ icon: Icon, title, subtitle, isLight }: {
  icon: LucideIcon
  title: string
  subtitle: string
  isLight: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
        isLight ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-100' : 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/20'
      }`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <h2 className={`text-base font-extrabold leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>{title}</h2>
        <p className={`mt-0.5 text-xs leading-snug ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{subtitle}</p>
      </div>
    </div>
  )
}

/** Back (icon) + primary action row shared by every step. */
export function KvActions({ isLight, onBack, onNext, label = 'Davom etish', icon, disabled, loading }: {
  isLight: boolean
  onBack?: () => void
  onNext: () => void
  label?: string
  icon?: ReactNode
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <div className="flex items-center gap-3 pt-1">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          aria-label="Orqaga"
          title="Orqaga"
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-all disabled:opacity-40 ${
            isLight
              ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
          }`}
        >
          <ArrowLeft size={18} />
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <>
            {icon}
            <span className="whitespace-nowrap">{label}</span>
            {!icon && <ArrowRight size={16} className="shrink-0" />}
          </>
        )}
      </button>
    </div>
  )
}
