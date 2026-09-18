'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { getAuthHeaders } from '@/lib/auth-session'
import { generateStudentArizaPdf } from '@/lib/student-ariza-pdf'
import type { ArizaComposeInput } from '@/lib/student-ariza-template'

// Renders the signed ariza/tushuntirish PDF inline (blob-URL iframe) instead
// of triggering a download — the dekan/tarbiyachi review list links straight
// here so staff never has to leave the page to read the document.
export default function ArizaPdfViewerModal({
  arizaId,
  studentName,
  isLight,
  onClose,
}: {
  arizaId: string | null
  studentName?: string
  isLight: boolean
  onClose: () => void
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!arizaId) return
    let alive = true
    let createdUrl: string | null = null
    setBlobUrl(null)
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
          // Older free-text applications predate the formal composer: render
          // their stored text as a plain PDF so staff still sees a document
          // instead of an error.
          const { jsPDF } = await import('jspdf')
          const plain = new jsPDF({ unit: 'mm', format: 'a4' })
          plain.setFont('Helvetica', 'normal')
          plain.setFontSize(11)
          plain.text(plain.splitTextToSize(String(doc.text ?? ''), 180), 15, 20)
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

  return (
    <ConfirmModal
      isOpen={Boolean(arizaId)}
      title="Hujjat"
      description={studentName}
      maxWidthClass="max-w-3xl"
      onClose={onClose}
    >
      <div className="flex h-[75vh] w-full flex-col gap-3">
        <div className="min-h-0 flex-1">
          {error && (
            <div className={`flex h-full items-center justify-center text-center text-sm ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>
              {error}
            </div>
          )}
          {!error && !blobUrl && (
            <div className={`flex h-full items-center justify-center gap-2 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <Loader2 size={16} className="animate-spin" /> Yuklanmoqda…
            </div>
          )}
          {blobUrl && (
            <iframe
              src={blobUrl}
              title="Ariza hujjati"
              className={`h-full w-full rounded-xl border ${isLight ? 'border-slate-200' : 'border-white/10'}`}
            />
          )}
        </div>
        {blobUrl && (
          <div className="flex justify-end">
            <a
              href={blobUrl}
              download={`${studentName ?? 'ariza'}.pdf`}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/15 text-slate-300 hover:bg-white/10'}`}
            >
              <Download size={13} /> Yuklab olish
            </a>
          </div>
        )}
      </div>
    </ConfirmModal>
  )
}
