'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, FileCheck2, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { dekanUI, statusChip } from '@/lib/dekan-ui'
import { directionLabel } from '@/lib/directions'
import { decideCertificate, fetchFacultyCertificates } from '@/features/certificates/client/api'
import {
  CERTIFICATE_PURPOSE_LABELS,
  CERTIFICATE_STATUS_LABELS,
  type CertificateDashboardRow,
} from '@/features/certificates/types'

/** KV-talabalarning ma'lumotnoma so'rovlari — dekan tasdiqlaydi yoki rad etadi. */
export default function KvCertificatePanel({ isLight }: { isLight: boolean }) {
  const ui = dekanUI(isLight)
  const [rows, setRows] = useState<CertificateDashboardRow[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    try {
      setRows(await fetchFacultyCertificates())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "So'rovlarni yuklab bo'lmadi")
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
      await decideCertificate(id, { action, note: action === 'reject' ? reason.trim() : undefined })
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
  const recent = (rows ?? []).filter((r) => r.status !== 'pending').slice(0, 5)

  return (
    <div className={`flex flex-col rounded-2xl border p-4 sm:p-5 ${ui.card}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <h3 className={`flex items-center gap-2 text-sm font-bold ${ui.strong}`}>
          <FileCheck2 size={15} className="text-indigo-500" /> Ma‘lumotnoma so‘rovlari
        </h3>
        {pending.length > 0 && (
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusChip('warning', isLight).chip}`}>
            {pending.length} ta kutilmoqda
          </span>
        )}
      </div>

      {rows === null ? (
        <div className={`flex items-center justify-center gap-2 py-6 text-xs ${ui.muted}`}>
          <Loader2 size={14} className="animate-spin" /> Yuklanmoqda…
        </div>
      ) : pending.length === 0 ? (
        // Fills the card (it is stretched to the map's height next to it) instead of one lost line.
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
          <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl ${ui.accentTileSoft}`}>
            <FileCheck2 size={26} strokeWidth={2} />
          </div>
          <p className={`text-sm font-bold ${ui.strong}`}>Kutilayotgan so‘rov yo‘q</p>
          <p className={`mt-1.5 max-w-xs text-xs leading-relaxed ${ui.muted}`}>
            KV talaba ma‘lumotnoma so‘raganda u shu yerda paydo bo‘ladi. Tasdiqlasangiz, talabaga avtomatik xabar yuboriladi.
          </p>
          <div className={`mt-4 flex flex-wrap justify-center gap-1.5 text-[10px] font-semibold ${ui.muted}`}>
            {(['approved', 'rejected'] as const).map((status) => (
              <span key={status} className={`rounded-full px-2.5 py-1 ${statusChip(status === 'approved' ? 'success' : 'danger', isLight).chip}`}>
                {CERTIFICATE_STATUS_LABELS[status]}: {(rows ?? []).filter((r) => r.status === status).length}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pending.map((r) => (
            <div key={r.id} className={`rounded-xl border p-3 ${ui.inset}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`truncate text-sm font-bold ${ui.strong}`}>{r.studentName}</p>
                  <p className={`text-[11px] ${ui.muted}`}>
                    {[r.course ? `${r.course}-kurs` : null, r.group, directionLabel(r.direction ?? '') || null].filter(Boolean).join(' · ')}
                  </p>
                  <p className={`mt-1 text-xs ${ui.body}`}>
                    {r.purpose === 'boshqa' && r.purposeNote ? r.purposeNote : CERTIFICATE_PURPOSE_LABELS[r.purpose]}
                  </p>
                </div>
                {rejecting !== r.id && (
                  <div data-flat className="flex shrink-0 gap-2">
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
              {rejecting === r.id && (
                <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={300}
                    placeholder="Rad etish sababi"
                    className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs ${ui.input} ${ui.ring}`}
                  />
                  <div data-flat className="flex gap-2">
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

      {recent.length > 0 && (
        <div className={`mt-4 border-t pt-3 ${ui.border}`}>
          <p className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${ui.faint}`}>So‘nggi qarorlar</p>
          <ul className="space-y-1.5">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                <span className={`min-w-0 truncate ${ui.body}`}>{r.studentName}</span>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${statusChip(r.status === 'approved' ? 'success' : 'danger', isLight).chip}`}>
                  {CERTIFICATE_STATUS_LABELS[r.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
