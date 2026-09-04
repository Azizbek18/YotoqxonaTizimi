'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardCheck,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  Check,
  X,
  DoorOpen,
  Clock,
  ChevronDown,
  Sparkles,
  MapPin,
  Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getAuthHeaders } from '@/lib/auth-session'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useRoomFloors } from '@/lib/hooks/useRoomFloors'
import { dekanUI } from '@/lib/dekan-ui'
import { Skel } from '@/components/ui/skeletons'
import type { AttendanceState, RosterView, RosterResident } from '@/features/attendance/types'

type Flag = { recordId: string; studentId: string; roomNumber: string; note: string | null; sessionDate: string }

const REAL_STATES: Exclude<AttendanceState, 'unmarked'>[] = ['present', 'excused', 'absent']

const STATE_UI: Record<AttendanceState, { label: string; short: string; solid: string; softLight: string; softDark: string; dot: string }> = {
  present: {
    label: 'Hozir', short: 'Hozir',
    solid: 'bg-emerald-500 text-white',
    softLight: 'bg-emerald-50 text-emerald-700', softDark: 'bg-emerald-500/15 text-emerald-300',
    dot: 'bg-emerald-500',
  },
  excused: {
    label: 'Ruxsat bilan', short: 'Ruxsat',
    solid: 'bg-amber-500 text-white',
    softLight: 'bg-amber-50 text-amber-700', softDark: 'bg-amber-500/15 text-amber-300',
    dot: 'bg-amber-500',
  },
  absent: {
    label: 'Uzrsiz yo‘q', short: 'Yo‘q',
    solid: 'bg-rose-500 text-white',
    softLight: 'bg-rose-50 text-rose-700', softDark: 'bg-rose-500/15 text-rose-300',
    dot: 'bg-rose-500',
  },
  unmarked: {
    label: 'Belgilanmagan', short: '—',
    solid: 'bg-slate-400 text-white',
    softLight: 'bg-slate-100 text-slate-500', softDark: 'bg-slate-700/50 text-slate-400',
    dot: 'bg-slate-400',
  },
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

/** mm:ss (or h:mm:ss) left until `iso`, or null when past. */
function useCountdown(iso: string | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!iso) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [iso])
  if (!iso) return null
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return null
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

export default function TarbiyachiYoqlamaPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)
  const { floorOf } = useRoomFloors()

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<RosterView | null>(null)
  const [flags, setFlags] = useState<Flag[]>([])
  const [error, setError] = useState<string | null>(null)
  const [activeFloor, setActiveFloor] = useState<number | 'all'>('all')
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadRoster = useCallback(async (sessionId: string) => {
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/attendance/roster?sessionId=${sessionId}`, { headers, cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Ro‘yxatni yuklab bo‘lmadi')
    setView(data as RosterView)
  }, [])

  const loadFlags = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/attendance/flags', { headers, cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setFlags(data.flags ?? [])
    } catch { /* non-critical */ }
  }, [])

  const bootstrap = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/attendance/session', { headers, cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Yo‘qlama holatini yuklab bo‘lmadi')
      const open = (data.sessions ?? [])[0]
      if (open) { await loadRoster(open.id); await loadFlags() }
      else setView(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik')
    } finally {
      setLoading(false)
    }
  }, [loadRoster, loadFlags])

  useEffect(() => { void bootstrap() }, [bootstrap])
  useEffect(() => () => { if (reloadTimer.current) clearTimeout(reloadTimer.current) }, [])

  const openSession = async () => {
    setBusy(true)
    try {
      const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' }
      const res = await fetch('/api/attendance/session', { method: 'POST', headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Yo‘qlamani ochib bo‘lmadi')
      setView(data as RosterView)
      toast.success('Yo‘qlama ochildi')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik')
    } finally { setBusy(false) }
  }

  // Optimistic mark; the roster refetch is debounced so "mark the whole
  // floor" doesn't fire a reload per student.
  const applyLocal = useCallback((ids: string[], state: AttendanceState) => {
    setView((v) => v && ({
      ...v,
      rooms: v.rooms.map((room) => ({
        ...room,
        residents: room.residents.map((r) => (ids.includes(r.id) ? { ...r, state, source: 'tarbiyachi' } : r)),
      })),
    }))
  }, [])

  const scheduleReload = useCallback((sessionId: string) => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(() => { void loadRoster(sessionId).catch(() => {}) }, 1200)
  }, [loadRoster])

  const markMany = useCallback(async (ids: string[], state: AttendanceState) => {
    if (!view || ids.length === 0) return
    const sessionId = view.session.id
    const prev = new Map<string, AttendanceState>()
    view.rooms.forEach((room) => room.residents.forEach((r) => { if (ids.includes(r.id)) prev.set(r.id, r.state) }))

    applyLocal(ids, state)
    setPendingIds((p) => new Set([...p, ...ids]))
    try {
      const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' }
      const results = await Promise.allSettled(ids.map((studentId) =>
        fetch('/api/attendance/mark', { method: 'PATCH', headers, body: JSON.stringify({ sessionId, studentId, state }) })
          .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Belgilanmadi') }),
      ))
      const failed = results.filter((r) => r.status === 'rejected').length
      if (failed > 0) {
        toast.error(`${failed} ta belgilash saqlanmadi`)
        await loadRoster(sessionId)
      } else {
        scheduleReload(sessionId)
      }
    } catch (err) {
      prev.forEach((st, id) => applyLocal([id], st))
      toast.error(err instanceof Error ? err.message : 'Belgilanmadi')
    } finally {
      setPendingIds((p) => { const n = new Set(p); ids.forEach((id) => n.delete(id)); return n })
    }
  }, [view, applyLocal, loadRoster, scheduleReload])

  const closeSession = async () => {
    if (!view) return
    setBusy(true)
    try {
      const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' }
      const res = await fetch('/api/attendance/close', {
        method: 'POST', headers, body: JSON.stringify({ sessionId: view.session.id }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Yopilmadi')
      toast.success('Yo‘qlama yakunlandi')
      await bootstrap()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yopilmadi')
    } finally { setBusy(false) }
  }

  const resolveFlag = async (recordId: string, action: 'warn' | 'dismiss') => {
    try {
      const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' }
      const res = await fetch('/api/attendance/flags', {
        method: 'POST', headers, body: JSON.stringify({ recordId, action }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Xatolik')
      setFlags((f) => f.filter((x) => x.recordId !== recordId))
      toast.success(action === 'warn' ? 'Ogohlantirish berildi' : 'Bekor qilindi')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik')
    }
  }

  // group the flat room list into floors
  const floors = useMemo(() => {
    if (!view) return []
    const map = new Map<number, { floor: number; rooms: RosterView['rooms'] }>()
    for (const room of view.rooms) {
      const f = floorOf(room.roomNumber) ?? 0
      if (!map.has(f)) map.set(f, { floor: f, rooms: [] })
      map.get(f)!.rooms.push(room)
    }
    return [...map.values()]
      .map((g) => {
        const residents = g.rooms.flatMap((r) => r.residents)
        return {
          ...g,
          total: residents.length,
          present: residents.filter((r) => r.state === 'present').length,
          marked: residents.filter((r) => r.state !== 'unmarked').length,
          unmarkedIds: residents.filter((r) => r.state === 'unmarked').map((r) => r.id),
        }
      })
      .sort((a, b) => a.floor - b.floor)
  }, [view, floorOf])

  // Live summary derived from the (optimistically updated) room list so the
  // hero, floor rail and finish bar move the instant a state is tapped,
  // instead of waiting for the debounced roster refetch.
  const s = useMemo(() => {
    if (!view) return null
    const acc = { present: 0, absent: 0, excused: 0, unmarked: 0, total: 0 }
    for (const room of view.rooms) for (const r of room.residents) { acc[r.state] += 1; acc.total += 1 }
    return acc
  }, [view])
  const canWrite = view?.canWrite ?? false
  const countdown = useCountdown(view && view.session.status === 'open' ? view.session.closesAt : null)
  const totalUnmarked = s?.unmarked ?? 0
  const pct = s && s.total ? Math.round(((s.present + s.excused + s.absent) / s.total) * 100) : 0

  const shownFloors = activeFloor === 'all' ? floors : floors.filter((f) => f.floor === activeFloor)

  return (
    <div className="space-y-5 pb-24">
      {/* ── Hero ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-5 sm:p-7"
      >
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white">
              <ClipboardCheck size={22} />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Yo‘qlama</h1>
              <p className="mt-0.5 text-xs sm:text-sm text-indigo-100">
                Qavatma-qavat kunlik nazorat
                {view && ` · ${view.session.kind === 'nightly' ? 'kechki' : 'qo‘lda ochilgan'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {view?.session.status === 'open' && countdown && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-bold text-white tabular-nums">
                <Clock size={14} /> {countdown}
              </span>
            )}
            <button
              onClick={() => void bootstrap()}
              className="inline-flex items-center gap-2 rounded-xl bg-white/95 px-3.5 py-2 text-xs font-bold text-indigo-700 shadow-lg shadow-black/10 transition-transform hover:bg-white active:scale-95"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {s && (
          <div className="relative mt-5 flex flex-wrap items-center gap-4">
            <HeroRing pct={pct} present={s.present} total={s.total} />
            <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4 min-w-[240px]">
              {([
                ['Hozir', s.present, 'present'],
                ['Ruxsat', s.excused, 'excused'],
                ['Yo‘q', s.absent, 'absent'],
                ['Belgilanmagan', s.unmarked, 'unmarked'],
              ] as const).map(([label, val, st]) => (
                <div key={label} className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-100">
                    <span className={`h-1.5 w-1.5 rounded-full ${STATE_UI[st].dot}`} /> {label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-white tabular-nums">{val}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {view && view.session.status !== 'open' && (
          <p className="relative mt-4 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white">
            {view.session.status === 'auto_closed' ? 'Yo‘qlama vaqti tugadi' : 'Yo‘qlama yakunlangan'} — faqat ko‘rish mumkin.
          </p>
        )}
      </motion.div>

      {/* ── Body ─────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skel key={i} className="h-28 rounded-2xl" />)}</div>
      ) : error ? (
        <div className={`flex items-start gap-3 rounded-2xl border p-5 text-sm ${
          isLight ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-rose-500/25 bg-rose-500/10 text-rose-200'
        }`}>
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{error}</p>
            <button onClick={() => void bootstrap()} className={`mt-2 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${ui.dangerSoft}`}>
              Qayta urinish
            </button>
          </div>
        </div>
      ) : !view ? (
        <div className={`rounded-3xl border p-8 sm:p-12 text-center ${ui.card}`}>
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${ui.accentSoft}`}>
            <ClipboardCheck size={26} />
          </div>
          <h2 className={`text-lg font-bold ${ui.strong}`}>Hozircha ochiq yo‘qlama yo‘q</h2>
          <p className={`mx-auto mt-1.5 max-w-md text-sm ${ui.muted}`}>
            Kechki yo‘qlama har kuni belgilangan vaqtda avtomatik ochiladi. Zarur bo‘lsa, hoziroq qo‘lda ochib
            qavatma-qavat belgilashingiz mumkin.
          </p>
          <button
            onClick={openSession} disabled={busy}
            className={`mx-auto mt-5 flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold tracking-wide transition ${ui.accentSolid}`}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
            {busy ? 'Ochilmoqda…' : 'Yo‘qlama ochish'}
          </button>
        </div>
      ) : (
        <>
          {/* Floor rail */}
          {floors.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <FloorPill
                active={activeFloor === 'all'} onClick={() => setActiveFloor('all')} ui={ui}
                label="Barchasi" marked={s ? s.present + s.excused + s.absent : 0} total={s?.total ?? 0}
              />
              {floors.map((f) => (
                <FloorPill
                  key={f.floor} active={activeFloor === f.floor} onClick={() => setActiveFloor(f.floor)} ui={ui}
                  label={f.floor > 0 ? `${f.floor}-qavat` : 'Qavatsiz'} marked={f.marked} total={f.total}
                />
              ))}
            </div>
          )}

          {/* Floor panels */}
          <div className="space-y-4">
            {shownFloors.map((f) => (
              <FloorPanel
                key={f.floor}
                floor={f}
                isLight={isLight}
                ui={ui}
                canWrite={canWrite}
                pendingIds={pendingIds}
                onMark={(ids, st) => void markMany(ids, st)}
              />
            ))}
          </div>

          {/* Flags */}
          {flags.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border p-4 sm:p-5 ${ui.card}`}>
              <div className={`mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
                <AlertTriangle size={14} /> Sababsiz yo‘qlar — ko‘rib chiqing ({flags.length})
              </div>
              <div className="space-y-2">
                {flags.map((fl) => (
                  <div key={fl.recordId} className={`flex flex-wrap items-center gap-2 rounded-xl border p-2.5 ${ui.inset}`}>
                    <span className={`text-[13px] font-semibold ${ui.strong}`}>{fl.roomNumber}-xona</span>
                    <span className={`text-xs ${ui.muted}`}>{fl.sessionDate}</span>
                    <div className="ml-auto flex gap-2">
                      <button onClick={() => resolveFlag(fl.recordId, 'dismiss')}
                        className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${ui.btnGhost}`}>
                        Sababli edi
                      </button>
                      <button onClick={() => resolveFlag(fl.recordId, 'warn')}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-500/90 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-rose-500">
                        <ShieldAlert size={12} /> Ogohlantirish
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* ── Sticky finish bar ────────────────────────────── */}
      <AnimatePresence>
        {view && canWrite && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:pl-[300px]"
          >
            <div className={`mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border p-2.5 shadow-2xl ${isLight ? 'bg-white/95 border-slate-200 backdrop-blur' : 'bg-slate-900/95 border-slate-700 backdrop-blur'}`}>
              <span className={`px-2 text-xs font-semibold ${totalUnmarked > 0 ? ui.strong : (isLight ? 'text-emerald-600' : 'text-emerald-400')}`}>
                {totalUnmarked > 0
                  ? <><span className="text-base font-bold tabular-nums">{totalUnmarked}</span> ta belgilanmagan</>
                  : <span className="inline-flex items-center gap-1.5"><Sparkles size={14} /> Hammasi belgilandi</span>}
              </span>
              <button
                onClick={closeSession} disabled={busy}
                className={`ml-auto rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                  totalUnmarked > 0 ? ui.btnGhost : 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.35)] hover:to-emerald-700 active:scale-[0.98]'
                }`}
              >
                {busy ? 'Yakunlanmoqda…' : 'Yo‘qlamani yakunlash'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ───────────────────────── sub-components ───────────────────────── */

function HeroRing({ pct, present, total }: { pct: number; present: number; total: number }) {
  const r = 30, c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0">
      <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-white/15" />
        <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100}
          className="text-white transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-white tabular-nums leading-none">{present}<span className="text-white/50">/{total}</span></span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-indigo-100">belgilandi</span>
      </div>
    </div>
  )
}

function FloorPill({
  active, onClick, label, marked, total, ui,
}: {
  active: boolean; onClick: () => void; label: string; marked: number; total: number
  ui: ReturnType<typeof dekanUI>
}) {
  const done = total > 0 && marked >= total
  return (
    <button
      onClick={onClick}
      className={`group shrink-0 rounded-2xl border px-3.5 py-2 text-left transition-all ${
        active ? 'border-transparent bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-[0_4px_14px_-4px_rgba(79,70,229,0.5)]'
        : `${ui.btnGhost}`
      }`}
    >
      <p className={`text-xs font-bold ${active ? 'text-white' : ui.strong}`}>{label}</p>
      <p className={`mt-0.5 flex items-center gap-1 text-[10px] font-semibold tabular-nums ${active ? 'text-indigo-100' : ui.muted}`}>
        {done && <Check size={11} className={active ? 'text-white' : 'text-emerald-500'} />}
        {marked}/{total}
      </p>
    </button>
  )
}

type FloorData = {
  floor: number
  rooms: RosterView['rooms']
  total: number
  present: number
  marked: number
  unmarkedIds: string[]
}

function FloorPanel({
  floor, isLight, ui, canWrite, pendingIds, onMark,
}: {
  floor: FloorData
  isLight: boolean
  ui: ReturnType<typeof dekanUI>
  canWrite: boolean
  pendingIds: Set<string>
  onMark: (ids: string[], state: AttendanceState) => void
}) {
  const [open, setOpen] = useState(true)
  const done = floor.total > 0 && floor.marked >= floor.total
  const pct = floor.total ? Math.round((floor.marked / floor.total) * 100) : 0

  return (
    <motion.section layout className={`overflow-hidden rounded-2xl border ${ui.card}`}>
      {/* header */}
      <div className={`flex flex-wrap items-center gap-3 p-4 ${isLight ? 'bg-slate-50/60' : 'bg-white/[0.02]'}`}>
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 min-w-0">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
            done ? (isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-300') : ui.accentSoft
          }`}>
            {done ? <Check size={16} /> : (floor.floor > 0 ? floor.floor : '—')}
          </span>
          <span className="min-w-0">
            <span className={`block text-sm font-bold ${ui.strong}`}>
              {floor.floor > 0 ? `${floor.floor}-qavat` : 'Qavatsiz xonalar'}
            </span>
            <span className={`block text-[11px] font-medium ${ui.muted}`}>
              {floor.rooms.length} xona · {floor.present} hozir
            </span>
          </span>
          <ChevronDown size={16} className={`${ui.muted} transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>

        <div className="ml-auto flex items-center gap-3">
          <div className={`hidden sm:block h-1.5 w-28 overflow-hidden rounded-full ${isLight ? 'bg-slate-200' : 'bg-slate-700'}`}>
            <div className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'}`} style={{ width: `${pct}%` }} />
          </div>
          <span className={`text-xs font-bold tabular-nums ${done ? (isLight ? 'text-emerald-600' : 'text-emerald-400') : ui.muted}`}>
            {floor.marked}/{floor.total}
          </span>
          {canWrite && floor.unmarkedIds.length > 0 && (
            <button
              onClick={() => onMark(floor.unmarkedIds, 'present')}
              className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
                isLight ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
              }`}
              title="Qolganlarni «Hozir» deb belgilash"
            >
              Qolgani ✓
            </button>
          )}
        </div>
      </div>

      {/* rooms */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {floor.rooms.map((room) => (
                <RoomCard key={room.roomNumber} room={room} isLight={isLight} ui={ui} canWrite={canWrite} pendingIds={pendingIds} onMark={onMark} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

function RoomCard({
  room, isLight, ui, canWrite, pendingIds, onMark,
}: {
  room: RosterView['rooms'][number]
  isLight: boolean
  ui: ReturnType<typeof dekanUI>
  canWrite: boolean
  pendingIds: Set<string>
  onMark: (ids: string[], state: AttendanceState) => void
}) {
  const present = room.residents.filter((r) => r.state === 'present').length
  const marked = room.residents.filter((r) => r.state !== 'unmarked').length
  const full = marked === room.residents.length

  return (
    <div className={`rounded-2xl border p-3 ${ui.inset}`}>
      <div className="mb-2 flex items-center gap-2">
        <DoorOpen size={14} className={ui.muted} />
        <span className={`text-xs font-bold ${ui.strong}`}>{room.roomNumber}-xona</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
          full ? (isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-300')
          : (isLight ? 'bg-slate-200 text-slate-600' : 'bg-slate-700 text-slate-300')
        }`}>
          {present}/{room.residents.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {room.residents.map((r) => (
          <ResidentRow key={r.id} r={r} isLight={isLight} ui={ui} canWrite={canWrite} pending={pendingIds.has(r.id)} onMark={(st) => onMark([r.id], st)} />
        ))}
      </div>
    </div>
  )
}

function ResidentRow({
  r, isLight, ui, canWrite, pending, onMark,
}: {
  r: RosterResident
  isLight: boolean
  ui: ReturnType<typeof dekanUI>
  canWrite: boolean
  pending: boolean
  onMark: (state: AttendanceState) => void
}) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-1.5 py-1 ${pending ? 'opacity-60' : ''}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
        isLight ? 'bg-slate-200 text-slate-600' : 'bg-slate-700 text-slate-200'
      }`}>
        {initials(r.fullName)}
      </span>
      <span className={`min-w-0 flex-1 truncate text-[13px] font-medium ${ui.strong}`}>
        {r.fullName}
        {r.source === 'self_location' && (
          <span className={`ml-1.5 inline-flex items-center gap-0.5 align-middle text-[9px] font-semibold ${ui.muted}`} title="Talaba GPS bilan tasdiqladi">
            <MapPin size={9} />{r.selfDistanceM != null ? `${r.selfDistanceM}m` : 'GPS'}
          </span>
        )}
      </span>

      {canWrite ? (
        <div className={`flex shrink-0 divide-x overflow-hidden rounded-lg border ${isLight ? 'border-slate-200 divide-slate-200' : 'border-slate-700 divide-slate-700'}`}>
          {REAL_STATES.map((st) => {
            const active = r.state === st
            return (
              <button
                key={st}
                type="button"
                disabled={pending}
                aria-label={STATE_UI[st].label}
                onClick={() => onMark(st)}
                className={`flex items-center gap-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                  active
                    ? STATE_UI[st].solid
                    : `${isLight ? 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`
                }`}
              >
                {st === 'present' && <Check size={12} />}
                {st === 'absent' && <X size={12} />}
                {st === 'excused' && (active ? STATE_UI[st].short : 'R')}
              </button>
            )
          })}
        </div>
      ) : (
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
          isLight ? STATE_UI[r.state].softLight : STATE_UI[r.state].softDark
        }`}>
          {STATE_UI[r.state].short}
        </span>
      )}
    </div>
  )
}
