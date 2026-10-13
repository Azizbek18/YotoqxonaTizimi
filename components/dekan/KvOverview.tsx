'use client'

import { AlertTriangle, Clock, MapPinOff, Users } from 'lucide-react'
import { dekanUI } from '@/lib/dekan-ui'

export type KvQuickFilter = 'all' | 'no-address' | 'expired' | 'expiring' | 'no-docs'

export type KvOverviewStudent = {
  residence_address?: string | null
  docs_worst_days?: number | null
  docs_count?: number
}

/** Tezkor filtr shartini bajaradimi? (sahifadagi ro'yxat va hisoblagich bir xil qoidadan foydalanadi) */
export function matchesKvQuickFilter(student: KvOverviewStudent, filter: KvQuickFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'no-address':
      return !student.residence_address
    case 'expired':
      return student.docs_worst_days != null && student.docs_worst_days < 0
    case 'expiring':
      return student.docs_worst_days != null && student.docs_worst_days >= 0 && student.docs_worst_days <= 30
    case 'no-docs':
      return (student.docs_count ?? 0) === 0
  }
}

const TILES: { key: KvQuickFilter; label: string; hint: string; icon: typeof Users; tone: string }[] = [
  { key: 'all', label: 'Barchasi', hint: 'Ro‘yxatdagi talabalar', icon: Users, tone: 'indigo' },
  { key: 'expired', label: 'Muddati o‘tgan', hint: 'Hujjati tugagan', icon: AlertTriangle, tone: 'rose' },
  { key: 'expiring', label: '30 kunda tugaydi', hint: 'Yaqin muddat', icon: Clock, tone: 'amber' },
  { key: 'no-address', label: 'Manzilsiz', hint: 'Manzil kiritmagan', icon: MapPinOff, tone: 'slate' },
]

const TONE_ACTIVE: Record<string, string> = {
  indigo: 'border-indigo-500 ring-2 ring-indigo-500/30',
  rose: 'border-rose-500 ring-2 ring-rose-500/30',
  amber: 'border-amber-500 ring-2 ring-amber-500/30',
  slate: 'border-slate-500 ring-2 ring-slate-500/30',
}

const TONE_ICON_LIGHT: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  rose: 'bg-rose-50 text-rose-600',
  amber: 'bg-amber-50 text-amber-600',
  slate: 'bg-slate-100 text-slate-600',
}
const TONE_ICON_DARK: Record<string, string> = {
  indigo: 'bg-indigo-500/15 text-indigo-300',
  rose: 'bg-rose-500/15 text-rose-300',
  amber: 'bg-amber-500/15 text-amber-300',
  slate: 'bg-slate-500/15 text-slate-300',
}

export default function KvOverview({
  students,
  active,
  onSelect,
  isLight,
}: {
  students: KvOverviewStudent[]
  active: KvQuickFilter
  onSelect: (filter: KvQuickFilter) => void
  isLight: boolean
}) {
  const ui = dekanUI(isLight)
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {TILES.map((tile) => {
        const count = students.filter((s) => matchesKvQuickFilter(s, tile.key)).length
        const isActive = active === tile.key
        const Icon = tile.icon
        return (
          <button
            key={tile.key}
            type="button"
            onClick={() => onSelect(isActive && tile.key !== 'all' ? 'all' : tile.key)}
            aria-pressed={isActive}
            className={`no-shelf cursor-pointer rounded-2xl border p-4 text-left transition-all ${ui.card} ${ui.hoverLift} ${isActive ? TONE_ACTIVE[tile.tone] : ''}`}
          >
            <div className="flex items-center gap-3">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${(isLight ? TONE_ICON_LIGHT : TONE_ICON_DARK)[tile.tone]}`}>
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <p className={`text-2xl font-black leading-none tabular-nums ${ui.strong}`}>{count}</p>
                <p className={`mt-1 truncate text-[11px] font-bold ${ui.body}`}>{tile.label}</p>
              </div>
            </div>
            <p className={`mt-2 truncate text-[10px] ${ui.faint}`}>{tile.hint}</p>
          </button>
        )
      })}
    </div>
  )
}
