'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Phone, RotateCcw, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import CustomSelect from '@/components/ui/CustomSelect'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI, statusChip, type DekanStatusTone } from '@/lib/dekan-ui'
import { downloadXlsx } from '@/lib/spreadsheet-export'
import { PERMIT_FACULTIES, permitFacultyLabel } from '@/lib/faculties'
import { fetchInternationalOverview } from '@/features/foreign-docs/client/api'
import {
  REGISTRATION_BASIS_LABELS,
  type InternationalDoc,
  type InternationalStudentRow,
} from '@/features/foreign-docs/types'
import {
  docHealth,
  matchesIssue,
  summarize,
  type DocHealth,
  type IssueFilter,
} from '@/features/foreign-docs/domain/international'

const PAGE_SIZE = 40

const HEALTH_LABEL: Record<DocHealth, string> = {
  missing: 'Kiritilmagan',
  expired: "Muddati o'tgan",
  soon: '30 kun ichida',
  ok: 'Amalda',
}
const HEALTH_TONE: Record<DocHealth, DekanStatusTone> = {
  missing: 'danger',
  expired: 'danger',
  soon: 'warning',
  ok: 'success',
}

const ISSUE_OPTIONS: { value: IssueFilter; label: string }[] = [
  { value: '', label: 'Barcha talabalar' },
  { value: 'any', label: 'Biror muammosi borlar' },
  { value: 'visa-expired', label: "Viza muddati o'tgan" },
  { value: 'visa-soon', label: 'Viza 30 kun ichida tugaydi' },
  { value: 'visa-missing', label: 'Viza kiritilmagan' },
  { value: 'reg-expired', label: "Propiska muddati o'tgan" },
  { value: 'reg-soon', label: 'Propiska 30 kun ichida tugaydi' },
  { value: 'reg-missing', label: 'Propiska kiritilmagan' },
]

function fmtDate(value: string | null) {
  if (!value) return '—'
  return new Date(`${value}T00:00:00`).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function daysText(days: number) {
  if (days < 0) return `${-days} kun oldin tugagan`
  if (days === 0) return 'Bugun tugaydi'
  return `${days} kun qoldi`
}

function healthText(doc: InternationalDoc | null) {
  const health = docHealth(doc)
  if (health === 'missing') return doc?.status === 'cancelled' ? 'Bekor qilingan' : HEALTH_LABEL.missing
  return HEALTH_LABEL[health]
}

export default function XalqaroDashboardPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  const [rows, setRows] = useState<InternationalStudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [faculty, setFaculty] = useState('')
  const [issue, setIssue] = useState<IssueFilter>('')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      setRows(await fetchInternationalOverview())
    } catch (error) {
      setFailed(true)
      toast.error(error instanceof Error ? error.message : "Ma'lumotlarni yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const summary = useMemo(() => summarize(rows), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (faculty && row.faculty !== faculty) return false
      if (!matchesIssue(row, issue)) return false
      if (!q) return true
      return [row.fullName, row.country, row.phone].some((v) => (v ?? '').toLowerCase().includes(q))
    })
  }, [rows, search, faculty, issue])

  useEffect(() => { setPage(1) }, [search, faculty, issue])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const cards: { key: IssueFilter; label: string; value: number; tone: DekanStatusTone | 'neutral' }[] = [
    { key: '', label: 'Jami xorijiy talaba', value: summary.total, tone: 'neutral' },
    { key: 'any', label: 'Biror muammosi bor', value: summary.anyIssue, tone: 'warning' },
    { key: 'visa-expired', label: "Viza muddati o'tgan", value: summary.visa.expired, tone: 'danger' },
    { key: 'visa-soon', label: 'Viza 30 kun ichida', value: summary.visa.soon, tone: 'warning' },
    { key: 'visa-missing', label: 'Viza kiritilmagan', value: summary.visa.missing, tone: 'danger' },
    { key: 'reg-expired', label: "Propiska muddati o'tgan", value: summary.registration.expired, tone: 'danger' },
    { key: 'reg-soon', label: 'Propiska 30 kun ichida', value: summary.registration.soon, tone: 'warning' },
    { key: 'reg-missing', label: 'Propiska kiritilmagan', value: summary.registration.missing, tone: 'danger' },
  ]

  const exportXlsx = async () => {
    if (filtered.length === 0) return
    try {
      await downloadXlsx({
        filename: `xalqaro-viza-propiska-${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: 'Viza va propiska',
        headers: [
          'Talaba', 'Mamlakat', 'Fakultet', 'Kurs', 'Telefon',
          'Viza raqami', 'Viza muddati', 'Viza holati',
          'Propiska muddati', 'Propiska holati', 'Propiska asosi', 'Propiska manzili',
        ],
        rows: filtered.map((r) => [
          r.fullName, r.country, permitFacultyLabel(r.faculty), r.course, r.phone,
          r.visa?.number ?? '', r.visa ? fmtDate(r.visa.expiresOn) : '', healthText(r.visa),
          r.registration ? fmtDate(r.registration.expiresOn) : '', healthText(r.registration),
          r.registration?.registrationBasis ? REGISTRATION_BASIS_LABELS[r.registration.registrationBasis] : '',
          r.registration?.address ?? '',
        ]),
      })
    } catch {
      toast.error("Faylni yuklab bo'lmadi")
    }
  }

  const docCell = (doc: InternationalDoc | null, showBasis: boolean) => {
    const health = docHealth(doc)
    const chip = statusChip(HEALTH_TONE[health], isLight)
    return (
      <div className="space-y-1">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${chip.chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
          {healthText(doc)}
        </span>
        {doc && health !== 'missing' && (
          <p className={`text-xs ${ui.body}`}>
            {fmtDate(doc.expiresOn)} · <span className={chip.text}>{daysText(doc.daysLeft)}</span>
          </p>
        )}
        {doc && doc.number && <p className={`text-[11px] ${ui.muted}`}>№ {doc.number}</p>}
        {doc && showBasis && doc.registrationBasis && (
          <p className={`text-[11px] ${ui.muted}`}>{REGISTRATION_BASIS_LABELS[doc.registrationBasis]}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className={`relative overflow-hidden rounded-2xl border p-5 sm:p-6 ${ui.cardElevated}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className={`text-xl font-black tracking-tight sm:text-2xl ${ui.strong}`}>Xorijiy talabalar: viza va propiska</h1>
            <p className={`mt-1 text-sm ${ui.body}`}>
              Barcha fakultetlar bo‘yicha joriy viza va propiska holati. Faqat ko‘rish — ma’lumotni o‘zgartirib bo‘lmaydi.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button" onClick={() => void load()} disabled={loading}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold disabled:opacity-50 ${ui.btnGhost}`}
            >
              <RotateCcw size={14} className={loading ? 'animate-spin' : ''} /> Yangilash
            </button>
            <button
              type="button" onClick={() => void exportXlsx()} disabled={loading || filtered.length === 0}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold disabled:opacity-50 ${ui.accentSolid}`}
            >
              <Download size={14} /> Excel ({filtered.length})
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => {
          const active = issue === card.key
          const chip = card.tone === 'neutral' ? null : statusChip(card.tone, isLight)
          return (
            <button
              key={card.key || 'all'}
              type="button"
              onClick={() => setIssue(active && card.key !== '' ? '' : card.key)}
              className={`rounded-2xl border p-4 text-left transition-all ${ui.card} ${ui.hoverLift} ${active ? 'ring-2 ring-indigo-500' : ''}`}
            >
              <p className={`text-[11px] font-bold uppercase tracking-wider ${ui.muted}`}>{card.label}</p>
              <p className={`mt-2 text-3xl font-black leading-none ${chip && card.value > 0 ? chip.text : ui.strong}`}>
                {loading ? '—' : card.value}
              </p>
            </button>
          )
        })}
      </section>

      <section className={`rounded-2xl border p-3.5 sm:p-4 ${ui.card}`}>
        <div className="grid gap-2 md:grid-cols-[1fr_260px_260px]">
          <div className="relative">
            <Search size={16} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${ui.faint}`} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ism, mamlakat yoki telefon bo‘yicha izlash"
              className={`h-11 w-full rounded-xl border pl-10 pr-4 text-sm outline-none ${ui.input} ${ui.ring}`}
            />
          </div>
          <CustomSelect
            value={faculty}
            onChange={setFaculty}
            className={`rounded-xl border px-3 py-2.5 text-sm ${ui.input}`}
            options={[{ value: '', label: 'Barcha fakultet' }, ...PERMIT_FACULTIES.map((f) => ({ value: f.value, label: f.label }))]}
          />
          <CustomSelect
            value={issue}
            onChange={(v) => setIssue(v as IssueFilter)}
            className={`rounded-xl border px-3 py-2.5 text-sm ${ui.input}`}
            options={ISSUE_OPTIONS}
          />
        </div>
      </section>

      <section className={`overflow-hidden rounded-2xl border ${ui.card}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className={`text-[11px] font-bold uppercase tracking-wider ${ui.muted} ${isLight ? 'bg-slate-50' : 'bg-slate-900/60'}`}>
                <th className="px-4 py-3">Talaba</th>
                <th className="px-4 py-3">Fakultet</th>
                <th className="px-4 py-3">Viza</th>
                <th className="px-4 py-3">Propiska</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${ui.divide}`}>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={4} className="px-4 py-4"><div className={`h-9 animate-pulse rounded-lg ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'}`} /></td>
                </tr>
              ))}
              {!loading && failed && (
                <tr><td colSpan={4} className={`px-4 py-10 text-center text-sm ${ui.body}`}>Ma’lumotlarni yuklab bo‘lmadi. “Yangilash” tugmasini bosing.</td></tr>
              )}
              {!loading && !failed && pageRows.length === 0 && (
                <tr><td colSpan={4} className={`px-4 py-10 text-center text-sm ${ui.body}`}>Filtr bo‘yicha talaba topilmadi.</td></tr>
              )}
              {!loading && pageRows.map((row) => (
                <tr key={row.studentId} className="align-top">
                  <td className="px-4 py-3.5">
                    <p className={`font-bold ${ui.strong}`}>{row.fullName}</p>
                    <p className={`text-xs ${ui.muted}`}>{row.country ?? '—'}</p>
                    {row.phone && (
                      <p className={`mt-0.5 inline-flex items-center gap-1 text-xs ${ui.body}`}><Phone size={11} />{row.phone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className={`text-sm ${ui.body}`}>{permitFacultyLabel(row.faculty) || '—'}</p>
                    <p className={`text-xs ${ui.muted}`}>{row.course ? `${row.course}-kurs` : ''}</p>
                  </td>
                  <td className="px-4 py-3.5">{docCell(row.visa, false)}</td>
                  <td className="px-4 py-3.5">{docCell(row.registration, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > PAGE_SIZE && (
          <div className={`flex items-center justify-between gap-3 border-t px-4 py-3 text-xs ${isLight ? 'border-slate-200' : 'border-slate-800'} ${ui.muted}`}>
            <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length}</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-bold disabled:opacity-40 ${ui.btnGhost}`}>
                <ChevronLeft size={13} /> Oldingi
              </button>
              <span className={`font-black ${ui.strong}`}>{page} / {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-bold disabled:opacity-40 ${ui.btnGhost}`}>
                Keyingi <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
