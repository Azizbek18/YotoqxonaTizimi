'use client'

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
    <div className={`rounded-xl border p-4 ${ui.card}`}>
      <p className={`text-sm ${ui.muted}`}>{scope.error}</p>
      <button onClick={scope.reload} className="mt-2 text-sm font-semibold text-indigo-600">Qayta urinish</button>
    </div>
  )
  if (!scope.ready) return <p role="status" className={`text-sm ${ui.muted}`}>Yotoqxonalar yuklanmoqda…</p>
  const tabs = [...scope.dorms.map((dorm) => ({ id: dorm.dormId as string | null, label: `${dorm.number}-yotoqxona` })),
    { id: null, label: 'Yotoqxona biriktirilmagan' }]
  return (
    <div role="group" aria-label="Yotoqxona tanlash" className={`flex gap-2 overflow-x-auto rounded-xl border p-2 ${ui.card}`}>
      {tabs.map((tab) => (
        <button key={tab.id ?? 'unassigned'} aria-pressed={scope.dormId === tab.id}
          onClick={() => { if (scope.dormId !== tab.id) { onChange?.(); scope.select(tab.id) } }}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${scope.dormId === tab.id
            ? 'bg-indigo-600 text-white' : `${ui.muted} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'}`}`}>
          {tab.label}
        </button>
      ))}
    </div>
  )
}
