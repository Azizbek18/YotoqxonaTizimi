'use client'

import { useMemo, useState } from 'react'
import {
  Check,
  X,
  Home,
  CircleSlash,
  CalendarClock,
  Users,
  Search,
  MapPin,
  Clock,
} from 'lucide-react'
import type { AttendanceState, RosterView } from '@/features/attendance/types'

// Uyga ketish arizasi bilan "Uyda" bo'lgan talaba — alohida (ko'k) rang, qo'lda o'zgartirilmaydi.
const HOME_META = {
  label: 'Uyda',
  short: 'Uyda',
  dot: 'bg-sky-400',
  chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  badge: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
}

const STATE_META: Record<AttendanceState, { label: string; short: string; dot: string; chip: string; badge: string }> = {
  present: {
    label: 'Hozir',
    short: 'Hozir',
    dot: 'bg-emerald-400',
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    badge: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
  },
  absent: {
    label: 'Uzrsiz yo‘q',
    short: 'Yo‘q',
    dot: 'bg-rose-400',
    chip: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    badge: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
  },
  excused: {
    label: 'Ruxsat bilan',
    short: 'Ruxsat',
    dot: 'bg-amber-400',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
  },
  unmarked: {
    label: 'Belgilanmagan',
    short: 'Kutilmoqda',
    dot: 'bg-slate-400',
    chip: 'bg-slate-500/15 text-slate-300 border-slate-500/25',
    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  },
}

// Tap cycles through the three real states; unmarked only appears until the first tap.
const CYCLE: AttendanceState[] = ['present', 'absent', 'excused']
function nextState(current: AttendanceState): AttendanceState {
  const i = CYCLE.indexOf(current)
  return CYCLE[(i + 1) % CYCLE.length] ?? 'present'
}

export function StateLegend() {
  return (
    <div className="flex flex-wrap items-center gap-1.5 min-[360px]:gap-2">
      {(Object.keys(STATE_META) as AttendanceState[]).map((s) => (
        <span
          key={s}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold min-[360px]:gap-1.5 min-[360px]:px-2.5 min-[360px]:py-1 min-[360px]:text-[11px] ${STATE_META[s].chip}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${STATE_META[s].dot}`} />
          {STATE_META[s].label}
        </span>
      ))}
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold min-[360px]:gap-1.5 min-[360px]:px-2.5 min-[360px]:py-1 min-[360px]:text-[11px] ${HOME_META.chip}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${HOME_META.dot}`} />
        {HOME_META.label}
      </span>
    </div>
  )
}

type FilterKey = 'all' | 'todo' | 'present' | 'absent' | 'excused' | 'leave'

export default function AttendanceBoard({
  view,
  onMark,
  onClose,
  busy,
}: {
  view: RosterView
  onMark: (studentId: string, state: AttendanceState) => void
  onClose?: () => void
  busy?: boolean
}) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')

  const { summary, rooms, session, canWrite } = view
  const marked = summary.present + summary.absent + summary.excused
  const pct = summary.total ? Math.round((marked / summary.total) * 100) : 0
  const homeCount = rooms.reduce((n, r) => n + r.residents.filter((x) => x.source === 'leave').length, 0)
  const closed = session.status !== 'open'

  // Filter & Search logic
  const shownRooms = useMemo(() => {
    const q = search.trim().toLowerCase()

    return rooms
      .map((r) => {
        const matchingResidents = r.residents.filter((res) => {
          // Status filter
          if (filter === 'todo') {
            if (res.state !== 'unmarked' && !(res.source === 'self_location' && res.state === 'absent')) return false
          } else if (filter === 'present') {
            if (res.state !== 'present') return false
          } else if (filter === 'absent') {
            if (res.state !== 'absent') return false
          } else if (filter === 'excused') {
            if (res.state !== 'excused' || res.source === 'leave') return false
          } else if (filter === 'leave') {
            if (res.source !== 'leave') return false
          }

          // Search query (student name or room number)
          if (q) {
            const matchesName = res.fullName.toLowerCase().includes(q)
            const matchesRoom = r.roomNumber.toLowerCase().includes(q)
            if (!matchesName && !matchesRoom) return false
          }

          return true
        })

        return { ...r, residents: matchingResidents }
      })
      .filter((r) => r.residents.length > 0)
  }, [rooms, filter, search])

  // Same predicate as the 'todo' filter, so the pill's count matches its list.
  const todoCount = rooms.reduce(
    (n, r) => n + r.residents.filter((x) => x.state === 'unmarked' || (x.source === 'self_location' && x.state === 'absent')).length,
    0,
  )

  return (
    <div className="min-w-0 space-y-4">
      {/* Session Hero / Summary Card */}
      <div className="no-shelf min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-3 min-[340px]:p-3.5 min-[360px]:p-4 sm:p-5 backdrop-blur-xl">
        <div className="flex min-w-0 items-center justify-between gap-2.5 min-[360px]:gap-4">
          <div className="min-w-0 flex-1">
            {/* Session Type & Badges */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 min-[360px]:text-[11px]">
              <span className="inline-flex items-center gap-1 font-bold text-slate-300">
                <CalendarClock size={12} className="shrink-0 text-purple-400" />
                {session.kind === 'nightly' ? 'Kechki yo‘qlama' : 'Tekshiruv'}
              </span>
              {session.floor != null && (
                <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
                  {session.floor}-qavat
                </span>
              )}
              {session.gender && (
                <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
                  {session.gender === 'male' ? 'Yigitlar' : 'Qizlar'}
                </span>
              )}
              {!closed && (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Jonli
                </span>
              )}
            </div>

            {/* Attendance main numbers */}
            <div className="mt-2 flex flex-wrap items-baseline gap-1.5 min-[360px]:gap-2">
              <p className="text-2xl font-black tabular-nums text-white min-[360px]:text-3xl">
                {summary.present}
                <span className="text-base font-semibold text-slate-500 min-[360px]:text-lg">/{summary.total}</span>
              </p>
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-400 min-[360px]:text-sm">hozir</span>
            </div>

            {/* Micro subtitle description */}
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400 min-[360px]:text-xs">
              {summary.excused - homeCount > 0 && `${summary.excused - homeCount} ruxsat · `}
              {homeCount > 0 && `${homeCount} uyda · `}
              {summary.absent} uzrsiz yo‘q · {summary.unmarked} belgilanmagan
            </p>
          </div>

          {/* Compact Progress Ring */}
          <ProgressRing pct={pct} />
        </div>

        {/* Quick Stat Chips Grid */}
        <div className="mt-3.5 grid grid-cols-2 gap-1.5 min-[340px]:grid-cols-4 min-[360px]:gap-2 pt-3 border-t border-white/5">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2 text-center">
            <span className="block text-base font-black tabular-nums text-emerald-300 min-[360px]:text-lg">
              {summary.present}
            </span>
            <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">
              Hozir
            </span>
          </div>

          <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-2 text-center">
            <span className="block text-base font-black tabular-nums text-sky-300 min-[360px]:text-lg">
              {homeCount}
            </span>
            <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-sky-400/80">
              Uyda
            </span>
          </div>

          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2 text-center">
            <span className="block text-base font-black tabular-nums text-rose-300 min-[360px]:text-lg">
              {summary.absent}
            </span>
            <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-rose-400/80">
              Yo‘q
            </span>
          </div>

          <div className="rounded-xl border border-slate-500/20 bg-slate-500/10 p-2 text-center">
            <span className="block text-base font-black tabular-nums text-slate-300 min-[360px]:text-lg">
              {summary.unmarked}
            </span>
            <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Kutilmoqda
            </span>
          </div>
        </div>

        {closed && (
          <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-200">
            {session.status === 'auto_closed' ? 'Yo‘qlama vaqti tugagan' : 'Yo‘qlama yakunlangan'} — ma‘lumotlar qayd etildi.
          </p>
        )}
      </div>

      {/* Search & Filter Controls */}
      <div className="space-y-2.5">
        {/* Search Bar */}
        <div className="relative w-full min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Talaba ismi yoki xona raqami..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-8 pr-8 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/30"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Pills Scroll Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            data-student-button="plain"
            onClick={() => setFilter('all')}
            className={`no-shelf shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
              filter === 'all'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            Barchasi ({summary.total})
          </button>

          <button
            type="button"
            data-student-button="plain"
            onClick={() => setFilter('todo')}
            className={`no-shelf shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
              filter === 'todo'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            Kutilayotganlar ({todoCount})
          </button>

          <button
            type="button"
            data-student-button="plain"
            onClick={() => setFilter('present')}
            className={`no-shelf shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
              filter === 'present'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            Hozir ({summary.present})
          </button>

          <button
            type="button"
            data-student-button="plain"
            onClick={() => setFilter('absent')}
            className={`no-shelf shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
              filter === 'absent'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            Yo‘q ({summary.absent})
          </button>

          {homeCount > 0 && (
            <button
              type="button"
              data-student-button="plain"
              onClick={() => setFilter('leave')}
              className={`no-shelf shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                filter === 'leave'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              Uyda ({homeCount})
            </button>
          )}
        </div>

        {/* Legend */}
        <div className="pt-1">
          <StateLegend />
        </div>
      </div>

      {/* Rooms List */}
      {shownRooms.length === 0 ? (
        <div className="no-shelf rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-400">
          <Users className="mx-auto mb-2 text-slate-500 opacity-60" size={24} />
          <p className="text-sm font-bold text-white">Hech narsa topilmadi</p>
          <p className="mt-1 text-xs text-slate-400">
            {search ? 'Qidiruv bo‘yicha talaba mavjud emas' : filter === 'todo' ? 'Hamma talaba tasdiqlandi 🎉' : 'Ushbu qavatda talaba yo‘q'}
          </p>
          {(search || filter !== 'all') && (
            <button
              type="button"
              data-student-button="plain"
              onClick={() => {
                setSearch('')
                setFilter('all')
              }}
              className="no-shelf mt-3 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Filtrni tozalash
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shownRooms.map((room) => {
            const roomPresent = room.residents.filter((r) => r.state === 'present').length
            return (
              <div
                key={room.roomNumber}
                className="no-shelf min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 min-[340px]:p-3 min-[360px]:p-3.5 backdrop-blur-xl"
              >
                {/* Room Heading */}
                <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-200">
                    <Home size={13} className="shrink-0 text-purple-400" />
                    <span>{room.roomNumber}-xona</span>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] font-bold text-slate-400">
                    {roomPresent}/{room.residents.length} hozir
                  </span>
                </div>

                {/* Residents */}
                <div className="flex flex-col gap-1.5 min-w-0">
                  {room.residents.map((r) => {
                    const isLeave = r.source === 'leave'
                    const meta = isLeave ? HOME_META : STATE_META[r.state]

                    const innerContent = (
                      <>
                        {/* State icon */}
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md">
                          <StateIcon state={r.state} isLeave={isLeave} />
                        </div>

                        {/* Name */}
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white min-[360px]:text-[13px]">
                          {r.fullName}
                        </span>

                        {/* GPS Distance / Leave badge */}
                        {r.source === 'self_location' && (
                          <span
                            className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-mono font-bold text-cyan-300"
                            title="Talaba o‘z joylashuvi bilan tasdiqladi"
                          >
                            <MapPin size={9} className="shrink-0" />
                            <span>{r.selfDistanceM != null ? `${r.selfDistanceM}m` : 'GPS'}</span>
                          </span>
                        )}

                        {/* Status text pill */}
                        <span
                          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider min-[360px]:px-2 min-[360px]:text-[10px] ${meta.chip}`}
                        >
                          {meta.short}
                        </span>
                      </>
                    )

                    if (canWrite && !isLeave) {
                      return (
                        <button
                          key={r.id}
                          type="button"
                          disabled={busy}
                          onClick={() => onMark(r.id, nextState(r.state))}
                          data-student-button="plain"
                          className={`no-shelf flex min-w-0 items-center gap-2 rounded-xl border p-2 text-left transition active:scale-[0.98] ${meta.chip} hover:brightness-110`}
                        >
                          {innerContent}
                        </button>
                      )
                    }

                    return (
                      <div
                        key={r.id}
                        className={`no-shelf flex min-w-0 items-center gap-2 rounded-xl border p-2 text-left transition ${meta.chip}`}
                        title={isLeave ? 'Uyga ketish arizasi bilan uyda' : undefined}
                      >
                        {innerContent}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Staff close button if write allowed */}
      {canWrite && onClose && (
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          data-student-button="plain"
          className="no-shelf w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-50"
        >
          Yo‘qlamani yakunlash
        </button>
      )}
    </div>
  )
}

function StateIcon({ state, isLeave }: { state: AttendanceState; isLeave?: boolean }) {
  if (isLeave) return <Home size={13} className="shrink-0 text-sky-400" />
  if (state === 'present') return <Check size={13} className="shrink-0 text-emerald-400" />
  if (state === 'absent') return <X size={13} className="shrink-0 text-rose-400" />
  if (state === 'excused') return <Clock size={13} className="shrink-0 text-amber-400" />
  return <CircleSlash size={12} className="shrink-0 text-slate-400 opacity-60" />
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <div className="relative flex shrink-0 items-center justify-center">
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-white/10" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          className="text-emerald-400 transition-all duration-500"
        />
      </svg>
      <span className="absolute text-center text-xs font-black text-white">{pct}%</span>
    </div>
  )
}
