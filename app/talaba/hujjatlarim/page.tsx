'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plane, Home, Plus, Pencil, FileText, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { fetchMyForeignDocs, foreignDocFileUrl } from '@/features/foreign-docs/client/api'
import {
  DOC_STATUS_LABELS,
  DOC_TYPE_LABELS,
  REGISTRATION_BASIS_LABELS,
  type DocType,
  type ForeignDoc,
} from '@/features/foreign-docs/types'
import { bucketTone, countdownLabel } from '@/features/foreign-docs/domain/presentation'
import ForeignDocModal from '@/components/talaba/foreign-docs/ForeignDocModal'

const TONE_TEXT = {
  ok: 'text-emerald-500',
  info: 'text-sky-500',
  warning: 'text-amber-500',
  danger: 'text-rose-500',
} as const

export default function HujjatlarimPage() {
  const isLight = useThemeStore((s) => s.theme) === 'light'
  const [docs, setDocs] = useState<ForeignDoc[] | null>(null)
  const [modal, setModal] = useState<{ type: DocType; doc: ForeignDoc | null } | null>(null)

  const load = useCallback(async () => {
    try {
      setDocs(await fetchMyForeignDocs())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Yuklab bo'lmadi")
      setDocs([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const byType = (type: DocType) =>
      (docs ?? [])
        .filter((d) => d.docType === type)
        .sort((a, b) => b.expiresOn.localeCompare(a.expiresOn))
    return { visa: byType('visa'), registration: byType('registration') }
  }, [docs])

  const openFile = async (id: string) => {
    try {
      const url = await foreignDocFileUrl(id)
      window.open(url, '_blank', 'noopener')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Faylni ochib bo'lmadi")
    }
  }

  const cardCls = isLight ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-white/[0.03]'

  const renderRow = (doc: ForeignDoc) => {
    const tone = bucketTone(doc.bucket)
    const exp = new Date(doc.expiresOn).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'long', year: 'numeric' })
    return (
      <div key={doc.id} className={`rounded-2xl border p-4 ${cardCls}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-sm font-black ${TONE_TEXT[tone]}`}>{countdownLabel(doc.daysLeft)}</p>
            <p className={`mt-0.5 text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{exp}gacha</p>
          </div>
          <button
            type="button"
            onClick={() => setModal({ type: doc.docType, doc })}
            data-student-button="plain"
            className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider ${
              isLight ? 'border-slate-300 bg-white text-slate-600' : 'border-white/10 bg-slate-900 text-slate-300'
            }`}
          >
            <Pencil size={11} /> Tahrirlash
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className={`rounded-md border px-1.5 py-0.5 font-bold ${isLight ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-white/10 bg-white/5 text-slate-300'}`}>
            {DOC_STATUS_LABELS[doc.status]}
          </span>
          {doc.number && (
            <span className={`rounded-md px-1.5 py-0.5 font-semibold ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-slate-300'}`}>№ {doc.number}</span>
          )}
          {doc.registrationBasis && (
            <span className={`rounded-md px-1.5 py-0.5 font-semibold ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-slate-300'}`}>
              {REGISTRATION_BASIS_LABELS[doc.registrationBasis]}
            </span>
          )}
          {doc.verifiedAt && (
            <span className="inline-flex items-center gap-0.5 font-bold text-emerald-500">
              <ShieldCheck size={11} /> Tasdiqlangan
            </span>
          )}
          {doc.hasFile && (
            <button type="button" onClick={() => openFile(doc.id)} data-student-button="plain" className="inline-flex items-center gap-1 font-bold text-sky-500">
              <FileText size={11} /> Faylni ochish
            </button>
          )}
        </div>
        {doc.address && <p className={`mt-2 text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{doc.address}</p>}
        {doc.note && <p className={`mt-1 text-[11px] italic ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{doc.note}</p>}
      </div>
    )
  }

  const section = (type: DocType, rows: ForeignDoc[]) => {
    const Icon = type === 'visa' ? Plane : Home
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className={`flex items-center gap-2 text-sm font-black uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
            <Icon size={16} className={isLight ? 'text-blue-500' : 'text-blue-300'} />
            {DOC_TYPE_LABELS[type]}
          </h2>
          <button
            type="button"
            onClick={() => setModal({ type, doc: null })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white"
          >
            <Plus size={12} /> Qo&apos;shish
          </button>
        </div>
        {rows.length === 0 ? (
          <p className={`rounded-2xl border border-dashed p-4 text-center text-xs ${isLight ? 'border-slate-300 text-slate-500' : 'border-white/15 text-slate-400'}`}>
            Hali yozuv yo&apos;q
          </p>
        ) : (
          rows.map(renderRow)
        )}
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/talaba/dashboard"
        className={`inline-flex items-center gap-1.5 text-xs font-bold ${isLight ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400 hover:text-slate-200'}`}
        data-student-button="plain"
      >
        <ArrowLeft size={14} /> Asosiy sahifa
      </Link>

      <div>
        <h1 className={`text-xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>Hujjatlarim</h1>
        <p className={`mt-1 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Viza va yashash joyida ro&apos;yxatga qo&apos;yish (propiska) muddatlari. Muddatga 30, 15, 10, 5, 3 va 0 kun qolganda Telegram, push va email orqali eslatma olasiz.
        </p>
      </div>

      {docs === null ? (
        <div className={`flex items-center justify-center gap-2 py-16 text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          <Loader2 size={16} className="animate-spin" /> Yuklanmoqda…
        </div>
      ) : (
        <>
          {section('visa', grouped.visa)}
          {section('registration', grouped.registration)}
        </>
      )}

      {modal && (
        <ForeignDocModal
          open
          isLight={isLight}
          docType={modal.type}
          existing={modal.doc}
          onClose={() => setModal(null)}
          onSaved={() => void load()}
        />
      )}
    </div>
  )
}
