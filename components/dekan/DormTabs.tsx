'use client'

import { Building2 } from 'lucide-react'
import { dekanUI } from '@/lib/dekan-ui'
import type { useDormTabs } from '@/lib/hooks/useDormTabs'

export default function DormTabs({ scope, isLight, onChange }: {
  scope: ReturnType<typeof useDormTabs>
  isLight: boolean
  onChange?: () => void
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
  if (!scope.ready) return <p role="status" className={`text-sm ${ui.muted}`}>Yotoqxonalar yuklanmoqda…</p>
  const tabs = [
    ...scope.dorms.map((dorm) => ({ id: dorm.dormId as string | null, label: `${dorm.number}-yotoqxona` })),
    { id: null, label: 'Yotoqxona biriktirilmagan' }
  ]
  return (
    <div
      role="group"
      aria-label="Yotoqxona tanlash"
      className={`no-shelf inline-flex max-w-full items-center gap-1.5 p-1.5 rounded-2xl border overflow-x-auto scrollbar-none transition-colors ${
        isLight
          ? 'bg-slate-100/90 border-slate-200/80'
          : 'bg-slate-950/70 border-slate-800/90'
      }`}
    >
      {tabs.map((tab) => {
        const isActive = scope.dormId === tab.id
        return (
          <button
            key={tab.id ?? 'unassigned'}
            type="button"
            aria-pressed={isActive}
            onClick={() => {
              if (scope.dormId !== tab.id) {
                onChange?.()
                scope.select(tab.id)
              }
            }}
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
