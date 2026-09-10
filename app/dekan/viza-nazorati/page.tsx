'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Plane,
  Home,
  RotateCcw,
  Search,
  ShieldCheck,
  Stamp,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import CustomSelect from '@/components/ui/CustomSelect'
import { Skel } from '@/components/dekan/Skeletons'
import ForeignDocEditModal from '@/components/dekan/ForeignDocEditModal'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI, statusChip, type DekanStatusTone } from '@/lib/dekan-ui'
import { downloadXlsx } from '@/lib/spreadsheet-export'
import { buildStudentReportCsv, downloadTextFile } from '@/lib/student-report-table'
import { fetchForeignDocsDashboard } from '@/features/foreign-docs/client/api'
import {
  BUCKET_HINTS,
  BUCKET_LABELS,
  DOC_STATUS_LABELS,
  REGISTRATION_BASIS_LABELS,
  type ExpiryBucket,
  type ForeignDocDashboardRow,
} from '@/features/foreign-docs/types'
import { countdownLabel, bucketTone } from '@/features/foreign-docs/domain/presentation'
import { matchesMilestoneFilter, type MilestoneFilter } from '@/features/foreign-docs/domain/expiry'

type DocTypeFilter = '' | 'visa' | 'registration'
type VerifiedFilter = '' | 'yes' | 'no'

const BUCKET_ORDER: ExpiryBucket[] = ['expired', 'critical', 'warning', 'soon', 'ok']

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

const TONE_MAP: Record<ExpiryBucket, DekanStatusTone> = {
  expired: 'danger',
  critical: 'danger',
  warning: 'warning',
  soon: 'info',
  ok: 'success',
}

function fmtDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function VizaNazoratiPage() {
  const router = useRouter()
  const isLight = useThemeStore((s) => s.theme) === 'light'
  const ui = dekanUI(isLight)

  const [rows, setRows] = useState<ForeignDocDashboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ForeignDocDashboardRow | null>(null)

  const [search, setSearch] = useState('')
  const [docType, setDocType] = useState<DocTypeFilter>('')
  const [milestone, setMilestone] = useState<MilestoneFilter | ''>('')
  const [bucket, setBucket] = useState<ExpiryBucket | ''>('')
  const [country, setCountry] = useState('')
  const [basis, setBasis] = useState('')
  const [verified, setVerified] = useState<VerifiedFilter>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

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

  const hasFilters = Boolean(
    search || docType || milestone || bucket || country || basis || verified || from || to,
  )
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

  const exportTable = (format: 'excel' | 'csv') => {
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
    if (format === 'excel') {
      downloadXlsx({ filename: `${slug}.xlsx`, sheetName: 'Viza nazorati', headers, rows: body })
      toast.success('Excel yuklab olindi')
    } else {
      downloadTextFile(`${slug}.csv`, buildStudentReportCsv(headers, body.map((r) => r.map(String))), 'text/csv;charset=utf-8;')
      toast.success('CSV yuklab olindi')
    }
  }

  const inputCls = `rounded-lg border px-3 py-2.5 text-sm ${ui.input} ${ui.ring}`
  const sectionLabel = `text-[10px] font-bold uppercase tracking-[0.18em] ${ui.muted}`

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className={`flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl ${ui.strong}`}>
            <Stamp size={22} className={ui.accentText} /> Viza nazorati
          </h1>
          <p className={`mt-1 text-xs sm:text-sm ${ui.muted}`}>
            Xorijiy talabalarning viza va yashash joyida ro&apos;yxatga qo&apos;yish (propiska) muddatlari
          </p>
        </div>
        <button onClick={() => void load()} disabled={loading} className={`inline-flex items-center justify-center rounded-lg border p-3 disabled:opacity-50 ${ui.btnGhost}`}>
          <motion.div animate={loading ? { rotate: 360 } : {}} transition={loading ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}>
            <RotateCcw size={18} />
          </motion.div>
        </button>
      </div>

      {/* Bucket cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {BUCKET_ORDER.map((b) => {
          const chip = statusChip(TONE_MAP[b], isLight)
          const active = bucket === b
          return (
            <button
              key={b}
              onClick={() => setBucket(active ? '' : b)}
              className={`rounded-2xl border p-4 text-left transition-all ${ui.card} ${ui.hoverLift} ${
                active ? ui.accentBorder : ''
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${chip.dot}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>{BUCKET_LABELS[b]}</span>
              </div>
              <p className={`mt-1.5 text-2xl font-bold tracking-tight ${ui.strong}`}>{loading ? '…' : counts[b]}</p>
              <p className={`mt-0.5 text-[10px] ${ui.faint}`}>{BUCKET_HINTS[b]}</p>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className={`rounded-2xl border p-5 ${ui.card}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className={`flex items-center gap-2 ${sectionLabel}`}>
            <Filter size={13} /> Filtrlar
          </h3>
          <button
            onClick={reset}
            disabled={!hasFilters}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider disabled:opacity-40 ${ui.dangerSoft}`}
          >
            <X size={12} /> Tozalash
          </button>
        </div>

        <div className="relative mb-4">
          <Search size={16} className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${ui.faint}`} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="F.I.Sh, viza raqami yoki talaba ID bo'yicha qidirish..."
            className={`w-full rounded-lg border py-3 pl-11 pr-4 text-sm ${ui.input} ${ui.ring}`}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <label className={sectionLabel}>Hujjat turi</label>
            <CustomSelect value={docType} onChange={(v) => setDocType(v as DocTypeFilter)} className={inputCls}
              options={[{ value: '', label: 'Hammasi' }, { value: 'visa', label: 'Viza' }, { value: 'registration', label: 'Propiska' }]} />
          </div>
          <div className="space-y-1.5">
            <label className={sectionLabel}>Muddat bosqichi</label>
            <CustomSelect value={milestone} onChange={(v) => setMilestone(v as MilestoneFilter | '')} className={inputCls}
              options={MILESTONE_OPTIONS} />
          </div>
          <div className="space-y-1.5">
            <label className={sectionLabel}>Fuqaroligi</label>
            <CustomSelect value={country} onChange={setCountry} className={inputCls}
              options={[{ value: '', label: 'Hammasi' }, ...countries.map((c) => ({ value: c, label: c }))]} />
          </div>
          <div className="space-y-1.5">
            <label className={sectionLabel}>Ro&apos;yxat asosi</label>
            <CustomSelect value={basis} onChange={setBasis} className={inputCls}
              options={[
                { value: '', label: 'Hammasi' },
                ...Object.entries(REGISTRATION_BASIS_LABELS).map(([value, label]) => ({ value, label })),
              ]} />
          </div>
          <div className="space-y-1.5">
            <label className={sectionLabel}>Tekshirilgan</label>
            <CustomSelect value={verified} onChange={(v) => setVerified(v as VerifiedFilter)} className={inputCls}
              options={[{ value: '', label: 'Hammasi' }, { value: 'yes', label: 'Faqat tekshirilgan' }, { value: 'no', label: 'Tekshirilmagan' }]} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className={sectionLabel}>Tugaydi (dan)</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} w-full`} />
            </div>
            <div className="space-y-1.5">
              <label className={sectionLabel}>Tugaydi (gacha)</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} w-full`} />
            </div>
          </div>
        </div>
      </div>

      {/* Summary + export */}
      <div className={`flex flex-col gap-4 rounded-2xl border p-5 lg:flex-row lg:items-center lg:justify-between ${ui.card}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ui.accentTile}`}>
            <FileText size={18} />
          </div>
          <div>
            <p className={`text-2xl font-bold leading-none ${ui.strong}`}>{loading ? '…' : filtered.length}</p>
            <p className={`mt-1 text-[10px] font-semibold uppercase tracking-wider ${ui.muted}`}>
              Tanlangan hujjat (jami {rows.length})
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => exportTable('excel')} disabled={loading || filtered.length === 0}
            className={`flex items-center gap-2 rounded-lg px-4 py-3 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 ${ui.accentSolid}`}>
            <FileSpreadsheet size={16} /> Excel yuklab olish
          </button>
          <button onClick={() => exportTable('csv')} disabled={loading || filtered.length === 0}
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 ${ui.btnGhost}`}>
            <Download size={16} /> CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-2xl border ${ui.card}`}>
        {loading ? (
          <div className="space-y-2.5 p-5">
            {Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-10" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className={`px-4 py-16 text-center text-xs font-medium ${ui.muted}`}>
            {rows.length === 0 ? "Hali xorijiy talaba hujjati kiritilmagan" : "Tanlangan filtr bo'yicha hujjat topilmadi"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead>
                <tr className={`border-b ${ui.border}`}>
                  {['F.I.Sh.', 'Kurs', 'Xona', 'Tur', 'Raqami', 'Tugaydi', 'Qolgan', 'Holati', 'Asos', ''].map((h) => (
                    <th key={h} className={`whitespace-nowrap px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const tone = bucketTone(row.bucket)
                  const chip = statusChip(TONE_MAP[row.bucket], isLight)
                  return (
                    <tr
                      key={row.id}
                      onClick={() => router.push(`/dekan/talabalar?student=${row.studentId}`)}
                      className={`cursor-pointer border-b last:border-0 ${ui.border} ${isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/40'}`}
                    >
                      <td className={`px-3 py-2.5 font-semibold ${ui.strong}`}>
                        <span className="flex items-center gap-1.5">
                          {row.studentName}
                          {row.verifiedAt && <ShieldCheck size={12} className="text-emerald-500" />}
                        </span>
                        {row.country && <span className={`block text-[10px] font-normal ${ui.faint}`}>{row.country}</span>}
                      </td>
                      <td className={`whitespace-nowrap px-3 py-2.5 ${ui.muted}`}>{row.course ? `${row.course}-kurs` : '—'}</td>
                      <td className={`whitespace-nowrap px-3 py-2.5 ${ui.muted}`}>{row.roomNumber ? `№-${row.roomNumber}` : '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="inline-flex items-center gap-1">
                          {row.docType === 'visa' ? <Plane size={12} /> : <Home size={12} />}
                          {row.docType === 'visa' ? 'Viza' : 'Propiska'}
                        </span>
                      </td>
                      <td className={`whitespace-nowrap px-3 py-2.5 ${ui.muted}`}>{row.number || '—'}</td>
                      <td className={`whitespace-nowrap px-3 py-2.5 ${ui.muted}`}>{fmtDate(row.expiresOn)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${chip.chip}`}>
                          {tone === 'danger' && row.daysLeft < 0 ? countdownLabel(row.daysLeft) : `${row.daysLeft} kun`}
                        </span>
                      </td>
                      <td className={`whitespace-nowrap px-3 py-2.5 ${ui.muted}`}>{DOC_STATUS_LABELS[row.status]}</td>
                      <td className={`whitespace-nowrap px-3 py-2.5 ${ui.muted}`}>
                        {row.registrationBasis ? REGISTRATION_BASIS_LABELS[row.registrationBasis] : '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditing(row) }}
                          className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${ui.btnGhost}`}
                        >
                          Tahrir
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rows.some((r) => r.bucket === 'expired' && r.status === 'active') && (
        <div className={`flex items-start gap-2 rounded-2xl border p-4 ${isLight ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-rose-500/25 bg-rose-500/10 text-rose-200'}`}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p className="text-xs font-medium leading-relaxed">
            {counts.expired} ta talaba hujjati muddati o&apos;tgan. Ular bilan bog&apos;lanib, xalqaro bo&apos;lim orqali yangilanishini ta&apos;minlang.
          </p>
        </div>
      )}

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
