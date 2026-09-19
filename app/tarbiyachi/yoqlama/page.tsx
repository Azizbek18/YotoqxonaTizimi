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
  MapPin,
  Loader2,
  Search,
  CheckCircle2,
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
  const trimmed = name.trim()
  if (!trimmed) return '??'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase() || '??'
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
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
  const [searchQuery, setSearchQuery] = useState('')
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

  const shownFloors = useMemo(
    () => (activeFloor === 'all' ? floors : floors.filter((f) => f.floor === activeFloor)),
    [floors, activeFloor]
  )

  // Filtered floors based on search query
  const filteredFloors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return shownFloors
    return shownFloors
      .map((fl) => {
        const matchingRooms = fl.rooms
          .map((room) => {
            const roomMatches = room.roomNumber.toLowerCase().includes(q)
            const matchingResidents = room.residents.filter((res) =>
              res.fullName.toLowerCase().includes(q)
            )
            if (roomMatches) return room
            if (matchingResidents.length > 0) return { ...room, residents: matchingResidents }
            return null
          })
          .filter((r): r is NonNullable<typeof r> => r !== null)

        if (matchingRooms.length === 0) return null
        const residents = matchingRooms.flatMap((r) => r.residents)
        return {
          ...fl,
          rooms: matchingRooms,
          total: residents.length,
          present: residents.filter((r) => r.state === 'present').length,
          marked: residents.filter((r) => r.state !== 'unmarked').length,
          unmarkedIds: residents.filter((r) => r.state === 'unmarked').map((r) => r.id),
        }
      })
      .filter((fl): fl is NonNullable<typeof fl> => fl !== null)
  }, [shownFloors, searchQuery])

  return (
    <div className="space-y-6 pb-28">
      {/* ── Hero Banner ──────────────────────────────────── */}
      <div
        className="no-shelf relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-5 sm:p-7 shadow-xl shadow-indigo-950/20 border border-white/20 text-white"
      >
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-20 h-60 w-60 rounded-full bg-violet-400/10 blur-3xl" />

        {/* Top bar inside hero */}
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md text-white border border-white/25 shadow-inner shrink-0">
              <ClipboardCheck size={24} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white" style={{ color: '#ffffff' }}>
                  Yo‘qlama
                </h1>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/15 text-white backdrop-blur-md border border-white/20"
                  style={{ color: '#ffffff' }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {view ? (view.session.kind === 'nightly' ? 'Kechki nazorat' : 'Qo‘lda ochilgan') : 'Kunlik nazorat'}
                </span>
              </div>
              <p className="mt-0.5 text-xs sm:text-sm font-medium" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                Yotoqxona xonalarini qavatma-qavat tekshirish va talabalar davomatini qayd etish
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {view?.session.status === 'open' && countdown && (
              <span
                className="no-shelf inline-flex items-center gap-1.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 px-3.5 py-2 text-xs sm:text-sm font-bold text-white tabular-nums shadow-xs"
                style={{ color: '#ffffff' }}
              >
                <Clock size={15} className="text-white/80" />
                <span>{countdown}</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => void bootstrap()}
              className="no-shelf inline-flex items-center justify-center h-9 w-9 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white transition-all active:scale-95 shadow-xs"
              style={{ color: '#ffffff' }}
              title="Yangilash"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Hero Statistics */}
        {s && (
          <div className="relative mt-6 flex flex-wrap items-center gap-4 sm:gap-6">
            <HeroRing pct={pct} marked={s.present + s.excused + s.absent} total={s.total} />
            <div className="grid flex-1 grid-cols-2 gap-2.5 sm:grid-cols-4 min-w-[240px]">
              {([
                ['Hozir', s.present, 'present', 'bg-emerald-400'],
                ['Ruxsat', s.excused, 'excused', 'bg-amber-400'],
                ['Yo‘q', s.absent, 'absent', 'bg-rose-400'],
                ['Belgilanmagan', s.unmarked, 'unmarked', 'bg-slate-300'],
              ] as const).map(([label, val, , dotColor]) => (
                <div
                  key={label}
                  className="no-shelf rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 p-3 sm:p-3.5 transition-all hover:bg-white/20"
                >
                  <p
                    className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white"
                    style={{ color: 'rgba(255, 255, 255, 0.9)' }}
                  >
                    <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                    <span>{label}</span>
                  </p>
                  <p
                    className="mt-1 text-2xl sm:text-3xl font-black text-white tabular-nums tracking-tight"
                    style={{ color: '#ffffff' }}
                  >
                    {val}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {view && view.session.status !== 'open' && (
          <p
            className="relative mt-4 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white border border-white/20"
            style={{ color: '#ffffff' }}
          >
            {view.session.status === 'auto_closed' ? 'Yo‘qlama vaqti tugadi' : 'Yo‘qlama yakunlangan'} — faqat ko‘rish mumkin.
          </p>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skel key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div
          className={`flex items-start gap-3 rounded-2xl border p-5 text-sm ${
            isLight ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-rose-500/25 bg-rose-500/10 text-rose-200'
          }`}
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{error}</p>
            <button
              type="button"
              onClick={() => void bootstrap()}
              className={`no-shelf mt-2 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${ui.dangerSoft}`}
            >
              Qayta urinish
            </button>
          </div>
        </div>
      ) : !view ? (
        <div className={`no-shelf rounded-3xl border p-8 sm:p-12 text-center ${ui.card}`}>
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${ui.accentSoft}`}>
            <ClipboardCheck size={28} />
          </div>
          <h2 className={`text-lg font-bold ${ui.strong}`}>Hozircha ochiq yo‘qlama yo‘q</h2>
          <p className={`mx-auto mt-1.5 max-w-md text-sm ${ui.muted}`}>
            Kechki yo‘qlama har kuni belgilangan vaqtda avtomatik ochiladi. Zarur bo‘lsa, hoziroq qo‘lda ochib
            qavatma-qavat belgilashingiz mumkin.
          </p>
          <button
            type="button"
            onClick={openSession}
            disabled={busy}
            className={`no-shelf mx-auto mt-5 flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold tracking-wide transition shadow-md active:scale-95 ${ui.accentSolid}`}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
            {busy ? 'Ochilmoqda…' : 'Yo‘qlama ochish'}
          </button>
        </div>
      ) : (
        <>
          {/* Floor Rail & Quick Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {floors.length > 1 && (
              <div
                role="group"
                aria-label="Qavat tanlash"
                className={`no-shelf inline-flex max-w-full items-center gap-1.5 p-1.5 rounded-2xl border overflow-x-auto scrollbar-none transition-colors ${
                  isLight ? 'bg-slate-100/90 border-slate-200/80' : 'bg-slate-950/70 border-slate-800/90'
                }`}
              >
                <FloorPill
                  active={activeFloor === 'all'}
                  onClick={() => setActiveFloor('all')}
                  isLight={isLight}
                  label="Barchasi"
                  marked={s ? s.present + s.excused + s.absent : 0}
                  total={s?.total ?? 0}
                />
                {floors.map((f) => (
                  <FloorPill
                    key={f.floor}
                    active={activeFloor === f.floor}
                    onClick={() => setActiveFloor(f.floor)}
                    isLight={isLight}
                    label={f.floor > 0 ? `${f.floor}-qavat` : 'Qavatsiz'}
                    marked={f.marked}
                    total={f.total}
                  />
                ))}
              </div>
            )}

            {/* Quick Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs self-stretch sm:self-auto">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Xona yoki talaba qidirish..."
                className={`no-shelf w-full rounded-xl border py-2 pl-9 pr-8 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                  isLight
                    ? 'border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-indigo-500'
                    : 'border-slate-800 bg-slate-900 text-slate-200 placeholder-slate-500 focus:border-indigo-500'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="no-shelf absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Floor panels */}
          <div className="space-y-4">
            {filteredFloors.length === 0 ? (
              <div className={`no-shelf rounded-2xl border p-10 text-center ${ui.card}`}>
                <p className={`text-sm ${ui.muted}`}>Qidiruv bo‘yicha hech qanday xona yoki talaba topilmadi</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="no-shelf mt-2 text-xs font-bold text-indigo-600 hover:underline"
                >
                  Qidiruvni tozalash
                </button>
              </div>
            ) : (
              filteredFloors.map((f) => (
                <FloorPanel
                  key={f.floor}
                  floor={f}
                  isLight={isLight}
                  ui={ui}
                  canWrite={canWrite}
                  pendingIds={pendingIds}
                  onMark={(ids, st) => void markMany(ids, st)}
                />
              ))
            )}
          </div>

          {/* Flags */}
          {flags.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`no-shelf rounded-2xl border p-4 sm:p-5 ${ui.card}`}
            >
              <div
                className={`mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
                  isLight ? 'text-amber-700' : 'text-amber-300'
                }`}
              >
                <AlertTriangle size={14} /> Sababsiz yo‘qlar — ko‘rib chiqing ({flags.length})
              </div>
              <div className="space-y-2">
                {flags.map((fl) => (
                  <div
                    key={fl.recordId}
                    className={`no-shelf flex flex-wrap items-center gap-2 rounded-xl border p-2.5 ${ui.inset}`}
                  >
                    <span className={`text-[13px] font-semibold ${ui.strong}`}>{fl.roomNumber}-xona</span>
                    <span className={`text-xs ${ui.muted}`}>{fl.sessionDate}</span>
                    <div className="ml-auto flex gap-2">
                      <button
                        type="button"
                        onClick={() => resolveFlag(fl.recordId, 'dismiss')}
                        className={`no-shelf rounded-lg border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${ui.btnGhost}`}
                      >
                        Sababli edi
                      </button>
                      <button
                        type="button"
                        onClick={() => resolveFlag(fl.recordId, 'warn')}
                        className="no-shelf inline-flex items-center gap-1 rounded-lg bg-rose-500/90 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-rose-500"
                      >
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
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(0.85rem+env(safe-area-inset-bottom))] lg:pl-[290px]"
          >
            <div
              className={`no-shelf mx-auto flex max-w-2xl items-center justify-between gap-4 rounded-2xl border p-3 shadow-2xl backdrop-blur-xl ${
                isLight
                  ? 'bg-white/95 border-slate-200/90 shadow-slate-900/10'
                  : 'bg-slate-900/95 border-slate-700/90 shadow-black/40'
              }`}
            >
              <div className="flex items-center gap-2.5 pl-1.5">
                {totalUnmarked > 0 ? (
                  <>
                    <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    <span className={`text-xs sm:text-sm font-semibold ${ui.strong}`}>
                      <strong className="text-amber-600 dark:text-amber-400 font-black tabular-nums">{totalUnmarked}</strong> ta talaba belgilanmagan
                    </span>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={17} className="shrink-0" />
                    <span className="text-xs sm:text-sm font-bold">Barcha talabalar belgilandi!</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={closeSession}
                disabled={busy}
                className={`no-shelf inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm shrink-0 ${
                  totalUnmarked > 0
                    ? isLight
                      ? 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                      : 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/25 font-black'
                }`}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={15} />}
                <span>{busy ? 'Yakunlanmoqda…' : 'Yo‘qlamani yakunlash'}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ───────────────────────── sub-components ───────────────────────── */

function HeroRing({ pct, marked, total }: { pct: number; marked: number; total: number }) {
  const r = 32
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0 text-white">
      <svg width="92" height="92" viewBox="0 0 92 92" className="-rotate-90">
        <circle
          cx="46"
          cy="46"
          r={r}
          fill="none"
          stroke="rgba(255, 255, 255, 0.25)"
          strokeWidth="7"
        />
        <circle
          cx="46"
          cy="46"
          r={r}
          fill="none"
          stroke="#ffffff"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span
          className="text-base font-black text-white tabular-nums leading-none"
          style={{ color: '#ffffff' }}
        >
          {marked}
          <span className="text-xs font-bold" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            /{total}
          </span>
        </span>
        <span
          className="text-[9px] font-bold uppercase tracking-wider mt-0.5"
          style={{ color: 'rgba(255, 255, 255, 0.9)' }}
        >
          {pct}%
        </span>
      </div>
    </div>
  )
}

function FloorPill({
  active,
  onClick,
  label,
  marked,
  total,
  isLight,
}: {
  active: boolean
  onClick: () => void
  label: string
  marked: number
  total: number
  isLight: boolean
}) {
  const done = total > 0 && marked >= total
  return (
    <button
      type="button"
      onClick={onClick}
      className={`no-shelf relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 shrink-0 select-none active:scale-[0.98] ${
        active
          ? isLight
            ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80 font-bold'
            : 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30 border border-indigo-500/30 font-bold'
          : isLight
            ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] border border-transparent'
      }`}
    >
      <span>{label}</span>
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
          active
            ? isLight
              ? 'bg-indigo-50 text-indigo-700 font-black'
              : 'bg-white/20 text-white font-black'
            : isLight
              ? 'bg-slate-200/80 text-slate-600'
              : 'bg-slate-800 text-slate-400'
        }`}
      >
        {done && <Check size={11} className={active ? (isLight ? 'text-indigo-600' : 'text-white') : 'text-emerald-500'} />}
        {marked}/{total}
      </span>
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
  floor,
  isLight,
  ui,
  canWrite,
  pendingIds,
  onMark,
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
    <motion.section
      layout
      className={`no-shelf overflow-hidden rounded-2xl border transition-all ${
        isLight ? 'border-slate-200/90 bg-white shadow-xs' : 'border-slate-800/90 bg-slate-900/60 shadow-xs'
      }`}
    >
      {/* header */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 border-b ${
          isLight ? 'bg-slate-50/70 border-slate-100' : 'bg-slate-900/50 border-slate-800/80'
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="no-shelf flex items-center gap-3 min-w-0 text-left"
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black transition-colors ${
              done
                ? 'bg-emerald-500 text-white shadow-xs shadow-emerald-500/20'
                : isLight
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                  : 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/60'
            }`}
          >
            {done ? <Check size={18} strokeWidth={2.6} /> : (floor.floor > 0 ? floor.floor : '—')}
          </span>
          <div className="min-w-0">
            <span className={`block text-sm sm:text-base font-bold tracking-tight ${ui.strong}`}>
              {floor.floor > 0 ? `${floor.floor}-qavat` : 'Qavatsiz xonalar'}
            </span>
            <span className={`block text-xs font-medium ${ui.muted}`}>
              {floor.rooms.length} ta xona · {floor.present} ta hozir
            </span>
          </div>
          <ChevronDown
            size={16}
            className={`${ui.muted} transition-transform duration-200 ml-1 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        <div className="flex items-center gap-3 ml-auto">
          {/* Progress bar */}
          <div className={`hidden sm:block h-2 w-28 sm:w-36 overflow-hidden rounded-full ${isLight ? 'bg-slate-200/80' : 'bg-slate-800'}`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                done ? 'bg-emerald-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <span className={`text-xs font-bold tabular-nums ${done ? (isLight ? 'text-emerald-600' : 'text-emerald-400') : ui.muted}`}>
            {floor.marked}/{floor.total}
          </span>

          {canWrite && floor.unmarkedIds.length > 0 && (
            <button
              type="button"
              onClick={() => onMark(floor.unmarkedIds, 'present')}
              className={`no-shelf inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs ${
                isLight
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/90 hover:bg-emerald-100 hover:border-emerald-300'
                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
              }`}
              title="Qavatdagi barcha belgilanmaganlarni «Hozir» deb belgilash"
            >
              <Check size={13} strokeWidth={2.4} />
              <span>Qolgani ✓</span>
            </button>
          )}
        </div>
      </div>

      {/* rooms grid */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid gap-3.5 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {floor.rooms.map((room) => (
                <RoomCard
                  key={room.roomNumber}
                  room={room}
                  isLight={isLight}
                  ui={ui}
                  canWrite={canWrite}
                  pendingIds={pendingIds}
                  onMark={onMark}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

function RoomCard({
  room,
  isLight,
  ui,
  canWrite,
  pendingIds,
  onMark,
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
    <div
      className={`no-shelf rounded-2xl border p-3.5 transition-all ${
        isLight
          ? 'bg-slate-50/70 border-slate-200/80 hover:border-slate-300'
          : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
      }`}
    >
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/70 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <DoorOpen size={15} className="text-indigo-600 dark:text-indigo-400" />
          <span className={`text-xs sm:text-sm font-black ${ui.strong}`}>
            {room.roomNumber ? `${room.roomNumber}-xona` : 'Xonasiz'}
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold tabular-nums border ${
            full
              ? isLight
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : isLight
                ? 'bg-slate-200/70 text-slate-700 border-slate-200/60'
                : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          {present}/{room.residents.length} hozir
        </span>
      </div>

      <div className="space-y-1.5">
        {room.residents.map((r) => (
          <ResidentRow
            key={r.id}
            r={r}
            isLight={isLight}
            ui={ui}
            canWrite={canWrite}
            pending={pendingIds.has(r.id)}
            onMark={(st) => onMark([r.id], st)}
          />
        ))}
      </div>
    </div>
  )
}

function ResidentRow({
  r,
  isLight,
  ui,
  canWrite,
  pending,
  onMark,
}: {
  r: RosterResident
  isLight: boolean
  ui: ReturnType<typeof dekanUI>
  canWrite: boolean
  pending: boolean
  onMark: (state: AttendanceState) => void
}) {
  return (
    <div
      className={`flex items-center gap-2.5 p-1 rounded-xl transition-colors ${
        pending ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border transition-colors ${
          isLight
            ? 'bg-slate-100 text-slate-700 border-slate-200/80'
            : 'bg-slate-800 text-slate-200 border-slate-700'
        }`}
      >
        {initials(r.fullName)}
      </div>

      <div className="min-w-0 flex-1 truncate">
        <span className={`block text-xs sm:text-sm font-semibold truncate ${ui.strong}`}>
          {r.fullName}
        </span>
        {r.source === 'self_location' && (
          <span
            className="inline-flex items-center gap-1 text-[9px] font-bold text-indigo-600 dark:text-indigo-400"
            title="Talaba GPS bilan tasdiqladi"
          >
            <MapPin size={10} />
            <span>{r.selfDistanceM != null ? `${r.selfDistanceM}m` : 'GPS tasdiqlangan'}</span>
          </span>
        )}
      </div>

      {canWrite ? (
        <div
          className={`no-shelf inline-flex items-center p-0.5 rounded-xl border gap-0.5 shrink-0 transition-colors ${
            isLight ? 'bg-slate-100/90 border-slate-200/80' : 'bg-slate-950/70 border-slate-800/90'
          }`}
        >
          {REAL_STATES.map((st) => {
            const active = r.state === st
            return (
              <button
                key={st}
                type="button"
                disabled={pending}
                aria-label={STATE_UI[st].label}
                title={STATE_UI[st].label}
                onClick={() => onMark(st)}
                className={`no-shelf h-7 w-7 sm:h-7.5 sm:w-8 rounded-lg text-[11px] font-black inline-flex items-center justify-center transition-all duration-150 active:scale-90 ${
                  active
                    ? STATE_UI[st].solid + ' shadow-xs'
                    : isLight
                      ? 'text-slate-400 hover:text-slate-800 hover:bg-white/80'
                      : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.08]'
                }`}
              >
                {st === 'present' && <Check size={13} strokeWidth={2.6} />}
                {st === 'absent' && <X size={13} strokeWidth={2.6} />}
                {st === 'excused' && <span>R</span>}
              </button>
            )
          })}
        </div>
      ) : (
        <span
          className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
            isLight ? STATE_UI[r.state].softLight : STATE_UI[r.state].softDark
          }`}
        >
          {STATE_UI[r.state].short}
        </span>
      )}
    </div>
  )
}
