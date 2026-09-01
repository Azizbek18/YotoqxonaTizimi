'use client'

import { useMemo, useState } from 'react'
import { Check, X, Home, CircleSlash, CalendarClock, Users } from 'lucide-react'
import type { AttendanceState, RosterView } from '@/features/attendance/types'

const STATE_META: Record<AttendanceState, { label: string; dot: string; chip: string }> = {
  present:  { label: 'Hozir',        dot: 'bg-emerald-500', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  absent:   { label: 'Uzrsiz yo‘q',  dot: 'bg-rose-500',    chip: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  excused:  { label: 'Ruxsat bilan', dot: 'bg-amber-500',   chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  unmarked: { label: 'Belgilanmagan', dot: 'bg-slate-500',  chip: 'bg-slate-500/15 text-slate-300 border-slate-500/25' },
}

// Tap cycles through the three real states; unmarked only appears until the
// first tap.
const CYCLE: AttendanceState[] = ['present', 'absent', 'excused']
function nextState(current: AttendanceState): AttendanceState {
  const i = CYCLE.indexOf(current)
  return CYCLE[(i + 1) % CYCLE.length] ?? 'present'
}

export function StateLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(STATE_META) as AttendanceState[]).map((s) => (
        <span key={s} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATE_META[s].chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${STATE_META[s].dot}`} />
          {STATE_META[s].label}
        </span>
      ))}
    </div>
  )
}

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
  const [filter, setFilter] = useState<'all' | 'todo'>('all')
  const { summary, rooms, session, canWrite } = view
  const marked = summary.present + summary.absent + summary.excused
  const pct = summary.total ? Math.round((marked / summary.total) * 100) : 0

  const shownRooms = useMemo(() => {
    if (filter === 'all') return rooms
    return rooms
      .map((r) => ({ ...r, residents: r.residents.filter((x) => x.state === 'unmarked' || (x.source === 'self_location' && x.state === 'absent')) }))
      .filter((r) => r.residents.length > 0)
  }, [rooms, filter])

  const closed = session.status !== 'open'

  return (
    <div className="space-y-5">
      {/* summary */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <CalendarClock size={13} />
              {session.kind === 'nightly' ? 'Kechki yo‘qlama' : 'Tekshiruv'}
              {session.floor != null && <span>· {session.floor}-qavat</span>}
              {session.gender && <span>· {session.gender === 'male' ? 'yigitlar' : 'qizlar'}</span>}
            </div>
            <p className="mt-1 text-2xl font-black text-white tabular-nums">
              {summary.present}<span className="text-slate-500">/{summary.total}</span>
              <span className="ml-2 text-sm font-semibold text-slate-400">hozir</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {summary.excused} ruxsat · {summary.absent} yo‘q · {summary.unmarked} belgilanmagan
            </p>
          </div>
          <ProgressRing pct={pct} />
        </div>
        {closed && (
          <p className="mt-3 rounded-lg bg-slate-500/10 px-3 py-2 text-[11px] font-semibold text-slate-300">
            {session.status === 'auto_closed' ? 'Yo‘qlama vaqti tugadi' : 'Yo‘qlama yakunlandi'} — o‘zgartirib bo‘lmaydi.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <StateLegend />
        {canWrite && (
          <button
            type="button"
            onClick={() => setFilter((f) => (f === 'all' ? 'todo' : 'all'))}
            className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-300 hover:bg-white/5"
          >
            {filter === 'all' ? 'Faqat qolganlar' : 'Hammasi'}
          </button>
        )}
      </div>

      {/* rooms */}
      {shownRooms.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-sm text-slate-400">
          <Users className="mx-auto mb-2 opacity-40" size={22} />
          {filter === 'todo' ? 'Hamma tasdiqlandi 🎉' : 'Bu qavatda talaba yo‘q'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shownRooms.map((room) => (
            <div key={room.roomNumber} className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
              <div className="mb-2.5 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-300">
                <Home size={13} className="text-slate-500" />
                {room.roomNumber}-xona
                <span className="ml-auto font-mono text-[10px] text-slate-500">
                  {room.residents.filter((r) => r.state === 'present').length}/{room.residents.length}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {room.residents.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    disabled={!canWrite || busy}
                    onClick={() => onMark(r.id, nextState(r.state))}
                    className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors disabled:opacity-70 disabled:cursor-default ${STATE_META[r.state].chip}`}
                  >
                    <StateIcon state={r.state} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{r.fullName}</span>
                    {r.source === 'self_location' && (
                      <span className="shrink-0 font-mono text-[9px] uppercase text-slate-400" title="Talaba joylashuv bilan tasdiqladi">
                        {r.selfDistanceM != null ? `${r.selfDistanceM} m` : 'GPS'}
                      </span>
                    )}
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide">{STATE_META[r.state].label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {canWrite && onClose && (
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3.5 text-xs font-black uppercase tracking-widest text-white transition hover:brightness-110 disabled:opacity-50"
        >
          Yo‘qlamani yakunlash
        </button>
      )}
    </div>
  )
}

function StateIcon({ state }: { state: AttendanceState }) {
  if (state === 'present') return <Check size={14} className="shrink-0" />
  if (state === 'absent') return <X size={14} className="shrink-0" />
  if (state === 'excused') return <Home size={13} className="shrink-0" />
  return <CircleSlash size={13} className="shrink-0 opacity-60" />
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0 -rotate-90">
      <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-white/10" />
      <circle
        cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} className="text-emerald-400 transition-all duration-500"
      />
      <text x="32" y="34" textAnchor="middle" className="rotate-90 fill-white text-[13px] font-black" transform="rotate(90 32 32)">
        {pct}%
      </text>
    </svg>
  )
}
