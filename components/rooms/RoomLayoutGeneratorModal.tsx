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
  /** The layout as it stands right now — rooms already here are never touched. */
  existingRooms: readonly RoomFloor[]
  onClose: () => void
  onCreated: () => void
}

const DEFAULT_ROOMS_PER_FLOOR = 30

/**
 * Tops up the layout: the dekan says how many rooms each floor should have
 * *in total*, sees exactly which room numbers are still missing, and
 * confirms. Rooms that already exist — including ones nobody explicitly
 * drew, like a room a student was placed into before the layout existed —
 * are left completely alone; this only ever fills the gaps.
 */
export default function RoomLayoutGeneratorModal({ isOpen, floorCount, existingRooms, onClose, onCreated }: Props) {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const [counts, setCounts] = useState<Record<number, number>>({})
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
    setCounts(Object.fromEntries(
      floors.map((floor) => [floor, Math.max(DEFAULT_ROOMS_PER_FLOOR, existingCountByFloor.get(floor) ?? 0)]),
    ))
    setBulkValue(String(DEFAULT_ROOMS_PER_FLOOR))
    setNumbering('sequential')
  }, [isOpen, floors, existingCountByFloor])

  const plans = floors.map((floor) => ({ floor, rooms: counts[floor] ?? 0 }))
  const preview = describeFloorFill(plans, numbering, existingRooms)
  const totalNew = preview.reduce((sum, floor) => sum + floor.added, 0)
  const grandTotal = preview.reduce((sum, floor) => sum + floor.total, 0)

  const setFloorCountValue = (floor: number, raw: string) => {
    const parsed = Number(raw)
    const safe = Number.isFinite(parsed) ? Math.min(MAX_ROOMS_PER_FLOOR, Math.max(0, Math.trunc(parsed))) : 0
    setCounts((prev) => ({ ...prev, [floor]: safe }))
  }

  const applyToAll = () => {
    const parsed = Number(bulkValue)
    if (!Number.isFinite(parsed)) return
    const safe = Math.min(MAX_ROOMS_PER_FLOOR, Math.max(0, Math.trunc(parsed)))
    setCounts(Object.fromEntries(floors.map((floor) => [floor, safe])))
  }

  const handleCreate = async () => {
    if (grandTotal === 0) {
      toast.error('Kamida bitta xona kiritilishi kerak')
      return
    }
    setSaving(true)
    try {
      const { created } = await generateRoomFloors(plans, numbering)
      toast.success(created > 0 ? `${created} ta yangi xona qo'shildi` : "Yangi xona qo'shilmadi — barchasi allaqachon mavjud edi")
      onCreated()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xonalarni qo'shib bo'lmadi")
    } finally {
      setSaving(false)
    }
  }

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
      title="Xonalarni to'ldirish"
      description="Har bir qavatda JAMI nechta xona bo'lishi kerakligini kiriting — mavjud xonalar o'zgarmaydi, faqat yetishmaydiganlari qo'shiladi."
      maxWidthClass="max-w-2xl"
      confirmText={saving ? "Qo'shilmoqda..." : `${totalNew} ta yangi xona qo'shish`}
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
                type="number"
                min={0}
                max={MAX_ROOMS_PER_FLOOR}
                value={bulkValue}
                onChange={(event) => setBulkValue(event.target.value)}
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
                      type="number"
                      min={0}
                      max={MAX_ROOMS_PER_FLOOR}
                      value={counts[floor] ?? 0}
                      onChange={(event) => setFloorCountValue(floor, event.target.value)}
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
            {preview.map(({ floor, existing, added, total }) => (
              <div key={floor} className="flex items-center justify-between gap-3 text-xs font-bold">
                <span className={textMuted}>{floor}-qavat</span>
                <span className={added === 0 && total === 0 ? textMuted : textStrong}>
                  {total === 0
                    ? "xona yo'q"
                    : added === 0
                      ? `${existing} ta (o'zgarishsiz)`
                      : existing === 0
                        ? `${added} ta yangi`
                        : `${existing} bor + ${added} yangi = ${total} ta`}
                </span>
              </div>
            ))}
          </div>
          <div className={`mt-3 flex items-center justify-between border-t pt-3 text-xs font-black ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
            <span className={textMuted}>Jami yangi xona</span>
            <span className={textStrong}>{totalNew} ta ({grandTotal} ta bo&apos;ladi)</span>
          </div>
        </div>

        <p className={`text-[10px] font-bold leading-relaxed ${textMuted}`}>
          Mavjud xonalar (talabasi bor yoki qo&apos;lda kiritilgan) hech qanday o&apos;zgarishsiz qoladi.
          Barcha xonalar admin paneldagi &laquo;Qavat tarxi quruvchisi&raquo;da ham ko&apos;rinadi — u yerdan
          joylashuvini o&apos;zgartirish mumkin.
        </p>
      </div>
    </ConfirmModal>
  )
}
