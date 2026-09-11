'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plane, Home, Plus, Pencil, ShieldCheck, AlertTriangle, Loader2, ChevronRight } from 'lucide-react'
import { fetchMyForeignDocs } from '@/features/foreign-docs/client/api'
import { DOC_STATUS_LABELS, type DocType, type ForeignDoc } from '@/features/foreign-docs/types'
import { bucketTone, countdownLabel, ringProgress } from '@/features/foreign-docs/domain/presentation'
import ForeignDocModal from './ForeignDocModal'

type Props = { isLight: boolean; mode: 'foreign' | 'registration' }

const TONE_CLASSES = {
  ok: { ring: '#10b981', text: 'text-emerald-500', chip: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25' },
  info: { ring: '#0ea5e9', text: 'text-sky-500', chip: 'bg-sky-500/10 text-sky-500 border-sky-500/25' },
  warning: { ring: '#f59e0b', text: 'text-amber-500', chip: 'bg-amber-500/10 text-amber-500 border-amber-500/25' },
  danger: { ring: '#f43f5e', text: 'text-rose-500', chip: 'bg-rose-500/10 text-rose-500 border-rose-500/25' },
} as const

function CountdownRing({ days, isLight }: { days: number; isLight: boolean }) {
  const tone = bucketTone(days < 0 ? 'expired' : days <= 3 ? 'critical' : days <= 10 ? 'warning' : days <= 30 ? 'soon' : 'ok')
  const color = TONE_CLASSES[tone].ring
  const r = 34
  const c = 2 * Math.PI * r
  const progress = ringProgress(days)
  return (
    <div className="relative shrink-0" style={{ width: 84, height: 84 }}>
      <svg width={84} height={84} className="-rotate-90">
        <circle cx={42} cy={42} r={r} fill="none" strokeWidth={7} stroke={isLight ? '#e2e8f0' : '#1e293b'} />
        <motion.circle
          cx={42}
          cy={42}
          r={r}
          fill="none"
          strokeWidth={7}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - progress) }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-black leading-none ${isLight ? 'text-slate-900' : 'text-white'}`}>
          {days < 0 ? Math.abs(days) : days}
        </span>
        <span className={`text-[8px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          {days < 0 ? 'kun o‘tdi' : 'kun'}
        </span>
      </div>
    </div>
  )
}

function DocPanel({
  isLight,
  docType,
  doc,
  onEdit,
  onAdd,
}: {
  isLight: boolean
  docType: DocType
  doc: ForeignDoc | null
  onEdit: () => void
  onAdd: () => void
}) {
  const isVisa = docType === 'visa'
  const Icon = isVisa ? Plane : Home
  const label = isVisa ? 'Viza' : 'Propiska'

  if (!doc) {
    return (
      <button
        type="button"
        onClick={onAdd}
        data-student-button="plain"
        className={`flex w-full items-center gap-3 rounded-2xl border border-dashed p-4 text-left transition-colors ${
          isLight ? 'border-slate-300 bg-slate-50/60 hover:bg-slate-100' : 'border-white/15 bg-white/[0.03] hover:bg-white/[0.06]'
        }`}
      >
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${isLight ? 'bg-blue-50 text-blue-500' : 'bg-blue-500/15 text-blue-300'}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{label} ma&apos;lumotini kiriting</p>
          <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Muddat va skan-fayl — eslatmalar shu asosida yuboriladi</p>
        </div>
        <Plus size={16} className={`ml-auto shrink-0 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
      </button>
    )
  }

  const tone = bucketTone(doc.bucket)
  const t = TONE_CLASSES[tone]
  const expDate = new Date(doc.expiresOn).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className={`rounded-2xl border p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-white/[0.03]'}`}>
      <div className="flex items-start gap-4">
        <CountdownRing days={doc.daysLeft} isLight={isLight} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon size={14} className={isLight ? 'text-blue-500' : 'text-blue-300'} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{label}</span>
            {doc.verifiedAt && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-500">
                <ShieldCheck size={10} /> Tasdiqlangan
              </span>
            )}
          </div>
          <p className={`mt-1 text-sm font-black leading-tight ${t.text}`}>{countdownLabel(doc.daysLeft)}</p>
          <p className={`mt-0.5 text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            {expDate}gача amal qiladi
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${t.chip}`}>{DOC_STATUS_LABELS[doc.status]}</span>
            {doc.number && (
              <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-slate-300'}`}>
                № {doc.number}
              </span>
            )}
            <button
              type="button"
              onClick={onEdit}
              data-student-button="plain"
              className={`ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-wider transition-colors ${
                isLight ? 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50' : 'border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Pencil size={10} /> Yangilash
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Dashboarddagi hujjat muddati kartasi. `mode='foreign'` — chet ellik
 * talaba, viza + propiska ikkalasi. `mode='registration'` — boshqa
 * viloyatdan kelgan O'zbekiston fuqarosi, faqat propiska (viza paneli
 * ko'rsatilmaydi). O'zi ma'lumot yuklaydi; kim ko'rishi kerakligini
 * chaqiruvchi hal qiladi (features/foreign-docs/domain/eligibility.ts).
 */
export default function ForeignDocsCard({ isLight, mode }: Props) {
  const [docs, setDocs] = useState<ForeignDoc[] | null>(null)
  const [modal, setModal] = useState<{ type: DocType; doc: ForeignDoc | null } | null>(null)

  const load = useCallback(async () => {
    try {
      setDocs(await fetchMyForeignDocs())
    } catch {
      setDocs([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const current = useMemo(() => {
    const pick = (type: DocType) =>
      (docs ?? [])
        .filter((d) => d.docType === type && d.status !== 'cancelled')
        .sort((a, b) => b.expiresOn.localeCompare(a.expiresOn))[0] ?? null
    return { visa: pick('visa'), registration: pick('registration') }
  }, [docs])

  const worst = useMemo(() => {
    const active = [current.visa, current.registration].filter(Boolean) as ForeignDoc[]
    if (active.length === 0) return null
    return active.reduce((a, b) => (a.daysLeft <= b.daysLeft ? a : b))
  }, [current])

  const expired = worst && worst.daysLeft < 0

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-4 sm:p-5 ${
        expired
          ? isLight
            ? 'border-rose-200 bg-gradient-to-br from-rose-50 to-white'
            : 'border-rose-500/25 bg-gradient-to-br from-rose-500/10 to-transparent'
          : isLight
            ? 'border-blue-100 bg-gradient-to-br from-white to-blue-50/40'
            : 'border-white/10 bg-gradient-to-br from-[#10182b] to-[#07111a]'
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <div className={`flex size-9 items-center justify-center rounded-xl ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-300'}`}>
          {mode === 'foreign' ? <Plane size={16} /> : <Home size={16} />}
        </div>
        <div>
          <h3 className={`text-sm font-black uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {mode === 'foreign' ? 'Viza va propiska' : "Ro'yxatga olish (propiska)"}
          </h3>
          <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Muddat nazorati va eslatmalar</p>
        </div>
      </div>

      {docs === null ? (
        <div className={`flex items-center justify-center gap-2 py-8 text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          <Loader2 size={14} className="animate-spin" /> Yuklanmoqda…
        </div>
      ) : (
        <div className="space-y-3">
          {expired && (
            <div className={`flex items-start gap-2 rounded-2xl border p-3 ${isLight ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-rose-500/25 bg-rose-500/10 text-rose-200'}`}>
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p className="text-[11px] font-semibold leading-relaxed">
                {mode === 'foreign'
                  ? "Hujjatingiz muddati o'tgan. Zudlik bilan xalqaro bo'lim yoki dekanatga murojaat qiling — kechikish jarima va deportatsiya xavfini keltiradi."
                  : "Ro'yxatga olish (propiska) muddatingiz o'tgan. Zudlik bilan dekanat yoki fuqarolarni ro'yxatga olish bo'limiga murojaat qiling."}
              </p>
            </div>
          )}
          {mode === 'foreign' && (
            <DocPanel
              isLight={isLight}
              docType="visa"
              doc={current.visa}
              onEdit={() => setModal({ type: 'visa', doc: current.visa })}
              onAdd={() => setModal({ type: 'visa', doc: null })}
            />
          )}
          <DocPanel
            isLight={isLight}
            docType="registration"
            doc={current.registration}
            onEdit={() => setModal({ type: 'registration', doc: current.registration })}
            onAdd={() => setModal({ type: 'registration', doc: null })}
          />
          <Link
            href="/talaba/hujjatlarim"
            data-student-button="plain"
            className={`flex items-center justify-center gap-1 rounded-xl border py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
              isLight ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
            }`}
          >
            Barcha hujjatlar va tarix <ChevronRight size={12} />
          </Link>
        </div>
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
