'use client'

import { useMemo, useState } from 'react'
import { Building2, Check, Loader2, Plus, Star, Unlink, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI } from '@/lib/dekan-ui'
import { permitFacultyLabel } from '@/lib/faculties'
import {
  resolveFloorClaim,
  setPrimaryDorm,
  setUpDorm,
  unlinkDorm,
  withdrawFloorClaims,
} from '@/features/dorms/client/api'
import type { DekanDorm, DormFloorState } from '@/features/dorms/types'

const STATE_META: Record<
  DormFloorState,
  { label: string; tone: 'mine' | 'pending' | 'incoming' | 'other' | 'free' }
> = {
  mine: { label: 'Meniki', tone: 'mine' },
  mine_pending: { label: 'Taklif qilingan', tone: 'pending' },
  incoming: { label: 'Tasdiq kutmoqda', tone: 'incoming' },
  other_pending: { label: 'Boshqa taklif', tone: 'other' },
  other: { label: 'Boshqa fakultet', tone: 'other' },
  free: { label: "Bo'sh", tone: 'free' },
}

export default function DormFloorsCard({
  dorm,
  onChange,
  onDormsChange,
  showBuildingControls = false,
}: {
  dorm: DekanDorm
  onChange: (dorm: DekanDorm) => void
  /** Only needed when `showBuildingControls` — "make primary" / "unlink"
   *  touch every one of the faculty's buildings, not just this card's. */
  onDormsChange?: (dorms: DekanDorm[]) => void
  /** Show the "asosiy qilib belgilash" / "bog'lanishni uzish" row — only
   *  meaningful once the faculty holds more than one building. */
  showBuildingControls?: boolean
}) {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [busyFloor, setBusyFloor] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [buildingBusy, setBuildingBusy] = useState(false)

  const mineFloors = useMemo(
    () => dorm.floors.filter((f) => f.state === 'mine' || f.state === 'mine_pending').map((f) => f.floor),
    [dorm],
  )
  const freeFloors = useMemo(() => dorm.floors.filter((f) => f.state === 'free').map((f) => f.floor), [dorm])

  const toneClass = (tone: string, on: boolean) => {
    if (tone === 'mine') return 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white border-transparent'
    if (tone === 'pending') return isLight ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
    if (tone === 'incoming') return isLight ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-rose-500/10 text-rose-300 border-rose-500/25'
    if (tone === 'other') return isLight ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-800/60 text-slate-500 border-slate-700'
    return on
      ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white border-transparent'
      : `${ui.card} ${ui.body}`
  }

  const submitAdd = async () => {
    if (picked.size === 0) return
    setSaving(true)
    try {
      const res = await setUpDorm({
        number: dorm.number,
        floors: [...new Set([...mineFloors, ...picked])].sort((a, b) => a - b),
        // Re-claiming floors in a building we ALREADY hold: for the primary
        // card this must stay the plain (non-additional) path — additional
        // would upsert is_primary:false onto our only primary row. For a
        // secondary building it must be additional, or setUp would read it
        // as "move to this dorm" and try to unlink the real primary.
        additional: !dorm.isPrimary,
      })
      if (res.dorm) onChange(res.dorm)
      toast.success(
        res.proposed.length > 0
          ? `${res.proposed.length} ta qavat taklif qilindi`
          : 'Qavatlar qo‘shildi',
      )
      setAdding(false)
      setPicked(new Set())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Saqlab bo'lmadi")
    } finally {
      setSaving(false)
    }
  }

  const withdraw = async (floor: number) => {
    setBusyFloor(floor)
    try {
      const { dorm: next } = await withdrawFloorClaims([floor], dorm.dormId)
      if (next) onChange(next)
      toast.success(`${floor}-qavat taklifi bekor qilindi`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bekor qilib bo'lmadi")
    } finally {
      setBusyFloor(null)
    }
  }

  const resolve = async (floor: number, accept: boolean) => {
    setBusyFloor(floor)
    try {
      const { dorm: next } = await resolveFloorClaim(floor, accept, dorm.dormId)
      if (next) onChange(next)
      toast.success(accept ? `${floor}-qavat tasdiqlandi` : `${floor}-qavat rad etildi`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Amalni bajarib bo'lmadi")
    } finally {
      setBusyFloor(null)
    }
  }

  const makePrimary = async () => {
    setBuildingBusy(true)
    try {
      const { dorms } = await setPrimaryDorm(dorm.dormId)
      onDormsChange?.(dorms)
      toast.success(`${dorm.number}-yotoqxona asosiy qilib belgilandi`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bajarib bo'lmadi")
    } finally {
      setBuildingBusy(false)
    }
  }

  const unlink = async () => {
    setBuildingBusy(true)
    try {
      const { dorms } = await unlinkDorm(dorm.dormId)
      onDormsChange?.(dorms)
      toast.success(`${dorm.number}-yotoqxona bilan bog‘lanish uzildi`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bajarib bo'lmadi")
    } finally {
      setBuildingBusy(false)
    }
  }

  return (
    <div className={`rounded-2xl border p-5 ${ui.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ui.accentTile}`}>
            <Building2 size={18} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h3 className={`flex items-center gap-1.5 text-sm font-bold tracking-tight ${ui.strong}`}>
              {dorm.number}-yotoqxona
              {dorm.isPrimary && showBuildingControls && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${isLight ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-500/15 text-indigo-300'}`}>
                  <Star size={9} className="fill-current" /> Asosiy
                </span>
              )}
            </h3>
            <p className={`mt-0.5 text-[11px] ${ui.muted}`}>
              Yotoqxona va qavatlar
              {dorm.coFaculties.length > 0 && (
                <> &middot; birga: {dorm.coFaculties.map((f) => permitFacultyLabel(f) || f).join(', ')}</>
              )}
            </p>
          </div>
        </div>
        {showBuildingControls && !dorm.isPrimary && (
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <button
              onClick={makePrimary}
              disabled={buildingBusy}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${ui.btnGhost}`}
            >
              <Star size={11} /> Asosiy qilish
            </button>
            <button
              onClick={unlink}
              disabled={buildingBusy}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${isLight ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-rose-500/25 text-rose-400 hover:bg-rose-500/10'}`}
            >
              <Unlink size={11} /> Uzish
            </button>
          </div>
        )}
      </div>

      {/* incoming claims */}
      {dorm.incoming.length > 0 && (
        <div className={`mt-4 space-y-2 rounded-xl border p-3 ${isLight ? 'border-rose-200 bg-rose-50' : 'border-rose-500/25 bg-rose-500/10'}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>
            Tasdiq kutayotgan so&apos;rovlar
          </p>
          {dorm.incoming.map((c) => (
            <div key={c.floor} className="flex items-center justify-between gap-2">
              <p className={`text-[11px] ${ui.body}`}>
                <span className="font-semibold">{permitFacultyLabel(c.faculty) || c.faculty}</span> &rarr; {c.floor}-qavat
              </p>
              <div className="flex gap-1.5">
                <button
                  disabled={busyFloor === c.floor}
                  onClick={() => resolve(c.floor, true)}
                  className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  Tasdiq
                </button>
                <button
                  disabled={busyFloor === c.floor}
                  onClick={() => resolve(c.floor, false)}
                  className={`rounded-lg border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider disabled:opacity-50 ${ui.dangerSoft}`}
                >
                  Rad
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* floor grid */}
      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
        {dorm.floors.map((f) => {
          const meta = STATE_META[f.state]
          return (
            <div
              key={f.floor}
              title={`${f.floor}-qavat — ${meta.label}${f.ownerFaculty && f.state === 'other' ? ` (${permitFacultyLabel(f.ownerFaculty)})` : ''}`}
              className={`flex h-14 flex-col items-center justify-center rounded-xl border text-center text-[9px] font-bold ${toneClass(meta.tone, false)}`}
            >
              <span className="text-sm">{f.floor}</span>
              <span className="truncate px-0.5 leading-tight opacity-85">{meta.label}</span>
              {f.state === 'mine_pending' && (
                <button
                  onClick={() => withdraw(f.floor)}
                  disabled={busyFloor === f.floor}
                  className="mt-0.5 text-[8px] uppercase underline opacity-90 disabled:opacity-40"
                >
                  bekor
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* add floors */}
      {freeFloors.length > 0 && !adding && (
        <button
          onClick={() => setAdding(true)}
          className={`mt-3 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${ui.btnGhost}`}
        >
          <Plus size={12} /> Qavat qo&apos;shish
        </button>
      )}
      {adding && (
        <div className={`mt-3 rounded-xl border p-3 ${ui.inset}`}>
          <p className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>Bo&apos;sh qavatlar</p>
          <div className="flex flex-wrap gap-2">
            {freeFloors.map((floor) => {
              const on = picked.has(floor)
              return (
                <button
                  key={floor}
                  onClick={() =>
                    setPicked((p) => {
                      const n = new Set(p)
                      if (n.has(floor)) n.delete(floor)
                      else n.add(floor)
                      return n
                    })
                  }
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                    on ? 'border-transparent bg-gradient-to-br from-indigo-500 to-violet-600 text-white' : `${ui.card} ${ui.body}`
                  }`}
                >
                  {floor}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={submitAdd}
              disabled={saving || picked.size === 0}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${ui.accentSolid}`}
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} So&apos;rash
            </button>
            <button
              onClick={() => {
                setAdding(false)
                setPicked(new Set())
              }}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${ui.btnGhost}`}
            >
              <X size={12} /> Bekor
            </button>
          </div>
        </div>
      )}

      {dorm.coFaculties.length > 0 && (
        <p className={`mt-3 text-[10px] leading-relaxed ${ui.faint}`}>
          Umumiy sozlamalar (TTJ nomi, kontaktlar, qavatlar soni) superadmin tomonidan boshqariladi.
        </p>
      )}
    </div>
  )
}
