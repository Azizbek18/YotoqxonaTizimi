'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CalendarDays, Check, Home, Loader2, MapPin, Phone, ShieldAlert, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { dekanUI } from '@/lib/dekan-ui'
import { decideLeave, fetchFacultyLeaves } from '@/features/home-leave/client/api'
import { LEAVE_KIND_LABELS, type HomeLeaveStaffRow } from '@/features/home-leave/types'

function fmt(d: string): string {
  const [, m, day] = d.split('-')
  return `${day}.${m}`
}

/**
 * Uyga ketish arizalari: 7 kundan uzoq yoki oldin shubhali bo'lgan talabaning
 * arizasini dekan tasdiqlaydi. Qolganlari avtomatik kuchga kiradi.
 */
export default function HomeLeavePanel({ isLight }: { isLight: boolean }) {
  const ui = dekanUI(isLight)
  const [rows, setRows] = useState<HomeLeaveStaffRow[] | null>(null)
  const [overdue, setOverdue] = useState<HomeLeaveStaffRow[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await fetchFacultyLeaves()
      setRows(data.leaves)
      setOverdue(data.overdue)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Arizalarni yuklab bo'lmadi")
      setRows([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const decide = async (id: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && reason.trim().length < 3) {
      toast.error('Rad etish sababini yozing')
      return
    }
    setBusyId(id)
    try {
      await decideLeave(id, { action, note: action === 'reject' ? reason.trim() : undefined })
      toast.success(action === 'approve' ? 'Tasdiqlandi — talabaga xabar yuborildi' : 'Rad etildi')
      setRejecting(null)
      setReason('')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Saqlab bo'lmadi")
    } finally {
      setBusyId(null)
    }
  }

  const pending = (rows ?? []).filter((r) => r.status === 'pending')
  const active = (rows ?? []).filter((r) => r.status === 'active')
  if (rows === null || (pending.length === 0 && active.length === 0 && overdue.length === 0)) return null

  return (
    <div className={`no-shelf rounded-2xl border p-4 sm:p-5 ${ui.card}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className={`flex items-center gap-2 text-sm font-bold ${ui.strong}`}>
          <Home size={15} className="text-sky-500" /> Uyga ketish arizalari
        </h3>
        <span className={`text-[11px] ${ui.muted}`}>
          {active.length} ta faol{pending.length > 0 ? ` · ${pending.length} ta kutilmoqda` : ''}
        </span>
      </div>

      {overdue.length > 0 && (
        <div className={`no-shelf mb-3 rounded-xl border p-3 ${isLight ? 'border-rose-200 bg-rose-50' : 'border-rose-500/30 bg-rose-500/10'}`}>
          <p className={`mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${isLight ? 'text-rose-700' : 'text-rose-300'}`}>
            <AlertTriangle size={13} /> Qaytmaganlar ({overdue.length})
          </p>
          <div className="space-y-2">
            {overdue.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <p className={`truncate text-sm font-bold ${ui.strong}`}>{r.studentName}</p>
                  <p className={`text-[11px] ${ui.muted}`}>
                    Muddati {fmt(r.endsOn)} da tugagan{r.roomNumber ? ` · ${r.roomNumber}-xona` : ''}
                  </p>
                </div>
                <a href={`tel:${r.contactPhone}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-500">
                  <Phone size={12} /> {r.contactName} · {r.contactPhone}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 ? (
        <p className={`text-xs ${ui.muted}`}>
          Tasdiq kutayotgan ariza yo‘q. 7 kundan qisqa arizalar avtomatik kuchga kiradi, tarbiyachi va sardor ularni ko‘radi.
        </p>
      ) : (
        <div className="space-y-2.5">
          {pending.map((r) => (
            <div key={r.id} className={`no-shelf rounded-xl border p-3 ${ui.inset}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`truncate text-sm font-bold ${ui.strong}`}>{r.studentName}</p>
                  <p className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${ui.muted}`}>
                    <CalendarDays size={11} /> {fmt(r.startsOn)} — {fmt(r.endsOn)}
                  </p>
                </div>
                {rejecting !== r.id && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => decide(r.id, 'approve')}
                      className="no-shelf inline-flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                    >
                      {busyId === r.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Tasdiqlash
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => { setRejecting(r.id); setReason('') }}
                      className={`no-shelf inline-flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-1.5 text-[11px] font-bold ${ui.btnDanger}`}
                    >
                      <X size={12} /> Rad etish
                    </button>
                  </div>
                )}
              </div>
              <p className={`mt-2 flex items-start gap-1.5 text-xs ${ui.body}`}>
                <MapPin size={12} className="mt-0.5 shrink-0" />
                {LEAVE_KIND_LABELS[r.destinationKind]}: {r.destinationAddress}
              </p>
              <a href={`tel:${r.contactPhone}`} className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-sky-500">
                <Phone size={12} /> {r.contactName} · {r.contactPhone}
              </a>
              {r.locStatus === 'far' && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-500">
                  <ShieldAlert size={12} /> Joylashuv ko‘rsatilgan manzildan uzoq
                </p>
              )}
              {rejecting === r.id && (
                <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={300}
                    placeholder="Rad etish sababi"
                    className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs ${ui.input} ${ui.ring}`}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => decide(r.id, 'reject')}
                      className="no-shelf cursor-pointer rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
                    >
                      Rad etish
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejecting(null)}
                      className={`no-shelf cursor-pointer rounded-lg border px-3 py-2 text-[11px] font-bold ${ui.btnGhost}`}
                    >
                      Bekor
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
