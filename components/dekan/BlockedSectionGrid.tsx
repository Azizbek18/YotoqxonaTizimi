'use client'

import { useCallback, useEffect, useState } from 'react'
import { Grid3x3, Hammer, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import CustomSelect from '@/components/ui/CustomSelect'
import { Skel } from '@/components/dekan/Skeletons'
import { dekanUI } from '@/lib/dekan-ui'
import { PERMIT_FACULTIES } from '@/lib/faculties'
import {
  fetchDormSectionGrid,
  buildDormLayout,
  assignDormSection,
  clearDormSection,
} from '@/features/dorms/client/api'
import type { BlockedDormGrid, DormSection } from '@/features/dorms/types'

// An A/B-wing building (6-yotoqxona): a "section" is one (block, floor) and
// belongs to exactly one faculty. Two sections per floor ⇒ two faculties can
// share a floor. Rooms are the fixed 9-per-section template (dorm_build_blocked_layout).
export default function BlockedSectionGrid({ dormId }: { dormId: string }) {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  const [grid, setGrid] = useState<BlockedDormGrid | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)

  const load = useCallback(async () => {
    try {
      const { grid } = await fetchDormSectionGrid(dormId)
      setGrid(grid)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Seksiyalarni yuklab bo'lmadi")
    }
  }, [dormId])
  useEffect(() => { void load() }, [load])

  const cell = (block: string, floor: number): DormSection | undefined =>
    grid?.sections.find((s) => s.block === block && s.floor === floor)

  const change = async (block: string, floor: number, faculty: string) => {
    const key = `${block}-${floor}`
    setPending(key)
    // optimistic
    setGrid((g) => g && {
      ...g,
      sections: g.sections.map((s) =>
        s.block === block && s.floor === floor ? { ...s, faculty: faculty || null } : s),
    })
    try {
      if (faculty) await assignDormSection(dormId, block, floor, faculty)
      else await clearDormSection(dormId, block, floor)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bajarib bo'lmadi")
      await load() // roll back to the truth
    } finally {
      setPending(null)
    }
  }

  const build = async () => {
    setBuilding(true)
    try {
      const { created } = await buildDormLayout(dormId)
      toast.success(created > 0 ? `${created} ta xona yaratildi` : 'Barcha xonalar allaqachon mavjud')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tarxni yaratib bo'lmadi")
    } finally {
      setBuilding(false)
    }
  }

  if (!grid) return <Skel className="h-64 w-full rounded-xl" />

  const blocks = Array.from({ length: grid.blockCount }, (_, i) => String.fromCharCode(65 + i))
  const floors = Array.from({ length: grid.floorCount }, (_, i) => grid.floorCount - i)
  const assigned = grid.sections.filter((s) => s.faculty).length
  const facultyOptions = [
    { value: '', label: '— bo‘sh —' },
    ...PERMIT_FACULTIES.map((pf) => ({ value: pf.value, label: pf.label })),
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${ui.accentTileSoft}`}>
            <Grid3x3 size={15} strokeWidth={2.2} />
          </span>
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-wider ${ui.strong}`}>Blok seksiyalari</p>
            <p className={`text-[10px] ${ui.muted}`}>
              {grid.blockCount} blok · {grid.floorCount} qavat · {grid.roomsPerSection} xona / {grid.bedsPerSection} o‘rin ·{' '}
              <span className={assigned === grid.sections.length ? ui.accentText : ''}>
                {assigned}/{grid.sections.length} taqsimlangan
              </span>
            </p>
          </div>
        </div>
        <button onClick={build} disabled={building}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider ${ui.accentSolid}`}>
          <Hammer size={13} /> {building ? 'Yaratilmoqda…' : 'Tarxni yaratish'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `2.5rem repeat(${grid.blockCount}, minmax(9rem, 1fr))`, minWidth: `${2.5 + grid.blockCount * 9}rem` }}
        >
          <span />
          {blocks.map((b) => (
            <span key={b} className={`pb-1 text-center text-xs font-bold ${ui.strong}`}>{b} blok</span>
          ))}

          {floors.map((floor) => (
            <FloorRow
              key={floor}
              floor={floor}
              blocks={blocks}
              cell={cell}
              pending={pending}
              options={facultyOptions}
              onChange={change}
              ui={ui}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function FloorRow({
  floor, blocks, cell, pending, options, onChange, ui,
}: {
  floor: number
  blocks: string[]
  cell: (block: string, floor: number) => DormSection | undefined
  pending: string | null
  options: Array<{ value: string; label: string }>
  onChange: (block: string, floor: number, faculty: string) => void
  ui: ReturnType<typeof dekanUI>
}) {
  return (
    <>
      <span className={`flex items-center justify-end pr-1 text-[11px] font-bold tabular-nums ${ui.muted}`}>{floor}</span>
      {blocks.map((block) => {
        const s = cell(block, floor)
        const key = `${block}-${floor}`
        return (
          <div key={key}
            className={`rounded-lg border px-1.5 py-1 ${ui.border} ${s?.faculty ? '' : ui.inset} ${pending === key ? 'opacity-50' : ''}`}>
            <CustomSelect
              value={s?.faculty ?? ''}
              disabled={pending !== null}
              onChange={(v) => onChange(block, floor, v)}
              className={`w-full rounded-md border px-2 py-1 text-[11px] ${ui.input}`}
              options={options}
            />
            {(s?.residentCount ?? 0) > 0 && (
              <p className={`mt-0.5 flex items-center gap-1 pl-1 text-[9px] font-semibold ${ui.faint}`}>
                <Users size={9} /> {s!.residentCount} talaba
              </p>
            )}
            {s?.faculty && s.gender && (
              <p className={`mt-0.5 pl-1 text-[9px] font-semibold ${ui.faint}`}>
                {s.gender === 'male' ? 'o‘g‘il' : 'qiz'}
              </p>
            )}
          </div>
        )
      })}
    </>
  )
}
