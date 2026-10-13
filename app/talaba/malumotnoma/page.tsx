'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, FileCheck2, Loader2, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import CustomSelect from '@/components/ui/CustomSelect'
import {
  fetchCertificateDocument,
  fetchMyCertificates,
  requestCertificate,
} from '@/features/certificates/client/api'
import {
  CERTIFICATE_PURPOSES,
  CERTIFICATE_PURPOSE_LABELS,
  CERTIFICATE_STATUS_LABELS,
  type CertificatePurpose,
  type CertificateRequest,
} from '@/features/certificates/types'

const STATUS_CLASS = {
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/25',
  approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25',
  rejected: 'bg-rose-500/10 text-rose-500 border-rose-500/25',
} as const

export default function MalumotnomaPage() {
  const isLight = useThemeStore((s) => s.theme) === 'light'
  const [items, setItems] = useState<CertificateRequest[] | null>(null)
  const [purpose, setPurpose] = useState<CertificatePurpose | ''>('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setItems(await fetchMyCertificates())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Yuklab bo'lmadi")
      setItems([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async () => {
    if (!purpose || sending) return
    if (purpose === 'boshqa' && note.trim().length < 3) {
      toast.error('Maqsadni qisqacha yozing')
      return
    }
    setSending(true)
    try {
      await requestCertificate({ purpose, purposeNote: note.trim() || undefined })
      toast.success("So'rov dekanga yuborildi")
      setPurpose('')
      setNote('')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Yuborib bo'lmadi")
    } finally {
      setSending(false)
    }
  }

  const download = async (id: string) => {
    setDownloading(id)
    try {
      const [{ downloadCertificatePdf }, cert] = await Promise.all([
        import('@/lib/certificate-pdf'),
        fetchCertificateDocument(id),
      ])
      await downloadCertificatePdf(cert)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF ni yuklab bo'lmadi")
    } finally {
      setDownloading(null)
    }
  }

  const card = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/[0.03]'
  const strong = isLight ? 'text-slate-900' : 'text-white'
  const muted = isLight ? 'text-slate-500' : 'text-slate-400'
  const field = isLight
    ? 'bg-slate-50 border-slate-300 text-slate-900'
    : 'bg-slate-950 border-white/10 text-white'

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/talaba/dashboard"
        data-student-button="plain"
        className={`inline-flex items-center gap-1.5 text-xs font-bold ${muted}`}
      >
        <ArrowLeft size={14} /> Asosiy sahifa
      </Link>

      <div>
        <h1 className={`text-xl font-extrabold tracking-tight ${strong}`}>Ma‘lumotnoma</h1>
        <p className={`mt-1 text-xs ${muted}`}>
          Talabalik ma‘lumotnomasi kerak bo‘lsa, so‘rov yuboring. Dekan tasdiqlagach PDF shu yerda paydo bo‘ladi.
        </p>
      </div>

      <div className={`space-y-3 rounded-2xl border p-4 ${card}`}>
        <h2 className={`text-sm font-bold ${strong}`}>Yangi so‘rov</h2>
        <CustomSelect
          value={purpose}
          onChange={(v) => setPurpose(v as CertificatePurpose)}
          placeholder="Nima uchun kerak?"
          options={CERTIFICATE_PURPOSES.map((p) => ({ value: p, label: CERTIFICATE_PURPOSE_LABELS[p] }))}
          className={`w-full rounded-xl border px-4 py-2.5 text-sm ${field}`}
        />
        {purpose === 'boshqa' && (
          <input
            type="text"
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Qisqacha yozing"
            className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none ${field}`}
          />
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!purpose || sending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-bold text-white disabled:opacity-40"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          So‘rov yuborish
        </button>
      </div>

      <div className="space-y-3">
        <h2 className={`text-sm font-bold ${strong}`}>So‘rovlarim</h2>
        {items === null ? (
          <div className={`flex items-center justify-center gap-2 py-10 text-sm ${muted}`}>
            <Loader2 size={16} className="animate-spin" /> Yuklanmoqda…
          </div>
        ) : items.length === 0 ? (
          <p className={`rounded-2xl border border-dashed p-5 text-center text-xs ${isLight ? 'border-slate-300' : 'border-white/15'} ${muted}`}>
            Hali so‘rov yuborilmagan
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id} className={`rounded-2xl border p-4 ${card}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-sm font-bold ${strong}`}>
                    {item.purpose === 'boshqa' && item.purposeNote ? item.purposeNote : CERTIFICATE_PURPOSE_LABELS[item.purpose]}
                  </p>
                  <p className={`mt-0.5 text-[11px] ${muted}`}>
                    {new Date(item.createdAt).toLocaleDateString('uz-UZ')}
                    {item.number ? ` · № ${item.number}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[item.status]}`}>
                  {CERTIFICATE_STATUS_LABELS[item.status]}
                </span>
              </div>
              {item.status === 'rejected' && item.decisionNote && (
                <p className="mt-2 text-xs text-rose-500">Sabab: {item.decisionNote}</p>
              )}
              {item.status === 'approved' && (
                <button
                  type="button"
                  onClick={() => download(item.id)}
                  disabled={downloading === item.id}
                  className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white disabled:opacity-50"
                >
                  {downloading === item.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  PDF yuklab olish
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <p className={`flex items-start gap-1.5 px-1 text-[11px] ${muted}`}>
        <FileCheck2 size={13} className="mt-0.5 shrink-0" />
        Ma‘lumotnoma dekan tasdig‘i bilan shakllanadi va raqamga ega — kerak bo‘lsa dekanatda tekshiriladi.
      </p>
    </div>
  )
}
