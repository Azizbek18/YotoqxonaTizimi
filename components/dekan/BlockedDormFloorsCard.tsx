'use client'

import Link from 'next/link'
import { Building2, ChevronRight, Layers3 } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI } from '@/lib/dekan-ui'
import type { BlockedRoomSection, DekanDorm } from '@/features/dorms/types'

export type AssignedBlockedFloor = {
  floor: number
  blocks: string[]
}

export function groupAssignedBlockedFloors(sections: BlockedRoomSection[]): AssignedBlockedFloor[] {
  const blocksByFloor = new Map<number, Set<string>>()

  for (const section of sections) {
    const blocks = blocksByFloor.get(section.floor) ?? new Set<string>()
    blocks.add(section.block)
    blocksByFloor.set(section.floor, blocks)
  }

  return [...blocksByFloor.entries()]
    .sort(([a], [b]) => a - b)
    .map(([floor, blocks]) => ({
      floor,
      blocks: [...blocks].sort((a, b) => a.localeCompare(b)),
    }))
}

export default function BlockedDormFloorsCard({
  dorm,
  sections,
  loading,
  loadFailed = false,
}: {
  dorm: DekanDorm
  sections: BlockedRoomSection[]
  loading: boolean
  loadFailed?: boolean
}) {
  const isLight = useThemeStore((state) => state.theme === 'light')
  const ui = dekanUI(isLight)
  const floors = groupAssignedBlockedFloors(sections)

  return (
    <section className={`overflow-hidden rounded-2xl border ${ui.card}`}>
      <div className={`flex items-start justify-between gap-3 border-b p-5 ${ui.border}`}>
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ui.accentTile}`}>
            <Building2 size={18} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h3 className={`text-sm font-bold tracking-tight ${ui.strong}`}>
              {dorm.number}-yotoqxona
            </h3>
            <p className={`mt-0.5 text-[11px] ${ui.muted}`}>
              Admin fakultetingizga biriktirgan qavatlar
            </p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${ui.accentSoft}`}>
          Blokli bino
        </span>
      </div>

      <div className="p-5">
        {loading ? (
          <div className={`h-16 animate-pulse rounded-xl border ${ui.inset}`} aria-label="Qavatlar yuklanmoqda" />
        ) : loadFailed ? (
          <div className={`rounded-xl border px-4 py-5 text-center ${ui.inset}`} role="alert">
            <p className={`text-sm font-semibold ${ui.strong}`}>Qavatlarni yuklab bo‘lmadi</p>
            <p className={`mt-1 text-xs ${ui.muted}`}>
              Sahifani yangilang. Muammo davom etsa, administratorga xabar bering.
            </p>
          </div>
        ) : floors.length === 0 ? (
          <div className={`rounded-xl border px-4 py-5 text-center ${ui.inset}`}>
            <p className={`text-sm font-semibold ${ui.strong}`}>Qavat biriktirilmagan</p>
            <p className={`mt-1 text-xs ${ui.muted}`}>
              Admin fakultetingizga blok yoki qavat biriktirgach, u shu yerda avtomatik ko‘rinadi.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {floors.map(({ floor, blocks }) => (
              <div
                key={floor}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${ui.inset}`}
              >
                <span className={`flex items-center gap-2 text-sm font-bold ${ui.strong}`}>
                  <Layers3 size={16} className={ui.accentText} />
                  {floor}-qavat
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {blocks.map((block) => (
                    <span key={block} className={`rounded-lg px-2 py-1 text-[10px] font-bold ${ui.accentSoft}`}>
                      {block}-blok
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {floors.length > 0 && (
          <Link
            href="/dekan/blok-xonalar"
            className={`mt-4 inline-flex items-center gap-1 text-xs font-bold ${ui.accentText}`}
          >
            Biriktirilgan xonalarni ko‘rish <ChevronRight size={14} />
          </Link>
        )}
      </div>
    </section>
  )
}
