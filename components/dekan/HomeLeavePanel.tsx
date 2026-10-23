'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CalendarDays, Check, Home, Loader2, MapPin, MessageSquareText, Phone, ShieldAlert, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { dekanUI } from '@/lib/dekan-ui'
import { decideLeave, fetchFacultyLeaves } from '@/features/home-leave/client/api'
import { LEAVE_KIND_LABELS, type HomeLeaveStaffRow } from '@/features/home-leave/types'

function fmt(d: string): string {
  const [, m, day] = d.split('-')
  return `${day}.${m}`
}

/** Inclusive day count of a leave (23.10 — 25.10 → 3). */
function leaveDays(startsOn: string, endsOn: string): number {
  return Math.round((Date.parse(endsOn) - Date.parse(startsOn)) / 86_400_000) + 1
}

/** +998914515260 → +998 91 451 52 60; anything else is shown as typed. */
function fmtPhone(phone: string): string {
  const m = phone.replace(/[^\d+]/g, '').match(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/)
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone
}

/**
 * Uyga ketish arizalari: 7 kundan uzoq yoki oldin shubhali bo'lgan talabaning
 * arizasini dekan tasdiqlaydi. Qolganlari avtomatik kuchga kiradi.
 */
export default function HomeLeavePanel({
  isLight,
  onSummary,
}: {
  isLight: boolean
  /** Reports what needs the dekan (pending decisions, overdue returns) — e.g. for a tab badge. */
  onSummary?: (summary: { pending: number; active: number; overdue: number }) => void
}) {
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

  useEffect(() => {
    if (rows === null) return
    onSummary?.({
      pending: rows.filter((r) => r.status === 'pending').length,
      active: rows.filter((r) => r.status === 'active').length,
      overdue: overdue.length,
    })
  }, [rows, overdue, onSummary])

  if (rows === null || (pending.length === 0 && active.length === 0 && overdue.length === 0)) return null

  return (
    <div className={`no-shelf rounded-2xl border p-4 sm:p-5 ${ui.card}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
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
          {pending.map((r) => {
            const days = leaveDays(r.startsOn, r.endsOn)
            const isBusy = busyId === r.id
            const row = 'flex items-start gap-2 text-xs leading-snug'
            const icon = `mt-0.5 shrink-0 ${ui.faint}`
            return (
            // One flat card: the name, then plain icon rows (no nested boxes, no
            // avatar eating the width), the decision as two buttons underneath.
            <div key={r.id} className={`no-shelf rounded-2xl border p-3.5 ${ui.inset}`}>
              <p className={`break-words text-sm font-bold leading-snug ${ui.strong}`}>{r.studentName}</p>

              <div className="mt-2 space-y-1.5">
                <p className={`${row} ${ui.body}`}>
                  <CalendarDays size={13} className={icon} />
                  <span className="tabular-nums">
                    <b className="font-semibold">{fmt(r.startsOn)} — {fmt(r.endsOn)}</b>
                    <span className={ui.muted}> · {days} kun{r.roomNumber ? ` · ${r.roomNumber}-xona` : ''}</span>
                  </span>
                </p>
                <p className={`${row} ${ui.body}`}>
                  <MapPin size={13} className={icon} />
                  <span className="min-w-0 break-words">
                    <span className={ui.muted}>{LEAVE_KIND_LABELS[r.destinationKind]}:</span> {r.destinationAddress}
                  </span>
                </p>
                <p className={row}>
                  <Phone size={13} className={icon} />
                  <span className={`min-w-0 ${ui.body}`}>
                    {r.contactName} ·{' '}
                    <a href={`tel:${r.contactPhone}`} className="whitespace-nowrap font-bold tabular-nums text-indigo-600 hover:underline dark:text-indigo-400">
                      {fmtPhone(r.contactPhone)}
                    </a>
                  </span>
                </p>
                {r.reason && (
                  <p className={`${row} ${ui.muted}`}>
                    <MessageSquareText size={13} className={icon} />
                    <span className="min-w-0 break-words">{r.reason}</span>
                  </p>
                )}
                {r.locStatus === 'far' && (
                  <p className={`${row} font-semibold ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
                    <ShieldAlert size={13} className="mt-0.5 shrink-0" />
                    Joylashuv ko‘rsatilgan manzildan uzoq
                  </p>
                )}
              </div>

              {/* data-flat: bg-emerald-600 is not in the light-mode retrofit's white-text list */}
              {rejecting === r.id ? (
                <div data-flat className="mt-3 space-y-2">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={300}
                    autoFocus
                    placeholder="Rad etish sababi (talabaga yuboriladi)"
                    className={`h-9 w-full rounded-lg border px-3 text-xs ${ui.input} ${ui.ring}`}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRejecting(null)}
                      className={`no-shelf h-9 cursor-pointer rounded-lg border text-xs font-bold ${ui.btnGhost}`}
                    >
                      Bekor
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => decide(r.id, 'reject')}
                      className="no-shelf inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-rose-600 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Rad etish
                    </button>
                  </div>
                </div>
              ) : (
                <div data-flat className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => { setRejecting(r.id); setReason('') }}
                    className={`no-shelf inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-xs font-bold ${ui.btnGhost}`}
                  >
                    <X size={13} /> Rad etish
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => decide(r.id, 'approve')}
                    className="no-shelf inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={2.6} />} Tasdiqlash
                  </button>
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
