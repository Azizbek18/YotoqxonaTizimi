'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Boxes, Building2, DoorClosed, Lock, UserPlus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { Skel } from '@/components/dekan/Skeletons'

// three.js is only pulled in when the building view is actually opened.
const BlockedBuilding3D = dynamic(() => import('@/components/dekan/BlockedBuilding3D'), {
  ssr: false,
  loading: () => <Skel className="h-[320px] w-full rounded-xl" />,
})
import { dekanUI, statusChip } from '@/lib/dekan-ui'
import { fetchBlockedRoomMap } from '@/features/dorms/client/api'
import { fetchAssignableStudents, assignStudentRoom } from '@/features/room-assignment/client/api'
import type { BlockedRoom, BlockedRoomMapDorm } from '@/features/dorms/types'
import type { FacultyStudentRow } from '@/features/room-assignment/types'

const genderLabel = (g: 'male' | 'female' | null) => (g === 'male' ? 'o‘g‘il' : g === 'female' ? 'qiz' : null)
const normGender = (g: string | null) => (g === 'male' || g === 'female' ? g : null)

export default function BlokXonalarPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  const [dorms, setDorms] = useState<BlockedRoomMapDorm[] | null>(null)
  const [roomless, setRoomless] = useState<FacultyStudentRow[]>([])
  const [dormId, setDormId] = useState<string>('')
  const [sectionKey, setSectionKey] = useState<string>('')
  const [picking, setPicking] = useState<BlockedRoom | null>(null)
  const [busy, setBusy] = useState(false)
  const [show3D, setShow3D] = useState(false)

  const load = useCallback(async () => {
    try {
      const [{ dorms }, students] = await Promise.all([fetchBlockedRoomMap(), fetchAssignableStudents()])
      setDorms(dorms)
      setRoomless(students)
      setDormId((cur) => cur || dorms[0]?.dormId || '')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yuklab bo'lmadi")
      setDorms([])
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const dorm = useMemo(() => dorms?.find((d) => d.dormId === dormId) ?? dorms?.[0], [dorms, dormId])
  const section = useMemo(() => {
    if (!dorm) return undefined
    return dorm.sections.find((s) => `${s.block}-${s.floor}` === sectionKey) ?? dorm.sections[0]
  }, [dorm, sectionKey])

  const assign = async (student: FacultyStudentRow) => {
    if (!dorm || !section || !picking) return
    setBusy(true)
    try {
      await assignStudentRoom({
        studentId: student.id,
        roomNumber: picking.roomNumber,
        source: student.source,
        dormId: dorm.dormId,
        block: section.block,
        floor: section.floor,
      })
      toast.success(`${student.full_name} → ${section.block}${section.floor}-${picking.roomNumber}`)
      setPicking(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Joylashtirib bo'lmadi")
    } finally {
      setBusy(false)
    }
  }

  if (dorms === null) {
    return (
      <div className="space-y-4">
        <Skel className="h-8 w-56" />
        <Skel className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  if (dorms.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className={`text-xl font-bold tracking-tight ${ui.strong}`}>Blok xonalari</h1>
        <p className={`rounded-2xl border p-8 text-center text-sm ${ui.card} ${ui.muted}`}>
          Sizga blokli binoda seksiya biriktirilmagan. Superadmin “Yotoqxonalar” bo‘limidan
          fakultetingizga blok/qavat seksiyasini bersa, xonalar shu yerda ko‘rinadi.
        </p>
      </div>
    )
  }

  // The people who can take the room being filled — gender-compatible, roomless.
  const roomGender = picking?.gender ?? section?.gender ?? null
  const candidates = roomless.filter((s) => !roomGender || normGender(s.gender) === roomGender || !s.gender)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${ui.strong}`}>Blok xonalari</h1>
          <p className={`text-xs mt-1 ${ui.muted}`}>A/B qanotli bino — seksiyangizdagi xonalar va joylashtirish</p>
        </div>
        <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusChip('info', isLight).chip}`}>
          {roomless.length} joylashtirilmagan
        </span>
      </div>

      {dorms.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {dorms.map((d) => (
            <button key={d.dormId} onClick={() => { setDormId(d.dormId); setSectionKey('') }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${d.dormId === dorm?.dormId ? ui.accentSolid : ui.btnGhost}`}>
              <Building2 size={12} className="mr-1 inline" /> {d.number}-yotoqxona
            </button>
          ))}
        </div>
      )}

      {/* section chips */}
      <div className={`rounded-2xl border p-3 ${ui.card}`}>
        <p className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>Seksiyalaringiz</p>
        <div className="flex flex-wrap gap-1.5">
          {dorm?.sections.map((s) => {
            const key = `${s.block}-${s.floor}`
            const filled = s.rooms.reduce((n, r) => n + r.occupants.length, 0)
            const total = s.rooms.reduce((n, r) => n + (r.frozen ? 0 : r.capacity), 0)
            const active = key === `${section?.block}-${section?.floor}`
            return (
              <button key={key} onClick={() => setSectionKey(key)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold tabular-nums ${active ? ui.accentSolid : `${ui.border} ${ui.btnGhost}`}`}>
                {s.block}{s.floor}
                <span className={`ml-1.5 text-[10px] font-medium ${active ? 'text-white/80' : ui.faint}`}>
                  {filled}/{total}
                </span>
                {genderLabel(s.gender) && (
                  <span className={`ml-1 text-[9px] ${active ? 'text-white/80' : ui.faint}`}>· {genderLabel(s.gender)}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 9-room grid for the chosen section */}
      {section && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {section.rooms.map((r) => {
            const free = Math.max(0, r.capacity - r.occupants.length)
            const full = free === 0
            return (
              <div key={r.roomNumber}
                className={`rounded-xl border p-3 ${ui.card} ${r.frozen ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 text-sm font-bold ${ui.strong}`}>
                    <DoorClosed size={14} /> {section.block}{section.floor}-{r.roomNumber}
                  </span>
                  <span className={`text-[11px] font-bold tabular-nums ${full && !r.frozen ? statusChip('warning', isLight).text : ui.muted}`}>
                    {r.occupants.length}/{r.capacity}
                  </span>
                </div>

                {/* bed dots */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {Array.from({ length: r.capacity }).map((_, i) => (
                    <span key={i}
                      className={`h-2 w-2 rounded-full ${i < r.occupants.length
                        ? (r.occupants[i].kind === 'permit' ? 'bg-amber-400' : 'bg-indigo-500')
                        : (isLight ? 'bg-slate-200' : 'bg-slate-700')}`} />
                  ))}
                </div>

                <ul className={`mt-2 space-y-0.5 text-[11px] ${ui.body}`}>
                  {r.occupants.map((o, i) => (
                    <li key={i} className="flex items-center gap-1 truncate">
                      <span className="truncate">{o.name}</span>
                      {o.kind === 'permit' && <span className={`shrink-0 text-[9px] ${ui.faint}`}>· ariza</span>}
                    </li>
                  ))}
                  {r.occupants.length === 0 && <li className={ui.faint}>bo‘sh</li>}
                </ul>

                <div className="mt-2.5">
                  {r.frozen ? (
                    <span className={`flex items-center gap-1 text-[10px] font-semibold ${statusChip('neutral', isLight).text}`}>
                      <Lock size={10} /> muzlatilgan
                    </span>
                  ) : (
                    <button onClick={() => setPicking(r)} disabled={full}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-bold uppercase tracking-wider disabled:opacity-40 ${ui.accentSoft}`}>
                      <UserPlus size={12} /> {full ? 'To‘la' : `Joylashtirish (${free})`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* building view — where your sections sit in the A/B tower */}
      {dorm && dorm.sections.length > 0 && (
        <div className={`rounded-2xl border ${ui.card}`}>
          <button
            onClick={() => setShow3D((v) => !v)}
            className={`flex w-full items-center justify-between px-4 py-3 text-left ${ui.btnGhost}`}
          >
            <span className={`flex items-center gap-2 text-sm font-bold ${ui.strong}`}>
              <Boxes size={15} /> Bino ko‘rinishi
              <span className={`text-[10px] font-medium ${ui.faint}`}>· {dorm.number}-yotoqxona · {dorm.blockCount} blok · {dorm.floorCount} qavat</span>
            </span>
            <span className={`text-[10px] font-bold uppercase ${ui.faint}`}>{show3D ? 'yashirish' : 'ko‘rish'}</span>
          </button>
          {show3D && (
            <div className={`border-t px-3 pb-3 pt-2 ${ui.border}`}>
              <BlockedBuilding3D
                dorm={dorm}
                activeKey={`${section?.block}-${section?.floor}`}
                onSelectSection={setSectionKey}
                isLight={isLight}
              />
            </div>
          )}
        </div>
      )}

      {/* pick a roomless student */}
      {picking && section && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={() => !busy && setPicking(null)}>
          <div className={`w-full max-w-md rounded-t-2xl border p-4 sm:rounded-2xl ${ui.cardElevated}`}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-bold ${ui.strong}`}>
                {section.block}{section.floor}-{picking.roomNumber} xonasiga
              </h3>
              <button onClick={() => setPicking(null)} className={`rounded-lg p-1 ${ui.btnGhost}`}><X size={16} /></button>
            </div>
            {genderLabel(picking.gender ?? section.gender) && (
              <p className={`mt-1 text-[11px] ${ui.muted}`}>Faqat {genderLabel(picking.gender ?? section.gender)} talabalar</p>
            )}
            <div className="mt-3 max-h-[50vh] space-y-1 overflow-y-auto">
              {candidates.length === 0 && (
                <p className={`py-6 text-center text-xs ${ui.faint}`}>Mos joylashtirilmagan talaba yo‘q</p>
              )}
              {candidates.map((s) => (
                <button key={s.id} onClick={() => assign(s)} disabled={busy}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs disabled:opacity-50 ${ui.border} ${ui.btnGhost}`}>
                  <span className="min-w-0">
                    <span className={`block truncate font-semibold ${ui.strong}`}>{s.full_name}</span>
                    <span className={ui.faint}>
                      {s.course ? `${s.course}-kurs · ` : ''}{s.direction || '—'}
                      {s.source === 'permit' ? ' · yo‘llanma' : ''}
                    </span>
                  </span>
                  {genderLabel(normGender(s.gender)) && (
                    <span className={`ml-2 shrink-0 text-[10px] ${ui.faint}`}>{genderLabel(normGender(s.gender))}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
