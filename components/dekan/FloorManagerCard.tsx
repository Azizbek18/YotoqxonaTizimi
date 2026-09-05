'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Layers3, Plus, Minus, ArrowRight, Wand2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { dekanUI } from '@/lib/dekan-ui'
import { useThemeStore } from '@/lib/stores/theme-store'
import { updateAppSettings } from '@/features/app-settings/client/api'
import { getRoomCapacityBreakdown } from '@/features/room-layout/floor-map'
import type { RoomFloorStatus } from '@/features/room-layout/types'
import RoomLayoutGeneratorModal from '@/components/rooms/RoomLayoutGeneratorModal'
import ConfirmModal from '@/components/ui/ConfirmModal'

const MAX_FLOORS = 50

/**
 * The interactive floor manager inside "Xona va qavat sozlamalari". Each
 * floor shows its real room count (from floor_room_layout) and capacity
 * breakdown; the dekan adds/removes floors here (saved immediately, since
 * it's structural, not batched with the page's Save button) and jumps
 * straight to a floor in the Qavat tarxi builder, or bulk-generates rooms.
 */
export default function FloorManagerCard({
  floorCount,
  defaultCapacity,
  rooms,
  roomsLoaded,
  onFloorCountSaved,
  onRoomsChanged,
  dormId,
}: {
  floorCount: number
  defaultCapacity: number
  rooms: RoomFloorStatus[]
  roomsLoaded: boolean
  onFloorCountSaved: (floorCount: number) => void
  onRoomsChanged: () => void
  /** Which of the faculty's buildings (many-to-many, 202609300000) this
   *  card manages — omitted resolves to the primary, matching every
   *  dormId-optional call below. */
  dormId?: string
}) {
  const isLight = useThemeStore((state) => state.theme === 'light')
  const ui = dekanUI(isLight)

  const [busy, setBusy] = useState(false)
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const floorRows = useMemo(() => {
    const byFloor = new Map<number, RoomFloorStatus[]>()
    for (const room of rooms) {
      const list = byFloor.get(room.floor) ?? []
      list.push(room)
      byFloor.set(room.floor, list)
    }
    const declared = Array.from({ length: Math.max(0, floorCount) }, (_, i) => i + 1)
    const allFloors = [...new Set([...declared, ...byFloor.keys()])].sort((a, b) => a - b)
    return allFloors.map((floor) => {
      const floorRooms = byFloor.get(floor) ?? []
      const live = floorRooms.filter((r) => !r.frozen)
      return {
        floor,
        count: floorRooms.length,
        frozen: floorRooms.length - live.length,
        beds: defaultCapacity === null ? null : live.reduce((s, r) => s + (r.capacity ?? defaultCapacity), 0),
        breakdown: getRoomCapacityBreakdown(live, defaultCapacity),
        beyondDeclared: floor > floorCount,
      }
    })
  }, [rooms, floorCount, defaultCapacity])

  const topFloorRoomCount = floorRows.find((row) => row.floor === floorCount)?.count ?? 0
  const canRemoveTop = floorCount > 1 && topFloorRoomCount === 0

  const saveFloorCount = async (next: number) => {
    if (next < 1 || next > MAX_FLOORS || next === floorCount) return
    setBusy(true)
    try {
      const updated = await updateAppSettings({ floorCount: next }, dormId)
      onFloorCountSaved(updated.floorCount)
      toast.success(
        next > floorCount ? `${next}-qavat qo'shildi` : `Qavatlar soni: ${next}`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Qavatlar sonini o'zgartirib bo'lmadi")
    } finally {
      setBusy(false)
      setConfirmRemove(false)
    }
  }

  return (
    <div className={`rounded-xl border p-4 sm:p-5 ${ui.inset}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className={`flex items-center gap-2 text-sm font-semibold ${ui.strong}`}>
            <Layers3 size={16} className={`shrink-0 ${ui.accentText}`} />
            Qavatlar va xonalar
          </h3>
          <p className={`mt-1 text-xs ${ui.muted}`}>
            Har qavatda xona soni turlicha bo&apos;lishi mumkin. Xonalarni &laquo;3D Xonalar&raquo;
            bo&apos;limida qo&apos;shasiz — talaba qavatini shu taqsimotdan oladi.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={busy || !canRemoveTop}
            onClick={() => setConfirmRemove(true)}
            title={
              floorCount <= 1
                ? "Kamida bitta qavat bo'lishi kerak"
                : topFloorRoomCount > 0
                  ? `${floorCount}-qavatda xonalar bor — avval ularni o'chiring`
                  : `${floorCount}-qavatni o'chirish`
            }
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-40 ${ui.btnGhost}`}
          >
            <Minus size={14} />
          </button>
          <span className={`min-w-[64px] text-center text-sm font-bold tabular-nums ${ui.strong}`}>
            {floorCount} qavat
          </span>
          <button
            type="button"
            disabled={busy || floorCount >= MAX_FLOORS}
            onClick={() => saveFloorCount(floorCount + 1)}
            title="Yuqoriga yangi qavat qo'shish"
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${ui.accentSolid}`}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {!roomsLoaded ? (
        <p className={`mt-4 text-xs font-medium ${ui.muted}`}>Yuklanmoqda...</p>
      ) : (
        <div className="mt-4 space-y-1.5">
          {floorRows.map(({ floor, count, frozen, beds, breakdown, beyondDeclared }) => {
            const empty = count === 0
            const breakdownText = [
              breakdown.map((b) => `${b.count}×${b.capacity}`).join(' · '),
              beds !== null ? `${beds} o‘rin` : '',
              frozen > 0 ? `${frozen} muzlatilgan` : '',
            ].filter(Boolean).join(' · ')
            return (
              <div
                key={floor}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 ${
                  empty
                    ? isLight ? 'border-amber-200 bg-amber-50' : 'border-amber-500/25 bg-amber-500/10'
                    : isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800/40'
                }`}
              >
                <span className={`w-16 shrink-0 text-xs font-bold ${empty ? (isLight ? 'text-amber-700' : 'text-amber-300') : ui.strong}`}>
                  {floor}-qavat
                </span>
                <span className={`shrink-0 text-[11px] font-semibold tabular-nums ${empty ? (isLight ? 'text-amber-600' : 'text-amber-400') : ui.muted}`}>
                  {empty ? 'Xona kiritilmagan' : `${count} ta xona`}
                </span>
                {breakdownText && (
                  <span className={`min-w-0 flex-1 truncate text-[11px] tabular-nums ${ui.muted}`} title={breakdownText}>
                    {breakdownText}
                  </span>
                )}
                {beyondDeclared && !empty && (
                  <span className={`shrink-0 text-[10px] font-semibold ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>
                    qavatlar sonidan tashqarida
                  </span>
                )}
                <Link
                  href={`/dekan/3d-xonalar?floor=${floor}${dormId ? `&dormId=${dormId}` : ''}`}
                  className={`ml-auto shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    empty ? ui.accentSolid : ui.btnGhost
                  }`}
                >
                  {empty ? 'Xona qo’shish' : 'Tahrirlash'}
                  <ArrowRight size={12} />
                </Link>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setGeneratorOpen(true)}
          className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${ui.btnGhost}`}
        >
          <Wand2 size={13} />
          Xonalarni ommaviy yaratish
        </button>
        <Link
          href={`/dekan/xonalar${dormId ? `?dormId=${dormId}` : ''}`}
          className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${ui.accentSolid}`}
        >
          Xonalar xaritasi
          <ArrowRight size={13} />
        </Link>
      </div>

      <RoomLayoutGeneratorModal
        isOpen={generatorOpen}
        floorCount={floorCount}
        existingRooms={rooms}
        dormId={dormId}
        onClose={() => setGeneratorOpen(false)}
        onCreated={() => {
          setGeneratorOpen(false)
          onRoomsChanged()
        }}
      />

      <ConfirmModal
        isOpen={confirmRemove}
        title={`${floorCount}-qavatni o'chirish`}
        description="Bino bir qavatga pasaytiriladi."
        confirmText="O'chirish"
        cancelText="Bekor qilish"
        confirmVariant="danger"
        isLoading={busy}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => saveFloorCount(floorCount - 1)}
      >
        <p className={ui.muted}>
          {floorCount}-qavatda xona yo&apos;q, shuning uchun o&apos;chirish xavfsiz. Keyinchalik
          &laquo;+&raquo; bilan qaytadan qo&apos;shishingiz mumkin.
        </p>
      </ConfirmModal>
    </div>
  )
}
