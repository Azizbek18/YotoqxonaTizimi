'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plane, Home, FileSignature, Plus, Pencil, ShieldCheck, AlertTriangle, Loader2, ChevronRight, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react'
import { fetchMyForeignDocs } from '@/features/foreign-docs/client/api'
import { DOC_STATUS_LABELS, type DocType, type ForeignDoc } from '@/features/foreign-docs/types'
import { bucketTone, countdownLabel, ringProgress } from '@/features/foreign-docs/domain/presentation'
import ForeignDocModal from './ForeignDocModal'

type Props = { isLight: boolean; mode: 'foreign' | 'registration'; showLease?: boolean }

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
        <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
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
  const isLease = docType === 'lease'
  const Icon = isVisa ? Plane : isLease ? FileSignature : Home
  const label = isVisa ? 'Viza' : isLease ? 'Ijara shartnomasi' : 'Propiska'

  if (!doc) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onAdd}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onAdd()
          }
        }}
        className={`group relative flex w-full flex-col min-[420px]:flex-row min-[420px]:items-center justify-between gap-3.5 rounded-2xl border p-4 text-left transition-all cursor-pointer ${
          isLight
            ? 'border-blue-200/90 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-white hover:border-blue-400 hover:shadow-md'
            : 'border-blue-500/25 bg-gradient-to-r from-blue-950/35 via-indigo-950/20 to-slate-900/60 hover:border-blue-400/40 hover:shadow-md'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl shadow-xs transition-transform group-hover:scale-105 ${
              isLight ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
            }`}
          >
            <Icon size={20} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-300'
                }`}
              >
                <Sparkles size={10} className="text-amber-500" /> Rasmiy ro‘yxat
              </span>
            </div>
            <p className={`text-sm font-bold leading-snug ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {label} ma&apos;lumotini kiritish
            </p>
            <p className={`mt-0.5 text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Muddat va skan-faylni biriktirib, eslatmalarni faollashtiring.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 self-start min-[420px]:self-center">
          <span
            data-student-button="plain"
            className="no-shelf inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-all group-hover:bg-blue-700 group-hover:shadow-sm"
          >
            <Plus size={14} strokeWidth={2.5} /> Kiritish
          </span>
        </div>
      </div>
    )
  }

  const tone = bucketTone(doc.bucket)
  const t = TONE_CLASSES[tone]
  const expDate = new Date(doc.expiresOn).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div
      className={`rounded-2xl border p-3.5 sm:p-4 transition-all ${
        isLight ? 'border-slate-200/90 bg-white shadow-2xs' : 'border-white/[0.08] bg-white/[0.03]'
      }`}
    >
      <div className="flex items-start gap-3.5">
        <CountdownRing days={doc.daysLeft} isLight={isLight} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
              <Icon size={13} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
              {label}
            </span>
            {doc.verifiedAt && (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={10} /> Tasdiqlangan
              </span>
            )}
          </div>
          <p className={`mt-1 text-sm font-bold leading-tight ${t.text}`}>{countdownLabel(doc.daysLeft)}</p>
          <p className={`mt-0.5 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {expDate}gacha amal qiladi
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${t.chip}`}>
              {DOC_STATUS_LABELS[doc.status]}
            </span>
            {doc.number && (
              <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-slate-200'}`}>
                № {doc.number}
              </span>
            )}
            <button
              type="button"
              onClick={onEdit}
              data-student-button="plain"
              className={`no-shelf ml-auto inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                isLight ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50' : 'border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Pencil size={11} /> Yangilash
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
export default function ForeignDocsCard({ isLight, mode, showLease = false }: Props) {
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
    return { visa: pick('visa'), registration: pick('registration'), lease: pick('lease') }
  }, [docs])

  const worst = useMemo(() => {
    const active = [current.visa, current.registration, current.lease].filter(Boolean) as ForeignDoc[]
    if (active.length === 0) return null
    return active.reduce((a, b) => (a.daysLeft <= b.daysLeft ? a : b))
  }, [current])

  const expired = worst && worst.daysLeft < 0
  const hasActiveDoc = Boolean(worst)

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-4 sm:p-5 transition-all ${
        expired
          ? isLight
            ? 'border-rose-200 bg-gradient-to-br from-rose-50/70 via-white to-rose-50/30 shadow-sm'
            : 'border-rose-500/25 bg-gradient-to-br from-rose-950/20 via-slate-900/60 to-slate-900 shadow-sm'
          : isLight
            ? 'border-blue-100 bg-gradient-to-br from-white via-slate-50/40 to-blue-50/30 shadow-sm'
            : 'border-white/10 bg-gradient-to-br from-[#10182b] to-[#07111a] shadow-sm'
      }`}
    >
      <div className="mb-3.5 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-2xl shadow-xs ${
              isLight ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white' : 'bg-blue-600 text-white'
            }`}
          >
            {mode === 'foreign' ? <Plane size={18} /> : <Home size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className={`text-sm sm:text-base font-extrabold leading-snug break-words ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {showLease ? (mode === 'foreign' ? 'Viza, propiska va ijara' : 'Propiska va ijara') : mode === 'foreign' ? 'Viza va propiska' : "Ro'yxatga olish (propiska)"}
            </h3>
            <p className={`text-[11px] leading-tight mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Yashash joyi hisobi va muddat nazorati</p>
          </div>
        </div>
        <div className="shrink-0">
          {expired ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertTriangle size={11} /> Muddati o‘tgan
            </span>
          ) : hasActiveDoc ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 size={11} /> Amalda
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertCircle size={11} /> Kiritilmagan
            </span>
          )}
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
          {showLease && (
            <DocPanel
              isLight={isLight}
              docType="lease"
              doc={current.lease}
              onEdit={() => setModal({ type: 'lease', doc: current.lease })}
              onAdd={() => setModal({ type: 'lease', doc: null })}
            />
          )}
          <Link
            href="/talaba/hujjatlarim"
            data-student-button="plain"
            className={`no-shelf flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-4 text-xs font-semibold transition-colors shadow-2xs ${
              isLight
                ? 'border-slate-200/90 bg-white/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
            }`}
          >
            <span>Barcha hujjatlar tarixi va arxiv</span>
            <ChevronRight size={14} className="text-slate-400" />
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
