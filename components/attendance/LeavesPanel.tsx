'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Check, ChevronDown, Home, Loader2, MapPin, Phone, ShieldAlert, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchStaffLeaves, recordLeaveCall } from '@/features/home-leave/client/api'
import {
  LEAVE_CALL_LABELS,
  LEAVE_KIND_LABELS,
  type HomeLeaveStaffRow,
  type LeaveCallResult,
} from '@/features/home-leave/types'

const CALL_BUTTONS: { result: Exclude<LeaveCallResult, 'none'>; label: string; tone: string }[] = [
  { result: 'ok', label: 'Tasdiqladi', tone: 'bg-emerald-600 text-white' },
  { result: 'no_answer', label: 'Javob bermadi', tone: 'bg-amber-500 text-white' },
  { result: 'denied', label: 'Tasdiqlamadi', tone: 'bg-rose-600 text-white' },
]

function fmt(d: string): string {
  const [, m, day] = d.split('-')
  return `${day}.${m}`
}

/**
 * Uyga ketgan (ketadigan) talabalar. Tarbiyachi/sardor aloqa shaxsiga qo'ng'iroq
 * qilib natijani belgilaydi — katta tizim ishi yo'q: bitta bosish.
 */
export default function LeavesPanel({
  isLight,
  showEmptyState = false,
}: {
  isLight: boolean
  showEmptyState?: boolean
}) {
  const [rows, setRows] = useState<HomeLeaveStaffRow[] | null>(null)
  const [canWrite, setCanWrite] = useState(false)
  const [open, setOpen] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchStaffLeaves()
      setRows(data.leaves)
      setCanWrite(data.canWrite)
    } catch {
      setRows([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const call = async (id: string, result: Exclude<LeaveCallResult, 'none'>) => {
    setBusyId(id)
    try {
      await recordLeaveCall(id, result)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Saqlab bo'lmadi")
    } finally {
      setBusyId(null)
    }
  }

  const card = isLight ? 'border-sky-200 bg-sky-50' : 'border-sky-500/25 bg-sky-500/[0.06]'
  const inset = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/[0.04]'
  const strong = isLight ? 'text-slate-900' : 'text-white'
  const muted = isLight ? 'text-slate-500' : 'text-slate-400'

  if (rows === null) {
    if (!showEmptyState) return null
    return (
      <div className={`no-shelf rounded-2xl border p-8 text-center ${card}`}>
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-sky-500" />
        <p className={`mt-2 text-xs font-semibold ${muted}`}>Uyga ketish arizalari yuklanmoqda...</p>
      </div>
    )
  }

  if (rows.length === 0) {
    if (!showEmptyState) return null
    return (
      <div className={`no-shelf rounded-2xl border p-8 sm:p-12 text-center ${card}`}>
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
          <Home size={26} />
        </div>
        <h4 className={`text-base font-bold ${strong}`}>Uyga ketgan talabalar yo‘q</h4>
        <p className={`mx-auto mt-1 max-w-sm text-xs sm:text-sm ${muted}`}>
          Hozirda yotoqxonadan uyga ketish arizasi tasdiqlangan talabalar mavjud emas.
        </p>
      </div>
    )
  }

  return (
    <div className={`no-shelf rounded-2xl border p-2.5 min-[340px]:p-3.5 sm:p-4 min-w-0 ${card}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-student-button="plain"
        className="no-shelf flex w-full cursor-pointer items-center gap-2 text-left min-w-0"
      >
        <Home size={15} className="shrink-0 text-sky-500" />
        <span className={`min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wider ${isLight ? 'text-sky-700' : 'text-sky-300'}`}>
          Uyga ketgan talabalar ({rows.length})
        </span>
        <ChevronDown size={15} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${muted}`} />
      </button>

      {open && (
        <div className="mt-3 space-y-2.5 min-w-0">
          {rows.map((r) => {
            const pending = r.status === 'pending'
            const upcoming = !pending && !r.inEffect
            return (
              <div key={r.id} className={`no-shelf rounded-xl border p-2.5 min-[340px]:p-3 min-w-0 ${inset}`}>
                <div className="flex flex-wrap items-start justify-between gap-1.5 min-[360px]:gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-xs min-[360px]:text-sm font-bold ${strong}`}>{r.studentName}</p>
                    <p className={`mt-0.5 flex items-center gap-1.5 text-[10px] min-[360px]:text-[11px] ${muted}`}>
                      {r.roomNumber ? `${r.roomNumber}-xona · ` : ''}
                      <CalendarDays size={11} className="shrink-0" />
                      <span className="truncate">{r.startsOn === r.endsOn ? fmt(r.startsOn) : `${fmt(r.startsOn)} — ${fmt(r.endsOn)}`}</span>
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold min-[360px]:px-2 min-[360px]:text-[10px] ${
                      pending
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                        : upcoming
                          ? 'border-slate-500/30 bg-slate-500/10 text-slate-400'
                          : 'border-sky-500/30 bg-sky-500/10 text-sky-500'
                    }`}
                  >
                    {pending ? 'Dekan ko‘rmoqda' : upcoming ? 'Hali ketmagan' : 'Uyda'}
                  </span>
                </div>

                <p className={`mt-2 flex items-start gap-1.5 text-xs ${muted}`}>
                  <MapPin size={12} className="mt-0.5 shrink-0" />
                  <span className="min-w-0 flex-1 break-words">
                    {LEAVE_KIND_LABELS[r.destinationKind]}: {r.destinationAddress}
                  </span>
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
                  <a
                    href={`tel:${r.contactPhone}`}
                    data-student-button="plain"
                    className="no-shelf inline-flex items-center gap-1.5 text-xs font-bold text-sky-500 hover:underline min-w-0"
                  >
                    <Phone size={12} className="shrink-0" />
                    <span className="truncate">{r.contactName} · {r.contactPhone}</span>
                  </a>
                  {r.locStatus !== 'none' && (
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] min-[360px]:text-[11px] font-semibold ${
                        r.locStatus === 'far' ? 'text-amber-500' : 'text-emerald-500'
                      }`}
                    >
                      {r.locStatus === 'far' ? <ShieldAlert size={12} className="shrink-0" /> : <ShieldCheck size={12} className="shrink-0" />}
                      <span className="truncate">{r.locStatus === 'far' ? 'Joylashuv uzoq' : 'Joylashuv tasdiqlangan'}</span>
                    </span>
                  )}
                </div>

                {r.callResult !== 'none' && (
                  <p
                    className={`mt-1.5 flex items-center gap-1 text-[11px] font-semibold ${
                      r.callResult === 'ok' ? 'text-emerald-500' : 'text-amber-500'
                    }`}
                  >
                    <Check size={12} /> {LEAVE_CALL_LABELS[r.callResult]}
                    {r.callByName ? ` · ${r.callByName}` : ''}
                  </p>
                )}

                {canWrite && !pending && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {CALL_BUTTONS.map((b) => (
                      <button
                        key={b.result}
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => call(r.id, b.result)}
                        data-student-button="plain"
                        className={`no-shelf inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold disabled:opacity-50 ${b.tone} ${
                          r.callResult === b.result ? 'ring-2 ring-offset-1 ring-sky-400' : 'opacity-90'
                        }`}
                      >
                        {busyId === r.id && r.callResult !== b.result ? <Loader2 size={11} className="animate-spin" /> : null}
                        {b.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {canWrite && (
            <p className={`px-1 text-[10px] ${muted}`}>
              Aloqa shaxsiga qo‘ng‘iroq qilib, talaba rostdan o‘sha yerda ekanini so‘rang va natijani belgilang.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
