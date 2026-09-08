'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DoorClosed, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import CustomSelect from '@/components/ui/CustomSelect'
import { Skel } from '@/components/dekan/Skeletons'
import { dekanUI } from '@/lib/dekan-ui'
import { PERMIT_FACULTIES, permitFacultyLabel } from '@/lib/faculties'
import { fetchRoomGrantGrid, grantRoom, ungrantRoom } from '@/features/dorms/client/api'
import type { RoomGrantCell, RoomGrantGrid as Grid } from '@/features/dorms/types'

// A 'simple' shared dorm: a floor belongs to one faculty (dorm_floor), but
// individual rooms can be handed to another faculty (dorm_room_grant). This
// grid lets the superadmin do that room by room, one floor at a time.
export default function RoomGrantGrid({ dormId }: { dormId: string }) {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  const [grid, setGrid] = useState<Grid | null>(null)
  const [floor, setFloor] = useState<number>(1)
  const [pending, setPending] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const { grid } = await fetchRoomGrantGrid(dormId)
      setGrid(grid)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yuklab bo'lmadi")
    }
  }, [dormId])
  useEffect(() => { void load() }, [load])

  const floors = useMemo(
    () => [...new Set((grid?.cells ?? []).map((c) => c.floor))].sort((a, b) => a - b),
    [grid],
  )
  const rows = useMemo(
    () => (grid?.cells ?? []).filter((c) => c.floor === floor),
    [grid, floor],
  )

  const change = async (cell: RoomGrantCell, value: string) => {
    // value === '' → follow the floor owner (ungrant); else grant to `value`
    const key = cell.roomNumber
    setPending(key)
    setGrid((g) => g && {
      ...g,
      cells: g.cells.map((c) =>
        c.roomNumber === cell.roomNumber
          ? { ...c, faculty: value || null, granted: Boolean(value) }
          : c),
    })
    try {
      if (value) await grantRoom(dormId, cell.roomNumber, value)
      else await ungrantRoom(dormId, cell.roomNumber)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bajarib bo'lmadi")
      await load()
    } finally {
      setPending(null)
    }
  }

  if (!grid) return <Skel className="h-48 w-full rounded-xl" />

  const owner = rows[0]?.ownerFaculty ?? null
  const grantedCount = grid.cells.filter((c) => c.granted).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-[11px] ${ui.muted}`}>
          Qavat egasi xonasi bo‘lib turadi; boshqa fakultetга berilgan xona —{' '}
          <span className={ui.accentText}>{grantedCount} ta istisno</span>
        </p>
        <div className="flex flex-wrap gap-1">
          {floors.map((f) => (
            <button key={f} onClick={() => setFloor(f)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold tabular-nums ${f === floor ? ui.accentSolid : `border ${ui.border} ${ui.btnGhost}`}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {owner && (
        <p className={`text-[10px] font-semibold uppercase tracking-wider ${ui.faint}`}>
          {floor}-qavat egasi: {permitFacultyLabel(owner) || owner}
        </p>
      )}

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((c) => {
          const opts = [
            { value: '', label: c.ownerFaculty ? `${permitFacultyLabel(c.ownerFaculty) || c.ownerFaculty} (egasi)` : '— egasi —' },
            ...PERMIT_FACULTIES.filter((f) => f.value !== c.ownerFaculty).map((f) => ({ value: f.value, label: f.label })),
          ]
          return (
            <div key={c.roomNumber}
              className={`rounded-lg border p-1.5 ${ui.border} ${c.granted ? ui.accentSoft : ''} ${pending === c.roomNumber ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between px-0.5">
                <span className={`flex items-center gap-1 text-[11px] font-bold ${ui.strong}`}>
                  <DoorClosed size={11} /> {c.roomNumber}
                </span>
                {c.residentCount > 0 && (
                  <span className={`flex items-center gap-0.5 text-[9px] ${ui.faint}`}>
                    <Users size={9} /> {c.residentCount}
                  </span>
                )}
              </div>
              <CustomSelect
                value={c.faculty ?? ''}
                disabled={pending !== null}
                onChange={(v) => change(c, v)}
                className={`mt-1 w-full rounded-md border px-1.5 py-1 text-[10px] ${ui.input}`}
                options={opts}
              />
            </div>
          )
        })}
        {rows.length === 0 && (
          <p className={`col-span-full py-4 text-center text-xs ${ui.faint}`}>Bu qavatda xona yo‘q</p>
        )}
      </div>
    </div>
  )
}
