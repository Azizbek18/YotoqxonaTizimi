'use client'

import DormTabs from '@/components/dekan/DormTabs'
import { useDormTabs } from '@/lib/hooks/useDormTabs'
import { studentsInDorm } from '@/features/faculty-students/domain/dorm-scope'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  AlertOctagon,
  Download,
  FileSpreadsheet,
  Filter,
  Plane,
  Home,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Calendar,
  X,
  Globe,
  Pencil,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import CustomSelect from '@/components/ui/CustomSelect'
import { Skel } from '@/components/dekan/Skeletons'
import ForeignDocEditModal from '@/components/dekan/ForeignDocEditModal'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI, type DekanStatusTone } from '@/lib/dekan-ui'
import { downloadXlsx } from '@/lib/spreadsheet-export'
import { buildStudentReportCsv, downloadTextFile } from '@/lib/student-report-table'
import { fetchForeignDocsDashboard } from '@/features/foreign-docs/client/api'
import {
  BUCKET_LABELS,
  DOC_STATUS_LABELS,
  REGISTRATION_BASIS_LABELS,
  type ExpiryBucket,
  type ForeignDocDashboardRow,
} from '@/features/foreign-docs/types'
import { matchesMilestoneFilter, type MilestoneFilter } from '@/features/foreign-docs/domain/expiry'

type DocTypeFilter = '' | 'visa' | 'registration'
type VerifiedFilter = '' | 'yes' | 'no'

const BUCKET_ORDER: ExpiryBucket[] = ['expired', 'critical', 'warning', 'soon', 'ok']

const BUCKET_CONFIG: Record<ExpiryBucket, {
  label: string
  sublabel: string
  icon: React.ElementType
  badge: string
  dot: string
  activeRing: string
  text: string
  bg: string
}> = {
  expired: {
    label: "Muddati o'tgan",
    sublabel: 'Zudlik bilan yangilash',
    icon: AlertOctagon,
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
    dot: 'bg-rose-500',
    activeRing: 'ring-2 ring-rose-500 border-rose-500 shadow-md shadow-rose-500/10',
    text: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10',
  },
  critical: {
    label: 'Favqulodda',
    sublabel: '1–5 kun qoldi',
    icon: ShieldAlert,
    badge: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
    dot: 'bg-red-500',
    activeRing: 'ring-2 ring-red-500 border-red-500 shadow-md shadow-red-500/10',
    text: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10',
  },
  warning: {
    label: 'Ogohlantirish',
    sublabel: '6–15 kun qoldi',
    icon: Clock,
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    dot: 'bg-amber-500',
    activeRing: 'ring-2 ring-amber-500 border-amber-500 shadow-md shadow-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
  },
  soon: {
    label: 'Yaqinlashgan',
    sublabel: '16–30 kun qoldi',
    icon: Calendar,
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
    dot: 'bg-sky-500',
    activeRing: 'ring-2 ring-sky-500 border-sky-500 shadow-md shadow-sky-500/10',
    text: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-500/10',
  },
  ok: {
    label: 'Xavfsiz / Faol',
    sublabel: '30+ kun bor',
    icon: ShieldCheck,
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    activeRing: 'ring-2 ring-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
}

const MILESTONE_OPTIONS: { value: MilestoneFilter | ''; label: string }[] = [
  { value: '', label: 'Barcha muddatlar' },
  { value: '30', label: '1 oy qoldi (16–30 kun)' },
  { value: '15', label: '15 kun qoldi (11–15 kun)' },
  { value: '10', label: '10 kun qoldi (6–10 kun)' },
  { value: '5', label: '5 kun qoldi (4–5 kun)' },
  { value: '3', label: '3 kun qoldi (1–3 kun)' },
  { value: '0', label: 'Bugun tugaydi' },
  { value: 'expired', label: "Muddati o'tgan" },
]

function fmtDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function VizaNazoratiPage() {
  const router = useRouter()
  const isLight = useThemeStore((s) => s.theme) === 'light'
  const ui = dekanUI(isLight)

  const dormScope = useDormTabs()
  const [allRows, setRows] = useState<ForeignDocDashboardRow[]>([])
  const rows = useMemo(
    () => studentsInDorm(allRows.map((row) => ({ ...row, dorm_id: row.dormId })), dormScope.dormId),
    [allRows, dormScope.dormId],
  )
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ForeignDocDashboardRow | null>(null)

  // Filters State
  const [search, setSearch] = useState('')
  const [docType, setDocType] = useState<DocTypeFilter>('')
  const [milestone, setMilestone] = useState<MilestoneFilter | ''>('')
  const [bucket, setBucket] = useState<ExpiryBucket | ''>('')
  const [country, setCountry] = useState('')
  const [basis, setBasis] = useState('')
  const [verified, setVerified] = useState<VerifiedFilter>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await fetchForeignDocsDashboard())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ma'lumotlarni yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(() => {
    const c: Record<ExpiryBucket, number> = { expired: 0, critical: 0, warning: 0, soon: 0, ok: 0 }
    for (const row of rows) if (row.status === 'active') c[row.bucket] += 1
    return c
  }, [rows])

  const countries = useMemo(
    () => [...new Set(rows.map((r) => (r.country ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uz')),
    [rows],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (q) {
        const hay = `${row.studentName} ${row.number ?? ''} ${row.studentId}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (docType && row.docType !== docType) return false
      if (bucket && row.bucket !== bucket) return false
      if (milestone && !matchesMilestoneFilter(row.daysLeft, milestone)) return false
      if (country && (row.country ?? '').trim() !== country) return false
      if (basis && row.registrationBasis !== basis) return false
      if (verified === 'yes' && !row.verifiedAt) return false
      if (verified === 'no' && row.verifiedAt) return false
      if (from && row.expiresOn < from) return false
      if (to && row.expiresOn > to) return false
      return true
    })
  }, [rows, search, docType, bucket, milestone, country, basis, verified, from, to])

  const hasAdvancedFilters = Boolean(milestone || country || basis || verified || from || to)
  const hasFilters = Boolean(search || docType || bucket || hasAdvancedFilters)
  const advancedFilterCount = [milestone, country, basis, verified, from, to].filter(Boolean).length

  const reset = () => {
    setSearch('')
    setDocType('')
    setMilestone('')
    setBucket('')
    setCountry('')
    setBasis('')
    setVerified('')
    setFrom('')
    setTo('')
  }

  const exportTable = async (format: 'excel' | 'csv') => {
    if (filtered.length === 0) {
      toast.error("Tanlangan filtr bo'yicha hujjat topilmadi")
      return
    }
    const headers = [
      'F.I.Sh.', 'Fakultet', 'Kurs', 'Xona', 'Hujjat turi', 'Raqami', 'Berilgan',
      'Tugaydi', 'Qolgan kun', 'Holati', 'Asos', 'Manzil', 'Tekshirilgan', 'Fuqaroligi',
    ]
    const body = filtered.map((r) => [
      r.studentName,
      r.faculty ?? '',
      r.course != null ? String(r.course) : '',
      r.roomNumber ?? '',
      r.docType === 'visa' ? 'Viza' : 'Propiska',
      r.number ?? '',
      fmtDate(r.issuedOn),
      fmtDate(r.expiresOn),
      String(r.daysLeft),
      DOC_STATUS_LABELS[r.status],
      r.registrationBasis ? REGISTRATION_BASIS_LABELS[r.registrationBasis] : '',
      r.address ?? '',
      r.verifiedAt ? 'Ha' : "Yo'q",
      r.country ?? '',
    ])
    const slug = `viza-nazorati_${new Date().toISOString().slice(0, 10)}`
    try {
      if (format === 'excel') {
        await downloadXlsx({ filename: `${slug}.xlsx`, sheetName: 'Viza nazorati', headers, rows: body })
        toast.success('Excel yuklab olindi')
      } else {
        downloadTextFile(`${slug}.csv`, buildStudentReportCsv(headers, body.map((r) => r.map(String))), 'text/csv;charset=utf-8;')
        toast.success('CSV yuklab olindi')
      }
    } catch (error) {
      console.error('Eksport xatosi:', error)
      toast.error('Eksportda xatolik yuz berdi')
    }
  }

  const inputCls = `no-shelf w-full rounded-xl border px-3 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${ui.input}`

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. Executive Hero Banner */}
      <div className="no-shelf relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-800 p-5 sm:p-7 text-white shadow-xl shadow-indigo-950/15 border border-white/20">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-200 border border-emerald-400/30">
                <Globe size={11} /> Xorijiy Talabalar Monitoringi
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-indigo-100 border border-white/15">
                <Plane size={11} /> Viza & Propiska
              </span>
            </div>
            <h1
              className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white drop-shadow-sm"
              style={{ color: '#ffffff' }}
            >
              Viza va Propiska Nazorati
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100 max-w-2xl font-medium leading-relaxed">
              Xorijiy va boshqa hududlardan kelgan talabalarning viza, vaqtincha propiska muddatlari va qonuniy maqomini tezkor monitoring qilish tizimi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Excel export */}
            <button
              type="button"
              onClick={() => exportTable('excel')}
              disabled={loading || filtered.length === 0}
              className="no-shelf cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 px-3.5 py-2 text-xs font-bold text-white transition-all active:scale-95 shadow-xs disabled:opacity-40"
            >
              <FileSpreadsheet size={14} />
              <span>Excel yuklab olish</span>
            </button>

            {/* CSV export */}
            <button
              type="button"
              onClick={() => exportTable('csv')}
              disabled={loading || filtered.length === 0}
              className="no-shelf cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 px-3 py-2 text-xs font-bold text-white transition-all active:scale-95 shadow-xs disabled:opacity-40"
            >
              <Download size={14} />
              <span>CSV</span>
            </button>

            {/* Refresh */}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="no-shelf cursor-pointer inline-flex items-center justify-center h-9 w-9 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white transition-all active:scale-95 shadow-xs disabled:opacity-50"
              title="Yangilash"
            >
              <motion.div
                animate={loading ? { rotate: 360 } : {}}
                transition={loading ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}
              >
                <RotateCcw size={14} />
              </motion.div>
            </button>
          </div>
        </div>

        {/* Dorm selector if applicable */}
        <div className="relative z-10 mt-4 pt-3 border-t border-white/15">
          <DormTabs scope={dormScope} isLight={false} onChange={() => { setEditing(null); setSearch('') }} />
        </div>
      </div>

      {/* 2. 5 Sleek KPI Cards (Expiry Buckets) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {BUCKET_ORDER.map((b) => {
          const cfg = BUCKET_CONFIG[b]
          const Icon = cfg.icon
          const count = counts[b]
          const isActive = bucket === b
          return (
            <button
              key={b}
              type="button"
              onClick={() => setBucket(isActive ? '' : b)}
              className={`no-shelf cursor-pointer rounded-2xl border p-3 sm:p-3.5 text-left transition-all relative overflow-hidden active:scale-95 ${
                isActive
                  ? `${cfg.activeRing} ${isLight ? 'bg-white shadow-md' : 'bg-slate-900 shadow-md'}`
                  : `${ui.card} ${ui.hoverLift}`
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${cfg.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
                <span className={`p-1 rounded-lg ${cfg.bg} ${cfg.text}`}>
                  <Icon size={13} />
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <span className={`text-xl sm:text-2xl font-black tracking-tight ${ui.strong}`}>
                  {loading ? '…' : count}
                </span>
                {isActive && (
                  <span className={`text-[10px] font-bold ${cfg.text}`}>
                    Faol filtr
                  </span>
                )}
              </div>

              <p className={`mt-0.5 text-[10px] font-medium leading-tight ${ui.muted}`}>
                {cfg.sublabel}
              </p>
            </button>
          )
        })}
      </div>

      {/* 3. Smart Filter Toolbar */}
      <div className={`no-shelf rounded-2xl border p-3 sm:p-4 space-y-3 shadow-xs ${ui.card}`}>
        {/* Main Search & Segmented Pills Row */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-0">
            <Search size={15} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${ui.faint}`} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="F.I.Sh., viza raqami yoki talaba ID bo‘yicha qidirish..."
              className={`no-shelf w-full rounded-xl border py-2 pl-10 pr-9 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${ui.input}`}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="no-shelf cursor-pointer absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Quick Segmented Document Type Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`no-shelf flex items-center gap-1 rounded-xl p-1 border ${isLight ? 'bg-slate-100/80 border-slate-200' : 'bg-slate-800/80 border-slate-700'}`}>
              <button
                type="button"
                onClick={() => setDocType('')}
                className={`no-shelf cursor-pointer px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                  docType === ''
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : `${ui.muted} hover:text-slate-900 dark:hover:text-white`
                }`}
              >
                Hammasi ({rows.length})
              </button>
              <button
                type="button"
                onClick={() => setDocType('visa')}
                className={`no-shelf cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                  docType === 'visa'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : `${ui.muted} hover:text-slate-900 dark:hover:text-white`
                }`}
              >
                <Plane size={11} /> Viza ({rows.filter((r) => r.docType === 'visa').length})
              </button>
              <button
                type="button"
                onClick={() => setDocType('registration')}
                className={`no-shelf cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                  docType === 'registration'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : `${ui.muted} hover:text-slate-900 dark:hover:text-white`
                }`}
              >
                <Home size={11} /> Propiska ({rows.filter((r) => r.docType === 'registration').length})
              </button>
            </div>

            {/* Advanced Filters Toggle Button */}
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className={`no-shelf cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                showAdvanced || hasAdvancedFilters
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                  : `${ui.btnGhost}`
              }`}
            >
              <Filter size={13} />
              <span>Filtrlar</span>
              {hasAdvancedFilters && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] text-white font-bold">
                  {advancedFilterCount}
                </span>
              )}
              {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {/* Reset Button */}
            {hasFilters && (
              <button
                type="button"
                onClick={reset}
                className="no-shelf cursor-pointer inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-xs font-bold transition-all active:scale-95"
              >
                <X size={12} />
                <span>Tozalash</span>
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters Drawer (Expandable) */}
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden pt-3 border-t border-slate-100 dark:border-slate-800"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Muddat bosqichi
                  </label>
                  <CustomSelect
                    value={milestone}
                    onChange={(v) => setMilestone(v as MilestoneFilter | '')}
                    className={inputCls}
                    options={MILESTONE_OPTIONS}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Fuqaroligi
                  </label>
                  <CustomSelect
                    value={country}
                    onChange={setCountry}
                    className={inputCls}
                    options={[{ value: '', label: 'Barcha davlatlar' }, ...countries.map((c) => ({ value: c, label: c }))]}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Ro‘yxat asosi
                  </label>
                  <CustomSelect
                    value={basis}
                    onChange={setBasis}
                    className={inputCls}
                    options={[
                      { value: '', label: 'Barchasi' },
                      ...Object.entries(REGISTRATION_BASIS_LABELS).map(([value, label]) => ({ value, label })),
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Tekshirilganlik
                  </label>
                  <CustomSelect
                    value={verified}
                    onChange={(v) => setVerified(v as VerifiedFilter)}
                    className={inputCls}
                    options={[
                      { value: '', label: 'Barchasi' },
                      { value: 'yes', label: 'Faqat tekshirilgan' },
                      { value: 'no', label: 'Tekshirilmagan' },
                    ]}
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Tugash sanasi (dan)
                    </label>
                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Tugash sanasi (gacha)
                    </label>
                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. Results Bar & Urgent Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-bold ${ui.strong}`}>
            {filtered.length} ta hujjat
          </span>
          {filtered.length !== rows.length && (
            <span className={`text-[11px] ${ui.muted}`}>
              (jami {rows.length} tadan saralandi)
            </span>
          )}
          {bucket && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
              Filtr: {BUCKET_LABELS[bucket]}
              <button
                type="button"
                onClick={() => setBucket('')}
                className="no-shelf cursor-pointer hover:text-red-600 ml-0.5"
              >
                <X size={11} />
              </button>
            </span>
          )}
        </div>

        {(counts.expired > 0 || counts.critical > 0) && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/60 self-start sm:self-auto">
            <AlertTriangle size={13} className="text-rose-600 shrink-0" />
            <span>{counts.expired + counts.critical} ta hujjat nazorat talab qiladi</span>
          </div>
        )}
      </div>

      {/* 5. Modern Table */}
      <div className={`no-shelf rounded-3xl border overflow-hidden shadow-xs ${ui.card}`}>
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skel key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${ui.accentTileSoft}`}>
              <Globe size={20} />
            </div>
            <h4 className={`text-sm font-bold ${ui.strong}`}>
              {rows.length === 0 ? 'Hali hujjat kiritilmagan' : 'Tanlangan filtr bo‘yicha hujjat topilmadi'}
            </h4>
            <p className={`mt-1 text-xs max-w-sm mx-auto ${ui.muted}`}>
              {rows.length === 0
                ? 'Talabalar qabul qilingach va hujjatlari kiritilgach, ushbu jadvalda avtomatik ko‘rinadi.'
                : 'Qidiruv so‘zini o‘zgartiring yoki filtrlarni tozalang.'}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={reset}
                className="no-shelf cursor-pointer mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
              >
                <X size={13} />
                <span>Filtrlarni tozalash</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className={`border-b border-slate-200/80 dark:border-slate-800 ${isLight ? 'bg-slate-50/70' : 'bg-slate-900/40'}`}>
                  <th className={`px-4 py-3 text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Talaba (F.I.Sh.)</th>
                  <th className={`px-3 py-3 text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Kurs & Xona</th>
                  <th className={`px-3 py-3 text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Hujjat Turi</th>
                  <th className={`px-3 py-3 text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Raqami</th>
                  <th className={`px-3 py-3 text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Tugash Sanasi</th>
                  <th className={`px-3 py-3 text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Qolgan Vaqt</th>
                  <th className={`px-3 py-3 text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Holati</th>
                  <th className={`px-3 py-3 text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Asos</th>
                  <th className={`px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filtered.map((row) => {
                  const cfg = BUCKET_CONFIG[row.bucket]
                  const isCriticalOrExpired = row.bucket === 'expired' || row.bucket === 'critical'

                  return (
                    <tr
                      key={row.id}
                      onClick={() => router.push(`/dekan/talabalar?student=${row.studentId}`)}
                      className={`cursor-pointer transition-colors group ${
                        isCriticalOrExpired
                          ? isLight ? 'bg-rose-50/30 hover:bg-rose-50/60' : 'bg-rose-950/10 hover:bg-rose-950/20'
                          : isLight ? 'hover:bg-slate-50/80' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* 1. Student Name & Country */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-black text-white shadow-xs">
                            {getInitials(row.studentName)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-bold leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ${ui.strong}`}>
                                {row.studentName}
                              </span>
                              {row.verifiedAt && (
                                <span title="Hujjat tekshirilgan">
                                  <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                              <Globe size={10} className="shrink-0 text-slate-400" />
                              <span className="truncate">{row.country || 'Davlat kiritilmagan'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Course & Room */}
                      <td className="whitespace-nowrap px-3 py-3">
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
                            {row.course ? `${row.course}-kurs` : '—'}
                          </span>
                          <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                            {row.roomNumber ? `№ ${row.roomNumber}` : <span className={ui.faint}>Xonasiz</span>}
                          </div>
                        </div>
                      </td>

                      {/* 3. Doc Type */}
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold ${
                          row.docType === 'visa'
                            ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/50 dark:border-sky-800/50'
                            : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50'
                        }`}>
                          {row.docType === 'visa' ? <Plane size={12} /> : <Home size={12} />}
                          <span>{row.docType === 'visa' ? 'Viza' : 'Propiska'}</span>
                        </span>
                      </td>

                      {/* 4. Number */}
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className={`font-mono text-xs font-bold tracking-tight ${ui.strong}`}>
                          {row.number || '—'}
                        </span>
                      </td>

                      {/* 5. Expiry Date */}
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className={`font-semibold text-slate-700 dark:text-slate-300`}>
                          {fmtDate(row.expiresOn)}
                        </span>
                      </td>

                      {/* 6. Remaining Time */}
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${cfg.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                          {row.daysLeft < 0
                            ? `Muddati o‘tgan (${Math.abs(row.daysLeft)} kun)`
                            : `${row.daysLeft} kun qoldi`}
                        </span>
                      </td>

                      {/* 7. Status */}
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className={`text-[11px] font-medium ${ui.muted}`}>
                          {DOC_STATUS_LABELS[row.status]}
                        </span>
                      </td>

                      {/* 8. Registration Basis */}
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className={`text-[11px] ${ui.muted}`}>
                          {row.registrationBasis ? REGISTRATION_BASIS_LABELS[row.registrationBasis] : '—'}
                        </span>
                      </td>

                      {/* 9. Actions */}
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditing(row)
                            }}
                            className={`no-shelf cursor-pointer inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 ${ui.btnGhost} hover:border-indigo-300 hover:text-indigo-600`}
                          >
                            <Pencil size={11} />
                            <span>Tahrir</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/dekan/talabalar?student=${row.studentId}`)
                            }}
                            className={`no-shelf cursor-pointer p-1 rounded-xl border text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all active:scale-95 ${ui.btnGhost}`}
                            title="Talaba profilini ochish"
                          >
                            <ExternalLink size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Urgent Warning Notice if any expired active docs exist */}
      {rows.some((r) => r.bucket === 'expired' && r.status === 'active') && (
        <div className="no-shelf rounded-2xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-rose-800 dark:text-rose-200 flex items-start gap-3 shadow-xs">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white shadow-xs">
            <AlertTriangle size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-rose-900 dark:text-rose-100">
              Diqqat: Muddati o‘tgan viza yoki propiskalar mavjud!
            </h4>
            <p className="mt-0.5 text-xs leading-relaxed text-rose-700 dark:text-rose-300">
              {counts.expired} ta talaba hujjati muddati o‘tgan. Qonunchilik buzilishining oldini olish uchun
              xalqaro aloqalar bo‘limi hamda talabalar bilan bog‘lanib, hujjatlarning zudlik bilan uzaytirilishini ta’minlang.
            </p>
          </div>
        </div>
      )}

      {/* 7. Foreign Doc Edit Modal */}
      {editing && (
        <ForeignDocEditModal
          isLight={isLight}
          doc={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      )}
    </div>
  )
}
