'use client'

import React, { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import CustomSelect from '@/components/ui/CustomSelect'
import { generateRoomFloors } from '@/features/room-layout/client/api'
import { MAX_ROOMS_PER_FLOOR, describeFloorFill } from '@/features/room-layout/plan'
import type { RoomFloor, RoomNumbering } from '@/features/room-layout/types'
import { useThemeStore } from '@/lib/stores/theme-store'

interface Props {
  isOpen: boolean
  /** Floors declared in tizim sozlamalari (app_settings.floorCount). */
  floorCount: number
  /** The layout as it stands right now. */
  existingRooms: readonly RoomFloor[]
  /** Room numbers that hold a resident / approved permit — never deleted on trim. */
  occupiedRoomNumbers?: ReadonlySet<string>
  onClose: () => void
  onCreated: () => void
}

const DEFAULT_ROOMS_PER_FLOOR = 30

// Digits only, and no leading zeros ("016" -> "16"); '' stays '' so the
// field can be cleared. A number input bound to a numeric state renders a
// stale "016" after the "" -> 0 coercion, so this is text-backed instead.
const sanitizeCount = (raw: string) => raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 3)
const clampCount = (raw: string) => {
  const n = Number(sanitizeCount(raw) || 0)
  return String(Math.min(MAX_ROOMS_PER_FLOOR, Math.max(0, n)))
}

/**
 * Makes each floor hold exactly the room count the dekan types: appends
 * the numbers still missing, or deletes the excess EMPTY rooms (highest
 * number first) when a floor is over target. A room with a resident or an
 * approved permit is never deleted — the preview shows exactly what will
 * be added and removed before the dekan confirms.
 */
export default function RoomLayoutGeneratorModal({ isOpen, floorCount, existingRooms, occupiedRoomNumbers, onClose, onCreated }: Props) {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  // Text-backed (not numbers) — see sanitizeCount.
  const [counts, setCounts] = useState<Record<number, string>>({})
  const [numbering, setNumbering] = useState<RoomNumbering>('sequential')
  const [bulkValue, setBulkValue] = useState(String(DEFAULT_ROOMS_PER_FLOOR))
  const [saving, setSaving] = useState(false)

  const floors = useMemo(
    () => Array.from({ length: Math.max(0, floorCount) }, (_, index) => index + 1),
    [floorCount],
  )

  const existingCountByFloor = useMemo(() => {
    const map = new Map<number, number>()
    existingRooms.forEach((room) => map.set(room.floor, (map.get(room.floor) ?? 0) + 1))
    return map
  }, [existingRooms])

  // Re-seeded every time the dialog opens so a cancelled attempt doesn't
  // leave half-edited numbers behind. Each floor starts at whichever is
  // bigger — the usual default, or however many rooms it already has —
  // so opening the dialog never suggests a target that's already exceeded.
  useEffect(() => {
    if (!isOpen) return
    // Each floor starts at whatever it already has (or the default for a
    // blank floor) — so opening the dialog never proposes a change on its own.
    setCounts(Object.fromEntries(
      floors.map((floor) => {
        const existing = existingCountByFloor.get(floor) ?? 0
        return [floor, String(existing > 0 ? existing : DEFAULT_ROOMS_PER_FLOOR)]
      }),
    ))
    setBulkValue(String(DEFAULT_ROOMS_PER_FLOOR))
    setNumbering('sequential')
  }, [isOpen, floors, existingCountByFloor])

  const plans = floors.map((floor) => ({ floor, rooms: Number(counts[floor] || 0) }))
  const preview = describeFloorFill(plans, numbering, existingRooms, occupiedRoomNumbers)
  const totalNew = preview.reduce((sum, floor) => sum + floor.added, 0)
  const totalRemoved = preview.reduce((sum, floor) => sum + floor.removed, 0)
  const totalKeptOccupied = preview.reduce((sum, floor) => sum + floor.keptOccupied, 0)
  const grandTotal = preview.reduce((sum, floor) => sum + floor.total, 0)

  const setFloorCountValue = (floor: number, raw: string) => {
    setCounts((prev) => ({ ...prev, [floor]: sanitizeCount(raw) }))
  }

  const applyToAll = () => {
    const safe = clampCount(bulkValue)
    setCounts(Object.fromEntries(floors.map((floor) => [floor, safe])))
  }

  const noChange = totalNew === 0 && totalRemoved === 0

  const handleCreate = async () => {
    if (grandTotal === 0 && totalRemoved === 0) {
      toast.error('Kamida bitta xona kiritilishi kerak')
      return
    }
    if (noChange) {
      toast('Hech narsa o‘zgarmadi — sonlar hozirgidek', { icon: 'ℹ️' })
      return
    }
    setSaving(true)
    try {
      const { created, removed, keptOccupied } = await generateRoomFloors(plans, numbering)
      const parts: string[] = []
      if (created > 0) parts.push(`${created} ta xona qo'shildi`)
      if (removed > 0) parts.push(`${removed} ta bo'sh xona o'chirildi`)
      toast.success(parts.join(' · ') || 'Xona taqsimoti yangilandi')
      if (keptOccupied > 0) {
        toast(`${keptOccupied} ta xona bandligi sababli o'chirilmadi`, { icon: '⚠️' })
      }
      onCreated()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xona taqsimotini o'zgartirib bo'lmadi")
    } finally {
      setSaving(false)
    }
  }

  const confirmLabel = saving
    ? 'Saqlanmoqda...'
    : totalNew > 0 && totalRemoved > 0
      ? `+${totalNew} · −${totalRemoved} xona`
      : totalRemoved > 0
        ? `${totalRemoved} ta bo'sh xona o'chirish`
        : `${totalNew} ta yangi xona qo'shish`

  const labelCls = `block text-[10px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`
  const inputCls = `w-full rounded-xl border px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 ${
    isLight ? 'border-slate-200 bg-slate-50 text-slate-900' : 'border-white/10 bg-white/5 text-white'
  }`
  const panelCls = isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'

  return (
    <ConfirmModal
      isOpen={isOpen}
      title="Xona taqsimotini sozlash"
      description="Har bir qavatda JAMI nechta xona bo'lishi kerakligini kiriting. Yetishmayotgani qo'shiladi, ortiqcha BO'SH xonalar o'chiriladi — talabasi bor xona hech qachon o'chmaydi."
      maxWidthClass="max-w-2xl"
      confirmText={confirmLabel}
      onConfirm={handleCreate}
      onClose={onClose}
      isLoading={saving}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className={labelCls}>Raqamlash usuli</label>
            <CustomSelect
              value={numbering}
              onChange={(value) => setNumbering(value as RoomNumbering)}
              className={inputCls}
              options={[
                { value: 'sequential', label: "Ketma-ket (1, 2, 3 ...)" },
                { value: 'per-floor', label: 'Qavat bo‘yicha (101, 102 ... 201 ...)' },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Hamma qavatga bir xil (jami)</label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={bulkValue}
                onChange={(event) => setBulkValue(sanitizeCount(event.target.value))}
                onBlur={() => setBulkValue(clampCount(bulkValue))}
                className={inputCls}
              />
              <button
                type="button"
                onClick={applyToAll}
                className={`shrink-0 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
                  isLight
                    ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                Qo&apos;llash
              </button>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 ${panelCls}`}>
          <p className={`mb-3 text-[10px] font-black uppercase tracking-wider ${textMuted}`}>
            Qavatda jami nechta xona bo&apos;lsin
          </p>
          {floors.length === 0 ? (
            <p className={`text-xs font-bold ${textMuted}`}>
              Tizim sozlamalarida qavatlar soni belgilanmagan.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {floors.map((floor) => {
                const existing = existingCountByFloor.get(floor) ?? 0
                return (
                  <div key={floor} className="space-y-1.5">
                    <label className={labelCls}>
                      {floor}-qavat {existing > 0 && <span className="normal-case font-bold text-amber-500">({existing} bor)</span>}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={counts[floor] ?? ''}
                      onChange={(event) => setFloorCountValue(floor, event.target.value)}
                      onBlur={() => setCounts((prev) => ({ ...prev, [floor]: clampCount(prev[floor] ?? '') }))}
                      className={inputCls}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Exact outcome, from the same helper the server uses — what is
            shown here is literally what gets created. */}
        <div className={`rounded-2xl border p-4 ${panelCls}`}>
          <p className={`mb-3 text-[10px] font-black uppercase tracking-wider ${textMuted}`}>
            Natija
          </p>
          <div className="space-y-1.5">
            {preview.map(({ floor, existing, added, removed, keptOccupied, total }) => {
              const unchanged = added === 0 && removed === 0
              return (
                <div key={floor} className="flex items-center justify-between gap-3 text-xs font-bold">
                  <span className={textMuted}>{floor}-qavat</span>
                  <span className={unchanged ? textMuted : textStrong}>
                    {total === 0 && existing === 0
                      ? "xona yo'q"
                      : unchanged
                        ? `${existing} ta (o'zgarishsiz)`
                        : [
                            added > 0 ? `+${added}` : null,
                            removed > 0 ? `−${removed} bo'sh` : null,
                          ].filter(Boolean).join(' · ') + ` → ${total} ta`}
                    {keptOccupied > 0 && (
                      <span className={isLight ? 'text-amber-600' : 'text-amber-400'}> ({keptOccupied} band qoladi)</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
          <div className={`mt-3 flex items-center justify-between border-t pt-3 text-xs font-black ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
            <span className={textMuted}>Natijada</span>
            <span className={textStrong}>
              {[totalNew > 0 ? `+${totalNew}` : null, totalRemoved > 0 ? `−${totalRemoved}` : null]
                .filter(Boolean).join(' · ') || 'o‘zgarishsiz'} · jami {grandTotal} ta
            </span>
          </div>
        </div>

        <p className={`text-[10px] font-bold leading-relaxed ${textMuted}`}>
          Talabasi bor yoki yo&apos;llanma biriktirilgan xona hech qachon o&apos;chirilmaydi
          {totalKeptOccupied > 0 && ` (${totalKeptOccupied} tasi shu sababli qoladi)`}.
          O&apos;chirish faqat eng katta raqamli bo&apos;sh xonalardan boshlanadi. Barcha xonalar
          &laquo;Qavat tarxi quruvchisi&raquo;da ham ko&apos;rinadi.
        </p>
      </div>
    </ConfirmModal>
  )
}
