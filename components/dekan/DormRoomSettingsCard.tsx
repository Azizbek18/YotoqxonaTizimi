'use client'

import { useCallback, useEffect, useState } from 'react'
import { Boxes, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRoomFloors } from '@/lib/hooks/useRoomFloors'
import { useThemeStore } from '@/lib/stores/theme-store'
import { fetchDekanSettings, updateAppSettings } from '@/features/app-settings/client/api'
import type { DekanDorm } from '@/features/dorms/types'
import FloorManagerCard from './FloorManagerCard'
import { dekanUI } from '@/lib/dekan-ui'
import { SkelForm } from '@/components/ui/skeletons'

/**
 * "Xona va qavat sozlamalari" for ONE specific building. A faculty can hold
 * several buildings (many-to-many, 202609300000) — floorCount/defaultRoomCapacity
 * and the room layout live per-dorm, not per-faculty, so this card (and the
 * rooms it manages) is scoped to `dorm.dormId` end to end: its own
 * useRoomFloors, its own fetchDekanSettings/updateAppSettings calls. Rendered
 * once per building in app/dekan/sozlamalar — before this, only the primary
 * building had any of this, so a faculty's second (or third) building had no
 * way to define its floors or generate/draw its rooms at all.
 */
export default function DormRoomSettingsCard({ dorm }: { dorm: DekanDorm }) {
  const isLight = useThemeStore((state) => state.theme === 'light')
  const ui = dekanUI(isLight)

  const { rooms, loaded: roomsLoaded, reload: reloadRooms } = useRoomFloors(dorm.dormId)

  const [floorCount, setFloorCount] = useState<number | null>(null)
  const [defaultCapacity, setDefaultCapacity] = useState<number | null>(null)
  const [capacityInput, setCapacityInput] = useState('4')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [savingCapacity, setSavingCapacity] = useState(false)

  const load = useCallback(() => {
    setStatus('loading')
    fetchDekanSettings(dorm.dormId)
      .then((s) => {
        setFloorCount(s.floorCount)
        setDefaultCapacity(s.defaultRoomCapacity)
        setCapacityInput(String(s.defaultRoomCapacity))
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [dorm.dormId])

  useEffect(() => { load() }, [load])

  // Saved immediately on blur, like FloorManagerCard's floor count — this
  // is structural building config, not part of the page's batched Save.
  const saveCapacity = async () => {
    const next = Math.max(1, Math.min(20, Number(capacityInput) || 1))
    setCapacityInput(String(next))
    if (next === defaultCapacity) return
    setSavingCapacity(true)
    try {
      const updated = await updateAppSettings({ defaultRoomCapacity: next }, dorm.dormId)
      setDefaultCapacity(updated.defaultRoomCapacity)
      toast.success("Xonaning standart sig'imi yangilandi")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Saqlab bo'lmadi")
      setCapacityInput(String(defaultCapacity ?? 4))
    } finally {
      setSavingCapacity(false)
    }
  }

  return (
    <section className={`rounded-2xl border overflow-hidden ${ui.card}`}>
      <div className={`flex items-center gap-3 border-b p-4 sm:px-6 ${ui.border}`}>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${ui.accentTile}`}>
          <Boxes size={18} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className={`text-sm font-bold ${ui.strong}`}>Xona va qavat sozlamalari</h2>
        </div>
        <div className={`flex shrink-0 items-center gap-1.5 text-xs font-semibold ${ui.muted}`}>
          <Building2 size={13} />
          {dorm.number}-yotoqxona{dorm.isPrimary ? ' (asosiy)' : ''}
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {status === 'loading' ? (
          <SkelForm fields={2} />
        ) : status === 'error' ? (
          <div className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-xs ${
            isLight ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-rose-500/20 bg-rose-500/5 text-rose-300'
          }`}>
            <span>Bu bino sozlamalarini yuklab bo&apos;lmadi.</span>
            <button
              type="button"
              onClick={load}
              className={`shrink-0 rounded-lg px-3 py-2 font-bold uppercase tracking-wider ${ui.btnGhost}`}
            >
              Qayta urinish
            </button>
          </div>
        ) : (
          <>
            <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-5 border-b ${ui.border}`}>
              <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-semibold ${ui.strong}`}>Xonaning standart sig&apos;imi</h3>
                <p className={`text-xs mt-1 ${ui.muted}`}>
                  Istisno belgilanmagan barcha xonalar shu qiymatni oladi. 2/3 o&apos;rinli istisno xonalarni
                  &laquo;3D Xonalar&raquo; yoki &laquo;Xonalar xaritasi&raquo;da alohida belgilaysiz.
                </p>
              </div>
              <div className="sm:ml-4 shrink-0 flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="number"
                  min={1}
                  max={20}
                  disabled={savingCapacity}
                  value={capacityInput}
                  onChange={(e) => setCapacityInput(e.target.value)}
                  onBlur={saveCapacity}
                  className={`rounded-lg border text-sm px-3 py-2 transition-colors w-full sm:w-24 disabled:opacity-60 ${ui.input} ${ui.ring}`}
                />
                <span className={`text-xs font-semibold shrink-0 ${ui.muted}`}>kishi</span>
              </div>
            </div>

            <FloorManagerCard
              floorCount={floorCount ?? 5}
              defaultCapacity={defaultCapacity ?? 4}
              rooms={rooms}
              roomsLoaded={roomsLoaded}
              onFloorCountSaved={setFloorCount}
              onRoomsChanged={reloadRooms}
              dormId={dorm.dormId}
            />
          </>
        )}
      </div>
    </section>
  )
}
