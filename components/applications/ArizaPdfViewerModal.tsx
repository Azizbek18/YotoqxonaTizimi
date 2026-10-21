'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2, Check, X, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { getAuthHeaders } from '@/lib/auth-session'
import { generateStudentArizaPdf } from '@/lib/student-ariza-pdf'
import type { ArizaComposeInput } from '@/lib/student-ariza-template'

// Renders the signed ariza/tushuntirish PDF inline (blob-URL iframe) instead
// of triggering a download — the dekan/tarbiyachi review list links straight
// here so staff never has to leave the page to read the document.
// Now also includes direct 1-tap decision buttons (Tasdiqlash / Rad etish)
// right in the review footer so staff doesn't have to hunt in the table!
export default function ArizaPdfViewerModal({
  arizaId,
  studentName,
  status = 'pending',
  roomNumber,
  createdAt,
  tushuntirishCount = 0,
  canModerate = true,
  isLight,
  isDeciding = false,
  onApprove,
  onReject,
  onClose,
  currentIndex,
  totalCount,
  onPrev,
  onNext,
}: {
  arizaId: string | null
  studentName?: string
  status?: string
  roomNumber?: string | null
  createdAt?: string | null
  tushuntirishCount?: number
  canModerate?: boolean
  isLight: boolean
  isDeciding?: boolean
  onApprove?: (id: string) => Promise<void> | void
  onReject?: (id: string) => Promise<void> | void
  onClose: () => void
  currentIndex?: number
  totalCount?: number
  onPrev?: () => void
  onNext?: () => void
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [plainText, setPlainText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!arizaId) return
    let alive = true
    let createdUrl: string | null = null
    setBlobUrl(null)
    setPlainText(null)
    setError(null)

    ;(async () => {
      try {
        const res = await fetch(`/api/staff/ariza-signature?arizaId=${encodeURIComponent(arizaId)}&document=1`, {
          headers: await getAuthHeaders(), cache: 'no-store',
        })
        const doc = await res.json()
        if (!res.ok) throw new Error(doc.error || 'Hujjatni yuklab bo‘lmadi')

        const f = doc.formal as (ArizaComposeInput & Record<string, unknown>) | null
        if (!f) {
          const rawText = String(doc.text ?? '')
          setPlainText(rawText)
          const { jsPDF } = await import('jspdf')
          const plain = new jsPDF({ unit: 'mm', format: 'a4' })
          plain.setFont('Helvetica', 'normal')
          plain.setFontSize(11)
          plain.text(plain.splitTextToSize(rawText, 180), 15, 20)
          const plainUrl = plain.output('bloburl') as unknown as string
          if (!alive) {
            URL.revokeObjectURL(plainUrl)
            return
          }
          createdUrl = plainUrl
          setBlobUrl(plainUrl)
          return
        }
        const url = await generateStudentArizaPdf({
          kind: (doc.type as 'ariza' | 'tushuntirish') ?? f.kind,
          recipient: f.recipient,
          fullName: String(f.fullName ?? ''),
          facultyLabel: String(f.facultyLabel ?? ''),
          course: (f.course as string | number) ?? '',
          ttjNumber: String(f.ttjNumber ?? ''),
          room: String(f.room ?? ''),
          incidentText: String(f.incidentText ?? ''),
          dekanName: (f.dekanName as string | null) ?? null,
          signatureImage: doc.signatureImage,
          signedAt: doc.signedAt,
          verifyCode: doc.verifyCode,
        }, { mode: 'blob' })

        if (typeof url !== 'string') {
          if (alive) setError('Hujjatni yuklab bo‘lmadi')
          return
        }
        if (!alive) {
          URL.revokeObjectURL(url)
          return
        }
        createdUrl = url
        setBlobUrl(url)
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Hujjatni yuklab bo‘lmadi')
      }
    })()

    return () => {
      alive = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [arizaId])

  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null

  const isPending = status === 'pending'
  const isApproved = status === 'approved'
  const isRejected = status === 'rejected'

  return (
    <ConfirmModal
      isOpen={Boolean(arizaId)}
      title="Hujjatni ko‘rib chiqish"
      description={studentName}
      maxWidthClass="max-w-3xl"
      onClose={onClose}
    >
      <div className="flex h-[74vh] sm:h-[70vh] w-full flex-col gap-3">
        {/* Top bar with Navigation & Quick info */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            {isPending && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 shadow-2xs dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                Kutilmoqda
              </span>
            )}
            {isApproved && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 shadow-2xs dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Check size={12} strokeWidth={2.8} className="text-emerald-600 dark:text-emerald-400" />
                Tasdiqlangan
              </span>
            )}
            {isRejected && (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 shadow-2xs dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
                <X size={12} strokeWidth={2.8} className="text-rose-600 dark:text-rose-400" />
                Rad etilgan
              </span>
            )}
            {roomNumber && (
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                #{roomNumber}-xona
              </span>
            )}
            {formattedDate && (
              <span className="text-xs text-slate-400">
                • {formattedDate}
              </span>
            )}
            {tushuntirishCount >= 3 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300">
                <AlertTriangle size={11} className="text-amber-600" />
                {tushuntirishCount} marta tushuntirish
              </span>
            )}
          </div>

          {/* Sequential Navigator if queue available */}
          {totalCount !== undefined && totalCount > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400 mr-1">
                {(currentIndex ?? 0) + 1} / {totalCount}
              </span>
              <button
                type="button"
                onClick={onPrev}
                disabled={!onPrev}
                className="no-shelf inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                title="Oldingi ariza"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={!onNext}
                className="no-shelf inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                title="Keyingi ariza"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Document Viewer Body */}
        <div className="min-h-0 flex-1">
          {error && (
            <div className={`flex h-full items-center justify-center text-center text-sm ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>
              {error}
            </div>
          )}
          {!error && !blobUrl && !plainText && (
            <div className={`flex h-full items-center justify-center gap-2 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <Loader2 size={16} className="animate-spin" /> Hujjat yuklanmoqda…
            </div>
          )}
          {plainText != null ? (
            <div className={`h-full overflow-y-auto whitespace-pre-wrap rounded-xl border p-5 text-sm leading-relaxed ${isLight ? 'border-slate-200 bg-white text-slate-800' : 'border-white/10 bg-slate-900 text-slate-100'}`}>
              {plainText}
            </div>
          ) : blobUrl && (
            <iframe
              src={`${blobUrl}#toolbar=0&navpanes=0&view=FitH`}
              title="Ariza hujjati"
              className={`h-full w-full rounded-xl border ${isLight ? 'border-slate-200' : 'border-white/10'}`}
            />
          )}
        </div>

        {/* Bottom Interactive Decision Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            {blobUrl && (
              <a
                href={blobUrl}
                download={`${studentName ?? 'ariza'}.pdf`}
                className={`no-shelf inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all shadow-2xs active:scale-95 ${
                  isLight
                    ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <Download size={13} />
                <span>Yuklab olish</span>
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isPending && canModerate && onReject && arizaId && (
              <button
                type="button"
                disabled={isDeciding}
                onClick={() => onReject(arizaId)}
                className="no-shelf inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 transition-all hover:bg-rose-100 active:scale-95 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
              >
                <X size={14} strokeWidth={2.4} />
                <span>Rad etish</span>
              </button>
            )}

            {isPending && canModerate && onApprove && arizaId && (
              <button
                type="button"
                disabled={isDeciding}
                onClick={() => onApprove(arizaId)}
                className="no-shelf inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 px-5 py-2 text-xs font-extrabold text-white shadow-md shadow-emerald-600/25 transition-all hover:from-emerald-500 hover:to-teal-500 active:scale-95 disabled:opacity-50"
              >
                {isDeciding ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Check size={16} strokeWidth={2.8} />
                )}
                <span>Tasdiqlash</span>
              </button>
            )}

            {!isPending && (
              <span className="text-xs font-medium text-slate-400 italic px-2">
                Qaror allaqachon qabul qilingan
              </span>
            )}
          </div>
        </div>
      </div>
    </ConfirmModal>
  )
}
