'use client'

import { Building2 } from 'lucide-react'
import { dekanUI } from '@/lib/dekan-ui'
import { Skel } from '@/components/ui/skeletons'
import type { useDormTabs } from '@/lib/hooks/useDormTabs'

// Roughly "7-yotoqxona", "8-yotoqxona", "Yotoqxona biriktirilmagan".
const LOADING_LABEL_WIDTHS = ['w-16', 'w-16', 'w-36']

export default function DormTabs({ scope, isLight, onChange, variant = 'surface' }: {
  scope: ReturnType<typeof useDormTabs>
  isLight: boolean
  onChange?: () => void
  /** `onBrand`: glass pills that wrap, for use inside an indigo gradient hero. */
  variant?: 'surface' | 'onBrand'
}) {
  if (scope.global) return null
  const ui = dekanUI(isLight)
  if (scope.error) return (
    <div className={`no-shelf rounded-2xl border p-4 ${ui.card}`}>
      <p className={`text-sm ${ui.muted}`}>{scope.error}</p>
      <button onClick={scope.reload} className="no-shelf mt-2 text-sm font-semibold text-indigo-600 hover:underline">
        Qayta urinish
      </button>
    </div>
  )
  const strip = `no-shelf inline-flex max-w-full items-center gap-1.5 p-1.5 rounded-2xl border ${
    isLight
      ? 'bg-slate-100/90 border-slate-200/80'
      : 'bg-slate-950/70 border-slate-800/90'
  }`
  // Same strip and tab sizes as the loaded state, so nothing jumps when the dorms arrive.
  if (!scope.ready) return (
    <div role="status" className={`${strip} overflow-hidden`}>
      <span className="sr-only">Yotoqxonalar yuklanmoqda…</span>
      {LOADING_LABEL_WIDTHS.map((width, i) => (
        <span
          key={i}
          aria-hidden
          className={`inline-flex h-[34px] sm:h-[38px] shrink-0 items-center gap-2 px-3.5 rounded-xl border ${
            i === 0
              ? isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-white/[0.04] border-slate-800'
              : 'border-transparent'
          }`}
        >
          <Building2 size={15} className={`shrink-0 ${isLight ? 'text-slate-300' : 'text-slate-700'}`} />
          <Skel className={`h-2.5 rounded-full ${width}`} />
        </span>
      ))}
    </div>
  )
  const tabs = [
    ...scope.dorms.map((dorm) => ({ id: dorm.dormId as string | null, label: `${dorm.number}-yotoqxona` })),
    { id: null, label: 'Yotoqxona biriktirilmagan' }
  ]
  const pick = (id: string | null) => {
    if (scope.dormId !== id) {
      onChange?.()
      scope.select(id)
    }
  }
  // On the gradient the pills wrap instead of scrolling, so no dorm is cut off on a phone.
  // bg-white/15 rather than /10: the light-mode retrofit turns bg-white/10 into pale glass.
  if (variant === 'onBrand') return (
    <div role="group" aria-label="Yotoqxona tanlash" className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      {tabs.map((tab) => {
        const isActive = scope.dormId === tab.id
        return (
          <button
            key={tab.id ?? 'unassigned'}
            type="button"
            aria-pressed={isActive}
            onClick={() => pick(tab.id)}
            className={`no-shelf inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors select-none active:scale-[0.98] ${
              isActive
                ? 'bg-white text-indigo-700 shadow-md shadow-indigo-950/25'
                : 'bg-white/15 text-indigo-100 ring-1 ring-inset ring-white/20 hover:bg-white/25'
            }`}
          >
            <Building2 size={13} className="shrink-0" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
  return (
    <div
      role="group"
      aria-label="Yotoqxona tanlash"
      className={`${strip} overflow-x-auto scrollbar-none transition-colors`}
    >
      {tabs.map((tab) => {
        const isActive = scope.dormId === tab.id
        return (
          <button
            key={tab.id ?? 'unassigned'}
            type="button"
            aria-pressed={isActive}
            onClick={() => pick(tab.id)}
            className={`no-shelf relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 shrink-0 select-none active:scale-[0.98] ${
              isActive
                ? isLight
                  ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80 font-bold'
                  : 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30 border border-indigo-500/30 font-bold'
                : isLight
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] border border-transparent'
            }`}
          >
            <Building2
              size={15}
              className={`shrink-0 transition-colors ${
                isActive
                  ? isLight ? 'text-indigo-600' : 'text-white'
                  : isLight ? 'text-slate-400' : 'text-slate-500'
              }`}
            />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
