'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, ShieldQuestion, ChevronDown, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAuthHeaders } from '@/lib/auth-session'
import { generateStudentArizaPdf } from '@/lib/student-ariza-pdf'
import type { ArizaComposeInput } from '@/lib/student-ariza-template'

type StaffSignature =
  | { success: true; signed: false; arizaStatus: string | null }
  | {
      success: true
      signed: true
      signature: {
        verifyCode: string
        signedAt: string
        typedName: string
        contentHash: string
        clientIp: string | null
        userAgent: string | null
        hasImage: boolean
        valid: boolean
        hashOk: boolean
        signatureOk: boolean
      }
    }

// Compact "is this application electronically signed?" indicator for the
// dekan / tarbiyachi review lists. Lazily fetched per card.
export default function ArizaSignatureBadge({ arizaId, isLight }: { arizaId: string; isLight: boolean }) {
  const [data, setData] = useState<StaffSignature | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/staff/ariza-signature?arizaId=${encodeURIComponent(arizaId)}`, {
          headers: await getAuthHeaders(), cache: 'no-store',
        })
        const json = await res.json()
        if (alive && res.ok) setData(json)
      } catch { /* silent */ }
    })()
    return () => { alive = false }
  }, [arizaId])

  if (!data) return null

  if (!data.signed) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'}`}>
        <ShieldQuestion size={11} /> Imzosiz
      </span>
    )
  }

  const s = data.signature
  const when = new Date(s.signedAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const bad = !s.valid

  const downloadDoc = async () => {
    try {
      const res = await fetch(`/api/staff/ariza-signature?arizaId=${encodeURIComponent(arizaId)}&document=1`, {
        headers: await getAuthHeaders(), cache: 'no-store',
      })
      const doc = await res.json()
      if (!res.ok) throw new Error(doc.error || 'Xatolik')
      const f = doc.formal as (ArizaComposeInput & Record<string, unknown>) | null
      if (f) {
        await generateStudentArizaPdf({
          kind: (doc.type as 'ariza' | 'tushuntirish') ?? f.kind,
          recipient: f.recipient,
          fullName: String(f.fullName ?? ''), facultyLabel: String(f.facultyLabel ?? ''),
          course: (f.course as string | number) ?? '', ttjNumber: String(f.ttjNumber ?? ''),
          room: String(f.room ?? ''), incidentText: String(f.incidentText ?? ''),
          dekanName: (f.dekanName as string | null) ?? null,
          signatureImage: doc.signatureImage, signedAt: doc.signedAt, verifyCode: doc.verifyCode,
        })
      } else {
        const { jsPDF } = await import('jspdf')
        const d = new jsPDF(); d.setFont('Helvetica', 'normal'); d.setFontSize(11)
        d.text(d.splitTextToSize(doc.text || '', 180), 15, 20); d.save(`ariza_${arizaId}.pdf`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hujjatni yuklab bo‘lmadi')
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
          bad
            ? (isLight ? 'bg-rose-100 text-rose-700' : 'bg-rose-500/15 text-rose-300')
            : (isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-300')
        }`}
      >
        {bad ? <ShieldAlert size={11} /> : <ShieldCheck size={11} />}
        {bad ? 'Imzo buzilgan' : `Imzolangan · ${when}`}
        <ChevronDown size={10} className={open ? 'rotate-180 transition' : 'transition'} />
      </button>
      {open && (
        <span className={`block space-y-2 rounded-lg border p-2 ${isLight ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-white/10 bg-white/5 text-slate-400'}`}>
          <span className="block font-mono text-[10px] leading-relaxed">
            Kod: {s.verifyCode}<br />
            Yozgan F.I.Sh: {s.typedName}<br />
            Hash: {s.contentHash.slice(0, 24)}… {s.hashOk ? '✓' : '✗ MOS EMAS'}<br />
            Imzo: {s.signatureOk ? '✓ haqiqiy' : '✗ noto‘g‘ri'}{s.hasImage ? ' · qo‘lda imzo bor' : ''}<br />
            IP: {s.clientIp ?? '—'}<br />
            Qurilma: {(s.userAgent ?? '—').slice(0, 60)}
          </span>
          <button
            type="button"
            onClick={downloadDoc}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/15 text-slate-300 hover:bg-white/10'}`}
          >
            <Download size={11} /> Hujjat (PDF)
          </button>
        </span>
      )}
    </span>
  )
}
