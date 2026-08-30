'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  ShieldBan,
  ShieldCheck,
  UserRoundX,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchSuperadminStudents, runStudentAction } from '@/features/superadmin-students/client/api'
import type { SuperadminStudentRow, SuperadminStudentsPage } from '@/features/superadmin-students/types'
import { PERMIT_FACULTIES } from '@/lib/faculties'
import { directionLabel } from '@/lib/directions'
import { dekanUI, statusChip } from '@/lib/dekan-ui'
import { useThemeStore } from '@/lib/stores/theme-store'

const PAGE_SIZE = 30

const STATUS_LABEL: Record<string, string> = {
  active: 'Faol',
  pending: 'Tasdiqlanmagan',
  inactive: 'Faolsiz',
}

type ActionMode = 'move' | 'blacklist' | 'unblacklist' | 'expel'

export default function GlobalStudentsPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  const [page, setPage] = useState<SuperadminStudentsPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [faculty, setFaculty] = useState('')
  const [status, setStatus] = useState('')
  const [placement, setPlacement] = useState('')
  const [blacklistedOnly, setBlacklistedOnly] = useState(false)
  const [unknownOnly, setUnknownOnly] = useState(false)

  const [target, setTarget] = useState<{ student: SuperadminStudentRow; mode: ActionMode } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setOffset(0) }, [debounced, faculty, status, placement, blacklistedOnly, unknownOnly])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPage(await fetchSuperadminStudents({
        limit: PAGE_SIZE,
        offset,
        search: debounced || undefined,
        faculty: faculty || undefined,
        status: status || undefined,
        placement: placement || undefined,
        blacklisted: blacklistedOnly ? true : undefined,
        unknownFaculty: unknownOnly || undefined,
      }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [offset, debounced, faculty, status, placement, blacklistedOnly, unknownOnly])
  useEffect(() => { void load() }, [load])

  const students = page?.students ?? []
  const total = page?.total ?? 0
  const to = Math.min(offset + PAGE_SIZE, total)
  const blacklistedCount = (page?.students ?? []).filter((s) => s.blacklisted).length

  const onDone = async (message: string) => {
    toast.success(message)
    setTarget(null)
    await load()
  }

  return (
    <div className="space-y-6">
      <section className={`relative overflow-hidden rounded-3xl border p-5 sm:p-7 ${ui.cardElevated}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <div className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] ${ui.accentSoft}`}>
              <Users size={13} /> Superadmin · Talabalar
            </div>
            <h1 className={`text-2xl font-black tracking-tight sm:text-3xl ${ui.strong}`}>Talabalar (barcha fakultet)</h1>
            <p className={`mt-2 text-sm leading-6 ${ui.body}`}>
              Fakultetlararo talaba boshqaruvi — noto‘g‘ri fakultetni to‘g‘rilash, qora ro‘yxat,
              yotoqxonadan chetlashtirish. Har amal audit jurnaliga yoziladi.
            </p>
          </div>
          <button
            type="button" onClick={() => void load()} disabled={loading}
            className={`inline-flex w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold ${ui.btnGhost}`}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Yangilash
          </button>
        </div>
      </section>

      <section className={`rounded-3xl border p-4 ${ui.card}`}>
        <div className="relative">
          <Search size={16} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${ui.faint}`} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ism, email yoki telefon bo‘yicha izlash"
            className={`h-11 w-full rounded-xl border pl-10 pr-4 text-sm outline-none ${ui.input} ${ui.ring}`}
          />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select value={faculty} onChange={(e) => setFaculty(e.target.value)} className={`rounded-xl border px-3 py-2.5 text-sm outline-none ${ui.input} ${ui.ring}`}>
            <option value="">Barcha fakultet</option>
            {PERMIT_FACULTIES.map((f) => {
              const c = page?.facultyCounts.find((x) => x.faculty === f.value)?.count
              return <option key={f.value} value={f.value}>{f.label}{c != null ? ` (${c})` : ''}</option>
            })}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`rounded-xl border px-3 py-2.5 text-sm outline-none ${ui.input} ${ui.ring}`}>
            <option value="">Har qanday holat</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={placement} onChange={(e) => setPlacement(e.target.value)} className={`rounded-xl border px-3 py-2.5 text-sm outline-none ${ui.input} ${ui.ring}`}>
            <option value="">Joylashuv: barchasi</option>
            <option value="placed">Xonaga joylashgan</option>
            <option value="roomless">Xonasiz</option>
          </select>
          <div className="flex items-center gap-3 px-1">
            <label className={`flex items-center gap-1.5 text-[11px] font-bold ${ui.body}`}>
              <input type="checkbox" checked={blacklistedOnly} onChange={(e) => setBlacklistedOnly(e.target.checked)} /> Qora ro‘yxat
            </label>
            <label className={`flex items-center gap-1.5 text-[11px] font-bold ${ui.body}`}>
              <input type="checkbox" checked={unknownOnly} onChange={(e) => setUnknownOnly(e.target.checked)} /> Notanish fakultet
            </label>
          </div>
        </div>
      </section>

      <section className={`overflow-hidden rounded-3xl border ${ui.card}`}>
        <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${ui.border}`}>
          <p className={`text-xs font-bold ${ui.muted}`}>
            {total > 0 ? `${offset + 1}–${to} / ${total}` : loading ? 'Yuklanmoqda…' : 'Talaba topilmadi'}
            {blacklistedCount > 0 && <span className="ml-2 text-rose-500">· {blacklistedCount} qora ro‘yxat (shu sahifada)</span>}
          </p>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={offset === 0 || loading} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))} className={`rounded-lg p-1.5 disabled:opacity-40 ${ui.btnGhost}`}><ChevronLeft size={14} /></button>
            <button type="button" disabled={to >= total || loading} onClick={() => setOffset((o) => o + PAGE_SIZE)} className={`rounded-lg p-1.5 disabled:opacity-40 ${ui.btnGhost}`}><ChevronRight size={14} /></button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className={`border-b text-left text-[10px] font-extrabold uppercase tracking-wider ${ui.border} ${ui.muted}`}>
                <th className="px-4 py-3">Talaba</th>
                <th className="px-4 py-3">Fakultet</th>
                <th className="px-4 py-3">Yo‘nalish</th>
                <th className="px-4 py-3">Xona</th>
                <th className="px-4 py-3">Holat</th>
                <th className="px-4 py-3 text-right">Amal</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${ui.divide}`}>
              {loading && students.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-4"><div className={`h-6 animate-pulse rounded ${ui.inset}`} /></td></tr>
                ))
              ) : students.length === 0 ? (
                <tr><td colSpan={6} className={`px-4 py-12 text-center text-sm ${ui.muted}`}>Bu filtrlar bo‘yicha talaba yo‘q</td></tr>
              ) : students.map((s) => {
                const st = statusChip(s.status === 'active' ? 'success' : s.status === 'inactive' ? 'danger' : 'warning', isLight)
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3">
                      <p className={`font-bold ${ui.strong}`}>{s.fullName}</p>
                      <p className={`text-[10px] ${ui.faint}`}>{s.email || s.phone || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 ${s.unknownFaculty ? (isLight ? 'text-amber-700' : 'text-amber-400') : ui.body}`}>
                        {s.unknownFaculty && <AlertTriangle size={12} />}
                        {s.facultyLabel}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${ui.muted}`}>
                      {s.direction ? directionLabel(s.direction) : '—'}{s.course ? ` · ${s.course}-kurs` : ''}
                    </td>
                    <td className={`px-4 py-3 ${ui.muted}`}>
                      {s.roomNumber ? `№${s.roomNumber}${s.assignedFloor ? ` · ${s.assignedFloor}-qavat` : ''}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${st.chip}`}>
                        {STATUS_LABEL[s.status ?? ''] ?? s.status ?? '—'}
                      </span>
                      {s.blacklisted && (
                        <span className="ml-1 inline-flex rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">Qora</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn title="Fakultetni to‘g‘rilash" onClick={() => setTarget({ student: s, mode: 'move' })} ui={ui}><ArrowLeftRight size={13} /></IconBtn>
                        {s.blacklisted ? (
                          <IconBtn title="Qora ro‘yxatdan chiqarish" onClick={() => setTarget({ student: s, mode: 'unblacklist' })} ui={ui}><ShieldCheck size={13} /></IconBtn>
                        ) : (
                          <IconBtn title="Qora ro‘yxatga olish" onClick={() => setTarget({ student: s, mode: 'blacklist' })} ui={ui}><ShieldBan size={13} /></IconBtn>
                        )}
                        <IconBtn title="Chetlashtirish" danger onClick={() => setTarget({ student: s, mode: 'expel' })} ui={ui}><UserRoundX size={13} /></IconBtn>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {target && (
        <ActionModal
          student={target.student}
          mode={target.mode}
          isLight={isLight}
          onClose={() => setTarget(null)}
          onDone={onDone}
        />
      )}
    </div>
  )
}

function IconBtn({ children, title, onClick, danger, ui }: {
  children: React.ReactNode
  title: string
  onClick: () => void
  danger?: boolean
  ui: ReturnType<typeof dekanUI>
}) {
  return (
    <button
      type="button" title={title} onClick={onClick}
      className={`rounded-lg border p-1.5 transition-colors ${danger ? 'border-rose-300 text-rose-500 hover:bg-rose-500/10 dark:border-rose-500/30' : ui.btnGhost}`}
    >
      {children}
    </button>
  )
}

function ActionModal({ student, mode, isLight, onClose, onDone }: {
  student: SuperadminStudentRow
  mode: ActionMode
  isLight: boolean
  onClose: () => void
  onDone: (message: string) => void
}) {
  const ui = dekanUI(isLight)
  const [faculty, setFaculty] = useState('')
  const [reason, setReason] = useState('')
  const [alsoBlacklist, setAlsoBlacklist] = useState(true)
  const [busy, setBusy] = useState(false)

  const meta = {
    move: { title: 'Fakultetni to‘g‘rilash', accent: ui.accentSolid },
    blacklist: { title: 'Qora ro‘yxatga olish', accent: 'bg-rose-600 text-white' },
    unblacklist: { title: 'Qora ro‘yxatdan chiqarish', accent: ui.accentSolid },
    expel: { title: 'Yotoqxonadan chetlashtirish', accent: 'bg-rose-600 text-white' },
  }[mode]

  const submit = async () => {
    setBusy(true)
    try {
      let res
      if (mode === 'move') {
        if (!faculty) { toast.error('Fakultetni tanlang'); setBusy(false); return }
        res = await runStudentAction({ id: student.id, action: 'move', faculty })
      } else if (mode === 'blacklist') {
        res = await runStudentAction({ id: student.id, action: 'blacklist', reason: reason.trim() })
      } else if (mode === 'unblacklist') {
        res = await runStudentAction({ id: student.id, action: 'unblacklist' })
      } else {
        res = await runStudentAction({ id: student.id, action: 'expel', reason: reason.trim(), alsoBlacklist })
      }
      onDone(res.message)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bajarib bo'lmadi")
    } finally {
      setBusy(false)
    }
  }

  const needsReason = mode === 'blacklist' || mode === 'expel'

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-md rounded-3xl border p-5 sm:p-6 shadow-2xl ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b1120] border-white/10'}`}>
        <h2 className={`text-lg font-black ${ui.strong}`}>{meta.title}</h2>
        <p className={`mt-1 text-xs ${ui.muted}`}>
          {student.fullName} · {student.facultyLabel}{student.roomNumber ? ` · №${student.roomNumber}` : ''}
        </p>

        <div className="mt-4 space-y-3">
          {mode === 'move' && (
            <>
              <select value={faculty} onChange={(e) => setFaculty(e.target.value)} className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${ui.input} ${ui.ring}`}>
                <option value="">— to‘g‘ri fakultetni tanlang —</option>
                {PERMIT_FACULTIES.filter((f) => f.value !== student.faculty).map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              {student.roomNumber && (
                <p className={`text-[11px] ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                  Diqqat: xona (№{student.roomNumber}) bo‘shatiladi — yangi fakultet dekani qayta joylashtiradi.
                </p>
              )}
            </>
          )}

          {needsReason && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Sabab (talabага emailда yuboriladi)"
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${ui.input} ${ui.ring}`}
            />
          )}

          {mode === 'expel' && (
            <label className={`flex items-center gap-2 text-xs font-bold ${ui.body}`}>
              <input type="checkbox" checked={alsoBlacklist} onChange={(e) => setAlsoBlacklist(e.target.checked)} />
              Qora ro‘yxatga ham qo‘shilsin (qayta ariza berolmaydi)
            </label>
          )}

          {mode === 'unblacklist' && (
            <p className={`text-xs ${ui.body}`}>Talaba qayta ariza bera oladi. Xona avtomatik qaytarilmaydi.</p>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button" disabled={busy} onClick={submit}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50 ${meta.accent}`}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            Tasdiqlash
          </button>
          <button type="button" onClick={onClose} className={`rounded-xl border px-4 py-2.5 text-xs font-bold ${ui.btnGhost}`}>Bekor</button>
        </div>
      </div>
    </div>
  )
}
