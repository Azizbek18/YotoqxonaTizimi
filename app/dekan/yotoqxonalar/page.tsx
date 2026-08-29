'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Plus, Loader2, ChevronDown, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI } from '@/lib/dekan-ui'
import { PERMIT_FACULTIES, permitFacultyLabel } from '@/lib/faculties'
import {
  fetchAllDorms,
  createDorm,
  saveDormSettings,
  reassignDormFloor,
} from '@/features/dorms/client/api'
import type { SuperadminDorm } from '@/features/dorms/types'

const CONTACT_FIELDS: Array<[keyof SuperadminDorm, string]> = [
  ['ttjName', 'TTJ nomi'],
  ['tarbiyachiName', 'Tarbiyachi'],
  ['tarbiyachiPhone', 'Tarbiyachi tel'],
  ['komendantName', 'Komendant'],
  ['komendantPhone', 'Komendant tel'],
  ['doctorName', 'Shifokor'],
  ['doctorPhone', 'Shifokor tel'],
  ['securityPhone', 'Xavfsizlik tel'],
]

export default function SuperadminDormsPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  const [dorms, setDorms] = useState<SuperadminDorm[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, Partial<SuperadminDorm>>>({})
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newDorm, setNewDorm] = useState({ number: '', name: '', floorCount: 5 })

  const load = useCallback(async () => {
    try {
      const { dorms } = await fetchAllDorms()
      setDorms(dorms)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yuklab bo'lmadi")
      setDorms([])
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const patch = (id: string, key: keyof SuperadminDorm, value: string | number) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], [key]: value } }))

  const saveOne = async (dorm: SuperadminDorm) => {
    const changes = draft[dorm.id]
    if (!changes || Object.keys(changes).length === 0) return
    setBusy(true)
    try {
      await saveDormSettings(dorm.id, changes)
      toast.success('Saqlandi')
      setDraft((d) => ({ ...d, [dorm.id]: {} }))
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Saqlab bo'lmadi")
    } finally {
      setBusy(false)
    }
  }

  const reassign = async (dormId: string, floor: number, faculty: string | null) => {
    setBusy(true)
    try {
      await reassignDormFloor(dormId, floor, faculty)
      toast.success(`${floor}-qavat yangilandi`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bajarib bo'lmadi")
    } finally {
      setBusy(false)
    }
  }

  const submitNew = async () => {
    if (!newDorm.number.trim()) return
    setBusy(true)
    try {
      await createDorm(newDorm)
      toast.success('Yotoqxona yaratildi')
      setCreating(false)
      setNewDorm({ number: '', name: '', floorCount: 5 })
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yaratib bo'lmadi")
    } finally {
      setBusy(false)
    }
  }

  if (dorms === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className={`h-6 w-6 animate-spin ${ui.accentText}`} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${ui.strong}`}>Yotoqxonalar</h1>
          <p className={`text-xs mt-1 ${ui.muted}`}>Barcha binolar, qavat taqsimoti va sozlamalar — superadmin</p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${ui.accentSolid}`}
        >
          <Plus size={14} /> Yangi
        </button>
      </div>

      {creating && (
        <div className={`rounded-2xl border p-4 ${ui.card} flex flex-wrap items-end gap-3`}>
          <label className="text-xs">
            <span className={`block mb-1 font-semibold ${ui.muted}`}>Raqam</span>
            <input value={newDorm.number} onChange={(e) => setNewDorm((n) => ({ ...n, number: e.target.value }))}
              className={`w-24 rounded-lg border px-3 py-2 ${ui.input}`} />
          </label>
          <label className="text-xs">
            <span className={`block mb-1 font-semibold ${ui.muted}`}>Nomi</span>
            <input value={newDorm.name} onChange={(e) => setNewDorm((n) => ({ ...n, name: e.target.value }))}
              className={`w-48 rounded-lg border px-3 py-2 ${ui.input}`} />
          </label>
          <label className="text-xs">
            <span className={`block mb-1 font-semibold ${ui.muted}`}>Qavatlar</span>
            <input type="number" min={1} max={50} value={newDorm.floorCount}
              onChange={(e) => setNewDorm((n) => ({ ...n, floorCount: Math.max(1, Number(e.target.value) || 1) }))}
              className={`w-20 rounded-lg border px-3 py-2 text-center ${ui.input}`} />
          </label>
          <button onClick={submitNew} disabled={busy || !newDorm.number.trim()}
            className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 ${ui.accentSolid}`}>
            Yaratish
          </button>
        </div>
      )}

      {dorms.length === 0 && (
        <p className={`rounded-2xl border p-8 text-center text-sm ${ui.card} ${ui.muted}`}>Hali yotoqxona yo&apos;q</p>
      )}

      {dorms.map((dorm) => {
        const d = { ...dorm, ...draft[dorm.id] }
        const isOpen = openId === dorm.id
        const dirty = Object.keys(draft[dorm.id] ?? {}).length > 0
        return (
          <div key={dorm.id} className={`rounded-2xl border ${ui.card}`}>
            <div className="flex items-center gap-3 p-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ui.accentTile}`}>
                <Building2 size={18} strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className={`text-sm font-bold ${ui.strong}`}>
                  {dorm.number}-yotoqxona{dorm.name ? ` · ${dorm.name}` : ''}
                </h3>
                <p className={`text-[11px] mt-0.5 ${ui.muted}`}>
                  {dorm.faculties.length
                    ? dorm.faculties.map((f) => permitFacultyLabel(f) || f).join(', ')
                    : 'fakultet biriktirilmagan'} · {dorm.residentCount} talaba · {dorm.floorCount} qavat
                </p>
              </div>
              <button onClick={() => setOpenId(isOpen ? null : dorm.id)}
                className={`rounded-lg border p-2 transition-transform ${ui.btnGhost} ${isOpen ? 'rotate-180' : ''}`}>
                <ChevronDown size={16} />
              </button>
            </div>

            {isOpen && (
              <div className={`space-y-4 border-t p-4 ${ui.border}`}>
                {/* floor partition */}
                <div>
                  <p className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>Qavat taqsimoti</p>
                  <div className="space-y-1.5">
                    {d.floors.map((f) => (
                      <div key={f.floor} className="flex items-center gap-2">
                        <span className={`w-16 text-xs font-bold ${ui.strong}`}>{f.floor}-qavat</span>
                        <select
                          value={f.faculty ?? ''}
                          disabled={busy}
                          onChange={(e) => reassign(dorm.id, f.floor, e.target.value || null)}
                          className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs ${ui.input}`}
                        >
                          <option value="">— bo&apos;sh —</option>
                          {PERMIT_FACULTIES.map((pf) => (
                            <option key={pf.value} value={pf.value}>{pf.label}</option>
                          ))}
                        </select>
                        {f.pendingFaculty && (
                          <span className="text-[9px] font-bold uppercase text-amber-500">
                            {permitFacultyLabel(f.pendingFaculty)} kutmoqda
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* settings */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <label className="text-[11px]">
                    <span className={`block mb-1 font-semibold ${ui.muted}`}>Qavatlar soni</span>
                    <input type="number" min={1} max={50} value={d.floorCount}
                      onChange={(e) => patch(dorm.id, 'floorCount', Math.max(1, Number(e.target.value) || 1))}
                      className={`w-full rounded-lg border px-2.5 py-1.5 text-xs ${ui.input}`} />
                  </label>
                  <label className="text-[11px]">
                    <span className={`block mb-1 font-semibold ${ui.muted}`}>Xona sig&apos;imi</span>
                    <input type="number" min={1} max={20} value={d.defaultRoomCapacity}
                      onChange={(e) => patch(dorm.id, 'defaultRoomCapacity', Math.max(1, Number(e.target.value) || 1))}
                      className={`w-full rounded-lg border px-2.5 py-1.5 text-xs ${ui.input}`} />
                  </label>
                  {CONTACT_FIELDS.map(([key, label]) => (
                    <label key={key} className="text-[11px]">
                      <span className={`block mb-1 font-semibold ${ui.muted}`}>{label}</span>
                      <input value={String(d[key] ?? '')}
                        onChange={(e) => patch(dorm.id, key, e.target.value)}
                        className={`w-full rounded-lg border px-2.5 py-1.5 text-xs ${ui.input}`} />
                    </label>
                  ))}
                </div>

                <button onClick={() => saveOne(dorm)} disabled={busy || !dirty}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 ${ui.accentSolid}`}>
                  <Save size={13} /> Saqlash
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
