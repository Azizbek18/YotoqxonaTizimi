'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardCheck,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Check,
  X,
  DoorOpen,
  Clock,
  ChevronDown,
  MapPin,
  Search,
  CheckCircle2,
  Home,
  CalendarDays,
  Filter,
  Layers,
  CheckCheck,
  RotateCcw,
  CalendarClock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getAuthHeaders } from '@/lib/auth-session'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useRoomFloors } from '@/lib/hooks/useRoomFloors'
import { dekanUI } from '@/lib/dekan-ui'
import { Skel } from '@/components/ui/skeletons'
import LeavesPanel from '@/components/attendance/LeavesPanel'
import DayByDayAttendance from '@/components/dekan/DayByDayAttendance'
import type { AttendanceState, RosterView, RosterResident, RosterRoom } from '@/features/attendance/types'

type Flag = {
  recordId: string
  studentId: string
  fullName?: string
  roomNumber: string
  note: string | null
  sessionDate: string
}

type TabKey = 'roster' | 'leaves' | 'history' | 'flags'
type StatusFilter = 'all' | 'unmarked' | 'present' | 'absent' | 'excused' | 'leave' | 'gps'

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: 'Barchasi',
  unmarked: 'Kutilayotganlar',
  present: 'Hozir',
  absent: 'Uzrsiz yo‘q',
  excused: 'Ruxsat bilan',
  leave: 'Uyda',
  gps: 'GPS bilan',
}

const REAL_STATES: Exclude<AttendanceState, 'unmarked'>[] = ['present', 'excused', 'absent']

const STATE_UI: Record<
  AttendanceState,
  { label: string; short: string; solid: string; softLight: string; softDark: string; dot: string }
> = {
  present: {
    label: 'Hozir',
    short: 'Hozir',
    solid: 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/30 ring-1 ring-emerald-500',
    softLight: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    softDark: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  excused: {
    label: 'Ruxsat bilan',
    short: 'Ruxsat',
    solid: 'bg-amber-500 text-white shadow-xs shadow-amber-500/30 ring-1 ring-amber-400',
    softLight: 'bg-amber-50 text-amber-700 border-amber-200/80',
    softDark: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dot: 'bg-amber-500',
  },
  absent: {
    label: 'Uzrsiz yo‘q',
    short: 'Yo‘q',
    solid: 'bg-rose-600 text-white shadow-xs shadow-rose-600/30 ring-1 ring-rose-500',
    softLight: 'bg-rose-50 text-rose-700 border-rose-200/80',
    softDark: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    dot: 'bg-rose-500',
  },
  unmarked: {
    label: 'Belgilanmagan',
    short: '—',
    solid: 'bg-slate-400 text-white',
    softLight: 'bg-slate-100 text-slate-500 border-slate-200',
    softDark: 'bg-slate-800 text-slate-400 border-slate-700',
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

const periodUrl = (days: number) => `/api/attendance/period?days=${days}`

export default function TarbiyachiYoqlamaPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)
  const { floorOf } = useRoomFloors()

  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<RosterView | null>(null)
  const [flags, setFlags] = useState<Flag[]>([])
  const [error, setError] = useState<string | null>(null)

  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState<TabKey>('roster')
  const [activeFloor, setActiveFloor] = useState<number | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedFloors, setCollapsedFloors] = useState<Set<number>>(new Set())

  // Async marking state
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
    } catch {
      /* non-critical */
    }
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
      if (open) {
        await loadRoster(open.id)
        await loadFlags()
      } else {
        setView(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik')
    } finally {
      setLoading(false)
    }
  }, [loadRoster, loadFlags])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => () => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current)
  }, [])

  // Optimistic mark
  const applyLocal = useCallback((ids: string[], state: AttendanceState) => {
    setView((v) =>
      v && {
        ...v,
        rooms: v.rooms.map((room) => ({
          ...room,
          residents: room.residents.map((r) =>
            ids.includes(r.id) ? { ...r, state, source: 'tarbiyachi' } : r
          ),
        })),
      }
    )
  }, [])

  const scheduleReload = useCallback(
    (sessionId: string) => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
      reloadTimer.current = setTimeout(() => {
        void loadRoster(sessionId).catch(() => {})
      }, 1200)
    },
    [loadRoster]
  )

  const markMany = useCallback(
    async (ids: string[], state: AttendanceState) => {
      if (!view || ids.length === 0) return
      const sessionId = view.session.id
      const prev = new Map<string, AttendanceState>()
      view.rooms.forEach((room) =>
        room.residents.forEach((r) => {
          if (ids.includes(r.id)) prev.set(r.id, r.state)
        })
      )

      applyLocal(ids, state)
      setPendingIds((p) => new Set([...p, ...ids]))
      try {
        const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' }
        const results = await Promise.allSettled(
          ids.map((studentId) =>
            fetch('/api/attendance/mark', {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ sessionId, studentId, state }),
            }).then(async (r) => {
              if (!r.ok) {
                throw new Error((await r.json().catch(() => ({}))).error || 'Belgilanmadi')
              }
            })
          )
        )
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
        setPendingIds((p) => {
          const n = new Set(p)
          ids.forEach((id) => n.delete(id))
          return n
        })
      }
    },
    [view, applyLocal, loadRoster, scheduleReload]
  )

  // Mark a room's still-unmarked residents. Never touches a verdict already
  // given — a GPS "outside" or a human "excused" is evidence, not a gap.
  const markRoomAll = useCallback(
    (room: RosterRoom, state: AttendanceState = 'present') => {
      const targetIds = room.residents
        .filter((r) => r.state === 'unmarked' && r.source !== 'leave')
        .map((r) => r.id)
      if (targetIds.length === 0) return
      void markMany(targetIds, state)
      toast.success(`${room.roomNumber}-xona: ${targetIds.length} ta talaba «${STATE_UI[state].label}» deb belgilandi`, {
        id: `room-${room.roomNumber}`,
        duration: 2000,
      })
    },
    [markMany]
  )

  const resolveFlag = async (recordId: string, action: 'warn' | 'dismiss') => {
    try {
      const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' }
      const res = await fetch('/api/attendance/flags', {
        method: 'POST',
        headers,
        body: JSON.stringify({ recordId, action }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Xatolik')
      setFlags((f) => f.filter((x) => x.recordId !== recordId))
      toast.success(action === 'warn' ? 'Ogohlantirish berildi' : 'Sababli deb hisoblandi')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik')
    }
  }

  // Group flat room list into floors
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
          unmarkedIds: residents.filter((r) => r.state === 'unmarked' && r.source !== 'leave').map((r) => r.id),
        }
      })
      .sort((a, b) => a.floor - b.floor)
  }, [view, floorOf])

  // Live summary derived directly from optimistic state
  const s = useMemo(() => {
    if (!view) return null
    const acc = { present: 0, absent: 0, excused: 0, unmarked: 0, total: 0, home: 0, gpsCount: 0 }
    for (const room of view.rooms) {
      for (const r of room.residents) {
        acc[r.state] += 1
        acc.total += 1
        if (r.source === 'leave') acc.home += 1
        if (r.source === 'self_location') acc.gpsCount += 1
      }
    }
    return acc
  }, [view])

  const canWrite = view?.canWrite ?? false
  const isSessionOpen = view?.session.status === 'open'
  const countdown = useCountdown(view && isSessionOpen ? view.session.closesAt : null)
  const totalUnmarked = s?.unmarked ?? 0
  const pct = s && s.total ? Math.round(((s.present + s.excused + s.absent) / s.total) * 100) : 0

  const shownFloors = useMemo(
    () => (activeFloor === 'all' ? floors : floors.filter((f) => f.floor === activeFloor)),
    [floors, activeFloor]
  )

  // Filtered floors based on search query AND status filter
  const filteredFloors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return shownFloors
      .map((fl) => {
        const matchingRooms = fl.rooms
          .map((room) => {
            const roomMatches = q ? room.roomNumber.toLowerCase().includes(q) : true

            // Resident filtering
            const matchingResidents = room.residents.filter((res) => {
              // Status filter
              if (statusFilter === 'unmarked' && res.state !== 'unmarked') return false
              if (statusFilter === 'present' && res.state !== 'present') return false
              if (statusFilter === 'absent' && res.state !== 'absent') return false
              if (statusFilter === 'excused' && (res.state !== 'excused' || res.source === 'leave')) return false
              if (statusFilter === 'leave' && res.source !== 'leave') return false
              if (statusFilter === 'gps' && res.source !== 'self_location') return false

              // Text query filter
              if (q) {
                if (roomMatches) return true
                return res.fullName.toLowerCase().includes(q)
              }
              return true
            })

            if (matchingResidents.length === 0) return null
            return { ...room, residents: matchingResidents }
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
          unmarkedIds: residents.filter((r) => r.state === 'unmarked' && r.source !== 'leave').map((r) => r.id),
        }
      })
      .filter((fl): fl is NonNullable<typeof fl> => fl !== null)
  }, [shownFloors, searchQuery, statusFilter])

  // Toggle single floor collapsed
  const toggleFloor = (floorNum: number) => {
    setCollapsedFloors((prev) => {
      const next = new Set(prev)
      if (next.has(floorNum)) next.delete(floorNum)
      else next.add(floorNum)
      return next
    })
  }

  // Expand / collapse all
  const allCollapsed = shownFloors.length > 0 && shownFloors.every((f) => collapsedFloors.has(f.floor))
  const toggleAllFloors = () => {
    if (allCollapsed) {
      setCollapsedFloors(new Set())
    } else {
      setCollapsedFloors(new Set(shownFloors.map((f) => f.floor)))
    }
  }

  // Quick stat tap handler
  const handleStatCardClick = (targetFilter: StatusFilter, targetTab: TabKey = 'roster') => {
    setActiveTab(targetTab)
    if (targetTab === 'roster') {
      setStatusFilter((prev) => (prev === targetFilter ? 'all' : targetFilter))
    }
  }

  return (
    <div className="space-y-6 pb-28 min-w-0">
      {/* ── Hero Banner (Immaculate Live State) ────────────────── */}
      <div className="no-shelf relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-900 p-4 sm:p-7 shadow-xl shadow-indigo-950/25 border border-white/20 text-white">
        {/* Ambient atmospheric glows */}
        <div className="pointer-events-none absolute -right-24 -top-28 h-88 w-88 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 -bottom-28 h-80 w-80 rounded-full bg-violet-400/20 blur-3xl" />

        {/* Top bar inside hero */}
        <div className="relative flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md text-white border border-white/30 shadow-inner shrink-0">
              <ClipboardCheck size={26} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-xs">
                  Yo‘qlama
                </h1>
                {view ? (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold backdrop-blur-md border ${
                      isSessionOpen
                        ? 'bg-emerald-500/25 text-emerald-100 border-emerald-400/40 shadow-xs shadow-emerald-900/30'
                        : 'bg-white/20 text-white border-white/25'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isSessionOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'
                      }`}
                    />
                    {isSessionOpen
                      ? view.session.kind === 'nightly'
                        ? 'Jonli kechki yo‘qlama'
                        : 'Ochiq tekshiruv sessiyasi'
                      : 'Yo‘qlama yakunlangan'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/15 text-white/90 backdrop-blur-md border border-white/20">
                    <CalendarClock size={12} />
                    <span>Rejali nazorat</span>
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs sm:text-sm font-medium text-white/85 truncate">
                {isSessionOpen
                  ? 'Qavatlar va xonalar bo‘ylab talabalar davomatini tezkor qayd etish'
                  : 'Yotoqxona xonalarini qavatma-qavat tekshirish va talabalar davomatini qayd etish'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSessionOpen && countdown && (
              <span
                className="no-shelf inline-flex items-center gap-1.5 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 px-3.5 py-2 text-xs sm:text-sm font-bold text-white tabular-nums shadow-xs"
                title="Yo‘qlama yakunlanishiga qolgan vaqt"
              >
                <Clock size={15} className="text-emerald-300 animate-pulse" />
                <span>{countdown} qoldi</span>
              </span>
            )}
            <button
              type="button"
              data-student-button="plain"
              onClick={() => void bootstrap()}
              disabled={loading}
              className="no-shelf inline-flex items-center justify-center h-9 w-9 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white transition-all active:scale-95 shadow-xs disabled:opacity-50"
              title="Ro‘yxatni yangilash"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Hero Circular Progress & Interactive Metric Cards (When Session is Active) */}
        {s && (
          <div className="relative mt-6 flex flex-col md:flex-row md:items-center gap-4 sm:gap-6">
            <HeroRing pct={pct} marked={s.present + s.excused + s.absent} total={s.total} />

            {/* Quick interactive metric cards */}
            <div className="grid flex-1 grid-cols-2 min-[440px]:grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3 min-w-0">
              {([
                ['Hozir', s.present, 'present', 'bg-emerald-400', 'hover:border-emerald-300'],
                ['Ruxsat', s.excused - s.home, 'excused', 'bg-amber-400', 'hover:border-amber-300'],
                ['Uyda', s.home, 'leave', 'bg-sky-400', 'hover:border-sky-300'],
                ['Yo‘q', s.absent, 'absent', 'bg-rose-400', 'hover:border-rose-300'],
                ['Kutilmoqda', s.unmarked, 'unmarked', 'bg-slate-300', 'hover:border-slate-200'],
              ] as const).map(([label, val, filterKey, dotColor, hoverBorder]) => {
                const isActive = statusFilter === filterKey && activeTab === 'roster'
                return (
                  <button
                    key={label}
                    type="button"
                    data-student-button="plain"
                    onClick={() => {
                      if (filterKey === 'leave') {
                        handleStatCardClick('all', 'leaves')
                      } else {
                        handleStatCardClick(filterKey, 'roster')
                      }
                    }}
                    className={`no-shelf group relative text-left rounded-2xl p-2.5 sm:p-3.5 transition-all duration-200 border cursor-pointer ${
                      isActive
                        ? 'bg-white/35 border-white shadow-md ring-2 ring-white/50 scale-[1.02]'
                        : `bg-white/15 border-white/20 hover:bg-white/25 ${hoverBorder}`
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/90 truncate">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
                        <span>{label}</span>
                      </p>
                      {isActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                      )}
                    </div>
                    <p className="mt-1 text-2xl sm:text-3xl font-black text-white tabular-nums tracking-tight">
                      {val}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {view && !isSessionOpen && (
          <p className="relative mt-4 rounded-xl bg-white/20 px-3.5 py-2 text-xs font-semibold text-white border border-white/25">
            {view.session.status === 'auto_closed' ? 'Yo‘qlama vaqti tugagan' : 'Yo‘qlama yakunlangan'} — ro‘yxat faqat ko‘rish rejimida.
          </p>
        )}
      </div>

      {/* ── View Navigation Tabs (Always Accessible) ────────────────── */}
      <div className="relative">
        <div
          role="tablist"
          aria-label="Yo‘qlama bo‘limlari"
          className={`no-shelf flex items-center gap-1.5 p-1.5 rounded-2xl border overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap ${
            isLight ? 'bg-slate-100/90 border-slate-200/80 shadow-xs' : 'bg-slate-900/80 border-slate-800/90 shadow-xs'
          }`}
        >
          {([
            { id: 'roster', label: 'Yo‘qlama & Xonalar', icon: ClipboardCheck, badge: view ? `${pct}%` : undefined },
            { id: 'leaves', label: 'Uyga ketganlar', icon: Home, badge: s?.home || undefined },
            { id: 'history', label: 'Kunlik tahlil & Eksport', icon: CalendarDays, badge: undefined },
            {
              id: 'flags',
              label: 'Ogohlantirishlar',
              icon: AlertTriangle,
              badge: flags.length || undefined,
              alert: flags.length > 0,
            },
          ] as const).map((tab) => {
            const active = activeTab === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-student-button="plain"
                onClick={() => setActiveTab(tab.id)}
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
                <Icon size={16} className={active ? (isLight ? 'text-indigo-600' : 'text-white') : 'opacity-70'} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black transition-colors ${
                      'alert' in tab && tab.alert
                        ? 'bg-rose-500 text-white animate-pulse'
                        : active
                          ? isLight
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-white/20 text-white'
                          : isLight
                            ? 'bg-slate-200/80 text-slate-700'
                            : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Main Body Based on Active Tab ─────────────────────────────────── */}
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
              data-student-button="plain"
              onClick={() => void bootstrap()}
              className={`no-shelf mt-2 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${ui.dangerSoft}`}
            >
              Qayta urinish
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TAB 1: Roster & Rooms */}
          {activeTab === 'roster' && (
            <>
              {!view ? (
                /* Sleek Scheduled / Waiting Card when session is not yet open */
                <div className={`no-shelf rounded-3xl border p-6 sm:p-10 text-center ${ui.card}`}>
                  <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${ui.accentSoft}`}>
                    <CalendarClock size={32} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h2 className={`text-lg sm:text-xl font-bold tracking-tight ${ui.strong}`}>
                    Hozircha faol yo‘qlama sessiyasi yo‘q
                  </h2>
                  <p className={`mx-auto mt-2 max-w-lg text-xs sm:text-sm leading-relaxed ${ui.muted}`}>
                    Kechki yo‘qlama har kuni dekanat belgilagan jadval bo‘yicha avtomatik ochiladi.
                    Sessiya boshlangach, qavatlar va xonalar ro‘yxati shu yerda tezkor belgilash uchun paydo bo‘ladi.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      data-student-button="plain"
                      onClick={() => setActiveTab('history')}
                      className={`no-shelf inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                        isLight
                          ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          : 'border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <CalendarDays size={15} />
                      <span>Oldingi kunlar davomati</span>
                    </button>
                    <button
                      type="button"
                      data-student-button="plain"
                      onClick={() => setActiveTab('leaves')}
                      className="no-shelf inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all active:scale-95 shadow-sm"
                    >
                      <Home size={15} />
                      <span>Uyga ketganlarni ko‘rish</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* The Live Opened Roll-Call Checklist */
                <div className="space-y-4">
                  {/* Floor Rail & Quick Search Bar */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {floors.length > 1 && (
                      <div
                        role="group"
                        aria-label="Qavat tanlash"
                        className={`no-shelf inline-flex max-w-full items-center gap-1.5 p-1.5 rounded-2xl border overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap transition-colors ${
                          isLight ? 'bg-slate-100/90 border-slate-200/80' : 'bg-slate-950/70 border-slate-800/90'
                        }`}
                      >
                        <FloorPill
                          active={activeFloor === 'all'}
                          onClick={() => setActiveFloor('all')}
                          isLight={isLight}
                          label="Barcha qavatlar"
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
                    <div className="relative flex-1 min-w-[200px] max-w-sm self-stretch md:self-auto">
                      <Search
                        size={14}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Xona raqami yoki talaba ismini qidirish..."
                        className={`no-shelf w-full rounded-xl border py-2 pl-9 pr-8 text-xs sm:text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                          isLight
                            ? 'border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-indigo-500'
                            : 'border-slate-800 bg-slate-900 text-slate-200 placeholder-slate-500 focus:border-indigo-500'
                        }`}
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          data-student-button="plain"
                          onClick={() => setSearchQuery('')}
                          className="no-shelf absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status Filter Carousel + Actions Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap py-1">
                      {([
                        ['all', 'Barchasi', undefined],
                        ['unmarked', 'Kutilayotganlar', s?.unmarked],
                        ['present', 'Hozir', s?.present],
                        ['absent', 'Uzrsiz yo‘q', s?.absent],
                        ['excused', 'Ruxsat bilan', s ? s.excused - s.home : undefined],
                        ['leave', 'Uyda', s?.home],
                        ['gps', 'GPS bilan', s?.gpsCount],
                      ] as const).map(([fKey, label, count]) => {
                        const active = statusFilter === fKey
                        return (
                          <button
                            key={fKey}
                            type="button"
                            data-student-button="plain"
                            onClick={() => setStatusFilter(fKey)}
                            className={`no-shelf inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all select-none ${
                              active
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : isLight
                                  ? 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                            }`}
                          >
                            <span>{label}</span>
                            {count !== undefined && count > 0 && (
                              <span
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                                  active
                                    ? 'bg-white/25 text-white'
                                    : isLight
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {count}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Toolbar Utilities */}
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        type="button"
                        data-student-button="plain"
                        onClick={toggleAllFloors}
                        className={`no-shelf inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                          isLight
                            ? 'border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50'
                            : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <Layers size={13} />
                        <span>{allCollapsed ? 'Barchasini ochish' : 'Barchasini yopish'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Filter Notice */}
                  {(statusFilter !== 'all' || searchQuery) && (
                    <div
                      className={`no-shelf flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold ${
                        isLight ? 'bg-indigo-50/80 border-indigo-100 text-indigo-700' : 'bg-indigo-950/40 border-indigo-900/60 text-indigo-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Filter size={13} />
                        <span>
                          Faol filtr:{' '}
                          <strong>
                            {statusFilter !== 'all' && `«${STATUS_FILTER_LABEL[statusFilter]}»`}
                            {statusFilter !== 'all' && searchQuery && ' + '}
                            {searchQuery && `«${searchQuery}»`}
                          </strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        data-student-button="plain"
                        onClick={() => {
                          setStatusFilter('all')
                          setSearchQuery('')
                        }}
                        className="no-shelf inline-flex items-center gap-1 text-[11px] font-bold underline hover:opacity-80"
                      >
                        <RotateCcw size={11} /> Tozalash
                      </button>
                    </div>
                  )}

                  {/* Floor Panels */}
                  <div className="space-y-4">
                    {filteredFloors.length === 0 ? (
                      <div className={`no-shelf rounded-2xl border p-10 text-center ${ui.card}`}>
                        <p className={`text-sm ${ui.muted}`}>
                          Tanlangan filtr yoki qidiruv bo‘yicha hech qanday xona yoki talaba topilmadi
                        </p>
                        <button
                          type="button"
                          data-student-button="plain"
                          onClick={() => {
                            setStatusFilter('all')
                            setSearchQuery('')
                            setActiveFloor('all')
                          }}
                          className="no-shelf mt-2 text-xs font-bold text-indigo-600 hover:underline"
                        >
                          Barcha filtrlarni tozalash
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
                          isCollapsed={collapsedFloors.has(f.floor)}
                          onToggleCollapse={() => toggleFloor(f.floor)}
                          onMark={(ids, st) => void markMany(ids, st)}
                          onMarkRoomAll={(room) => markRoomAll(room, 'present')}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: Home Leaves */}
          {activeTab === 'leaves' && (
            <div className="space-y-4">
              <LeavesPanel isLight={isLight} showEmptyState />
            </div>
          )}

          {/* TAB 3: Multi-day History & Spreadsheet Export */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <DayByDayAttendance dormLabel="Yotoqxona" isLight={isLight} historyUrl={periodUrl} />
            </div>
          )}

          {/* TAB 4: Unexcused Absence Flags */}
          {activeTab === 'flags' && (
            <div className="space-y-4">
              {flags.length === 0 ? (
                <div className={`no-shelf rounded-3xl border p-8 sm:p-12 text-center ${ui.card}`}>
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck size={28} />
                  </div>
                  <h3 className={`text-base font-bold ${ui.strong}`}>
                    Ogohlantirish talab qiluvchi holatlar yo‘q
                  </h3>
                  <p className={`mx-auto mt-1 max-w-sm text-xs sm:text-sm ${ui.muted}`}>
                    Barcha sababsiz yo‘qliklar ko‘rib chiqilgan yoki hozircha qayd etilmagan.
                  </p>
                </div>
              ) : (
                <div className={`no-shelf rounded-2xl border p-4 sm:p-5 ${ui.card}`}>
                  <div
                    className={`mb-4 flex items-center justify-between text-xs font-bold uppercase tracking-wider ${
                      isLight ? 'text-amber-700' : 'text-amber-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle size={15} /> Sababsiz yo‘qlar — ko‘rib chiqing ({flags.length})
                    </span>
                    <span className="text-[11px] font-normal lowercase">{flags.length} ta holat kutilmoqda</span>
                  </div>
                  <div className="space-y-2.5">
                    {flags.map((fl) => (
                      <div
                        key={fl.recordId}
                        className={`no-shelf flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3 sm:p-3.5 ${ui.inset}`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${ui.strong}`}>
                              {fl.fullName || `${fl.roomNumber}-xona talabasi`}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {fl.roomNumber}-xona
                            </span>
                          </div>
                          <p className={`mt-0.5 text-xs ${ui.muted}`}>
                            Sana: <strong className={ui.strong}>{fl.sessionDate}</strong>
                            {fl.note ? ` · Izoh: ${fl.note}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          <button
                            type="button"
                            data-student-button="plain"
                            onClick={() => resolveFlag(fl.recordId, 'dismiss')}
                            className={`no-shelf rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${ui.btnGhost}`}
                          >
                            Sababli edi
                          </button>
                          <button
                            type="button"
                            data-student-button="plain"
                            onClick={() => resolveFlag(fl.recordId, 'warn')}
                            className="no-shelf inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-rose-700 shadow-xs active:scale-95"
                          >
                            <ShieldAlert size={13} /> Ogohlantirish berish
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Sticky HUD Floating Bar (Live Roll-Call Control) ───────────────── */}
      <AnimatePresence>
        {view && canWrite && isSessionOpen && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed inset-x-0 bottom-3 z-40 px-3 sm:px-4 lg:pl-[290px] pointer-events-none"
          >
            <div
              className={`no-shelf pointer-events-auto mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border p-2.5 sm:p-3 shadow-2xl backdrop-blur-xl ${
                isLight
                  ? 'bg-white/95 border-slate-200/90 shadow-slate-900/15'
                  : 'bg-slate-900/95 border-slate-700/90 shadow-black/50'
              }`}
            >
              <div className="flex items-center gap-2.5 pl-1.5 min-w-0">
                {totalUnmarked > 0 ? (
                  <>
                    <span className="flex h-3 w-3 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    <span className={`text-xs sm:text-sm font-semibold truncate ${ui.strong}`}>
                      <strong className="text-amber-600 dark:text-amber-400 font-black tabular-nums">
                        {totalUnmarked}
                      </strong>{' '}
                      ta talaba kutilmoqda
                    </span>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={18} className="shrink-0" />
                    <span className="text-xs sm:text-sm font-bold truncate">
                      Barcha talabalar belgilandi! Yo‘qlama to‘liq.
                    </span>
                  </div>
                )}
              </div>

              {totalUnmarked > 0 && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    data-student-button="plain"
                    onClick={() => {
                      setActiveTab('roster')
                      setStatusFilter('unmarked')
                    }}
                    className={`no-shelf inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                      isLight
                        ? 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                    }`}
                  >
                    <span>Faqat kutilayotganlar</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ───────────────────────── Sub-Components ───────────────────────── */

function HeroRing({ pct, marked, total }: { pct: number; marked: number; total: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0 text-white self-center sm:self-auto">
      <svg width="98" height="98" viewBox="0 0 98 98" className="-rotate-90">
        <circle
          cx="49"
          cy="49"
          r={r}
          fill="none"
          stroke="rgba(255, 255, 255, 0.25)"
          strokeWidth="8"
        />
        <circle
          cx="49"
          cy="49"
          r={r}
          fill="none"
          stroke="#ffffff"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-base sm:text-lg font-black text-white tabular-nums leading-none drop-shadow-xs">
          {marked}
          <span className="text-xs font-bold text-white/70">/{total}</span>
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5 text-white/90">
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
      data-student-button="plain"
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
        {done && (
          <Check size={11} className={active ? (isLight ? 'text-indigo-600' : 'text-white') : 'text-emerald-500'} />
        )}
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
  isCollapsed,
  onToggleCollapse,
  onMark,
  onMarkRoomAll,
}: {
  floor: FloorData
  isLight: boolean
  ui: ReturnType<typeof dekanUI>
  canWrite: boolean
  pendingIds: Set<string>
  isCollapsed: boolean
  onToggleCollapse: () => void
  onMark: (ids: string[], state: AttendanceState) => void
  onMarkRoomAll: (room: RosterRoom) => void
}) {
  const done = floor.total > 0 && floor.marked >= floor.total
  const pct = floor.total ? Math.round((floor.marked / floor.total) * 100) : 0

  return (
    <motion.section
      layout
      className={`no-shelf overflow-hidden rounded-2xl border transition-all ${
        isLight ? 'border-slate-200/90 bg-white shadow-xs' : 'border-slate-800/90 bg-slate-900/60 shadow-xs'
      }`}
    >
      {/* Floor Header Bar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-3 sm:p-4 border-b ${
          isLight ? 'bg-slate-50/70 border-slate-100' : 'bg-slate-900/50 border-slate-800/80'
        }`}
      >
        <button
          type="button"
          data-student-button="plain"
          onClick={onToggleCollapse}
          className="no-shelf flex items-center gap-3 min-w-0 text-left cursor-pointer"
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black transition-colors ${
              done
                ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/20'
                : isLight
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                  : 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/60'
            }`}
          >
            {done ? <Check size={18} strokeWidth={2.8} /> : floor.floor > 0 ? floor.floor : '—'}
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
            className={`${ui.muted} transition-transform duration-200 ml-1 ${!isCollapsed ? 'rotate-180' : ''}`}
          />
        </button>

        <div className="flex items-center gap-3 ml-auto">
          {/* Progress bar */}
          <div
            className={`hidden sm:block h-2 w-28 sm:w-36 overflow-hidden rounded-full ${
              isLight ? 'bg-slate-200/80' : 'bg-slate-800'
            }`}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                done ? 'bg-emerald-600' : 'bg-indigo-600'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <span
            className={`text-xs font-bold tabular-nums ${
              done ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : ui.muted
            }`}
          >
            {floor.marked}/{floor.total}
          </span>

          {canWrite && floor.unmarkedIds.length > 0 && (
            <button
              type="button"
              data-student-button="plain"
              onClick={() => onMark(floor.unmarkedIds, 'present')}
              className={`no-shelf inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs ${
                isLight
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/90 hover:bg-emerald-100 hover:border-emerald-300'
                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
              }`}
              title="Qavatdagi barcha belgilanmaganlarni «Hozir» deb belgilash"
            >
              <CheckCheck size={13} strokeWidth={2.4} />
              <span>Qolganlari ✓</span>
            </button>
          )}
        </div>
      </div>

      {/* Rooms Grid inside Floor */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-2.5 p-2 min-[360px]:gap-3 min-[360px]:p-3 sm:grid-cols-2 sm:gap-3.5 sm:p-4 xl:grid-cols-3">
              {floor.rooms.map((room) => (
                <RoomCard
                  key={room.roomNumber}
                  room={room}
                  isLight={isLight}
                  ui={ui}
                  canWrite={canWrite}
                  pendingIds={pendingIds}
                  onMark={onMark}
                  onMarkRoomAll={() => onMarkRoomAll(room)}
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
  onMarkRoomAll,
}: {
  room: RosterView['rooms'][number]
  isLight: boolean
  ui: ReturnType<typeof dekanUI>
  canWrite: boolean
  pendingIds: Set<string>
  onMark: (ids: string[], state: AttendanceState) => void
  onMarkRoomAll: () => void
}) {
  const present = room.residents.filter((r) => r.state === 'present').length
  const marked = room.residents.filter((r) => r.state !== 'unmarked').length
  const full = marked === room.residents.length
  const hasUnmarked = room.residents.some((r) => r.state === 'unmarked' && r.source !== 'leave')

  return (
    <div
      className={`no-shelf min-w-0 rounded-2xl border p-2.5 min-[360px]:p-3 sm:p-3.5 transition-all ${
        full
          ? isLight
            ? 'bg-slate-50/70 border-slate-200/80 hover:border-slate-300'
            : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
          : isLight
            ? 'bg-amber-50/30 border-amber-200/60 hover:border-amber-300'
            : 'bg-amber-950/10 border-amber-800/40 hover:border-amber-700'
      }`}
    >
      {/* Room Header with Quick "Hammasi hozir" Button */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1.5 pb-2.5 mb-2.5 border-b border-slate-200/70 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <DoorOpen size={16} className="text-indigo-600 dark:text-indigo-400" />
          <span className={`text-xs sm:text-sm font-black ${ui.strong}`}>
            {room.roomNumber ? `${room.roomNumber}-xona` : 'Xonasiz'}
          </span>
          <span
            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold tabular-nums border ${
              full
                ? isLight
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : isLight
                  ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}
          >
            {present}/{room.residents.length} hozir
          </span>
        </div>

        {/* Room-level 1-tap: the still-unmarked residents → "Hozir" */}
        {canWrite && hasUnmarked && (
          <button
            type="button"
            data-student-button="plain"
            onClick={onMarkRoomAll}
            className={`no-shelf inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${
              isLight
                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
            }`}
            title="Xonadagi belgilanmaganlarni «Hozir» deb belgilash"
          >
            <Check size={11} strokeWidth={2.6} />
            <span>Qolganlari ✓</span>
          </button>
        )}
      </div>

      {/* Residents in this Room */}
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
      className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 py-1 min-[360px]:gap-x-2.5 min-[360px]:p-1 rounded-xl transition-colors ${
        pending ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div
        className={`w-8 h-8 rounded-xl hidden min-[360px]:flex items-center justify-center font-bold text-xs shrink-0 border transition-colors ${
          isLight ? 'bg-slate-100 text-slate-700 border-slate-200/80' : 'bg-slate-800 text-slate-200 border-slate-700'
        }`}
      >
        {initials(r.fullName)}
      </div>

      <div className="min-w-0 flex-1 basis-24">
        <span className={`block text-xs sm:text-sm font-semibold break-words line-clamp-2 ${ui.strong}`}>
          {r.fullName}
        </span>
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          {r.source === 'self_location' && (
            <span
              className="inline-flex items-center gap-1 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-800/50"
              title="Talaba GPS bilan tekshiruvdan o‘tgan"
            >
              <MapPin size={9} />
              <span>{r.selfDistanceM != null ? `${r.selfDistanceM}m` : 'GPS tasdiqlangan'}</span>
            </span>
          )}
          {r.softFlag && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-md">
              <AlertTriangle size={9} />
              <span>Ko‘rib chiqiladi</span>
            </span>
          )}
        </div>
      </div>

      {r.source === 'leave' ? (
        <span
          className={`no-shelf ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
            isLight ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-sky-500/30 bg-sky-500/15 text-sky-300'
          }`}
          title="Uyga ketish arizasi bilan ruxsat berilgan (o‘zgartirib bo‘lmaydi)"
        >
          <Home size={12} /> Uyda
        </span>
      ) : canWrite ? (
        <div
          className={`no-shelf ml-auto inline-flex items-center p-0.5 rounded-xl border gap-0.5 shrink-0 transition-colors ${
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
                data-student-button="plain"
                aria-label={STATE_UI[st].label}
                title={STATE_UI[st].label}
                onClick={() => onMark(st)}
                className={`no-shelf h-7 w-7 sm:h-8 sm:w-8 rounded-lg text-[11px] font-black inline-flex items-center justify-center transition-all duration-150 active:scale-90 ${
                  active
                    ? STATE_UI[st].solid
                    : isLight
                      ? 'text-slate-400 hover:text-slate-800 hover:bg-white/80'
                      : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.08]'
                }`}
              >
                {st === 'present' && <Check size={13} strokeWidth={2.8} />}
                {st === 'absent' && <X size={13} strokeWidth={2.8} />}
                {st === 'excused' && <span>R</span>}
              </button>
            )
          })}
        </div>
      ) : (
        <span
          className={`ml-auto shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
            isLight ? STATE_UI[r.state].softLight : STATE_UI[r.state].softDark
          }`}
        >
          {STATE_UI[r.state].short}
        </span>
      )}
    </div>
  )
}
