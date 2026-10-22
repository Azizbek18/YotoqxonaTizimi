'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe2,
  Search,
  RotateCcw,
  Download,
  Phone,
  FileSearch,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Calendar,
  Eye,
  X,
  ArrowUpDown,
  Copy,
  Check,
  LayoutGrid,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  MapPin,
  GraduationCap,
  ShieldAlert,
  Inbox,
  Info,
} from 'lucide-react'
import toast from 'react-hot-toast'
import CustomSelect from '@/components/ui/CustomSelect'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI } from '@/lib/dekan-ui'
import { downloadXlsx } from '@/lib/spreadsheet-export'
import { PERMIT_FACULTIES, permitFacultyLabel } from '@/lib/faculties'
import { fetchInternationalOverview, internationalDocFileUrl } from '@/features/foreign-docs/client/api'
import {
  REGISTRATION_BASIS_LABELS,
  type InternationalDoc,
  type InternationalStudentRow,
} from '@/features/foreign-docs/types'
import {
  canonicalCountry,
  countryCode,
  docHealth,
  matchesIssue,
  summarize,
  type DocHealth,
  type IssueFilter,
} from '@/features/foreign-docs/domain/international'

const PAGE_SIZE = 24

const HEALTH_LABEL: Record<DocHealth, string> = {
  missing: 'Kiritilmagan',
  expired: 'Muddati o‘tgan',
  soon: '30 kun ichida',
  ok: 'Amalda',
}

// Davlat nomlari serverda birlashtirilgan (canonicalCountry), bu yerda faqat
// bo'sh qiymat va belgi (ISO kod) bilan ishlanadi. `page.tsx` dan yordamchilarni
// eksport qilib bo'lmaydi (Next.js build xato beradi), shuning uchun ular
// domen modulida.
function displayCountry(country: string | null | undefined): string {
  return canonicalCountry(country) ?? 'Nomaʼlum'
}

function CountryBadge({ country, isLight }: { country: string | null | undefined; isLight: boolean }) {
  const code = countryCode(country)
  return (
    <span
      className={`inline-flex h-4 min-w-[22px] items-center justify-center rounded px-1 text-[9px] font-black leading-none tracking-wide ${
        isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-700 text-slate-200'
      }`}
      aria-hidden="true"
    >
      {code ?? '··'}
    </span>
  )
}

// Bosilishi mumkin bo'lgan div/tr: Enter va Space ham ishlaydi, ichidagi
// tugma/havolaning o'z bosilishlari esa buzilmaydi.
function activateOnKey(action: () => void) {
  return (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      action()
    }
  }
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

// Excelda bo'sh katak "xato"dek ko'rinadi; ma'lumot yo'q joyga uzun tire qo'yiladi
// (u ASCII "-" emas, shuning uchun formula himoyasi unga ' qo'shmaydi).
const EMPTY_CELL = '—'

function fmtDate(value: string | null) {
  if (!value) return '—'
  const str = String(value).trim()
  const raw = str.split('T')[0]
  const parts = raw.split('-')
  if (parts.length === 3) {
    const [y, m, d] = parts
    return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y}`
  }
  const date = new Date(str)
  if (isNaN(date.getTime())) return str
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  return `${d}.${m}.${y}`
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

function getUrgencyScore(row: InternationalStudentRow): number {
  const visaHealth = docHealth(row.visa)
  const regHealth = docHealth(row.registration)

  if (visaHealth === 'expired' || regHealth === 'expired') {
    const minDays = Math.min(
      visaHealth === 'expired' ? (row.visa?.daysLeft ?? 0) : 0,
      regHealth === 'expired' ? (row.registration?.daysLeft ?? 0) : 0
    )
    return 10000 - minDays
  }

  if (visaHealth === 'soon' || regHealth === 'soon') {
    const minDays = Math.min(
      visaHealth === 'soon' ? (row.visa?.daysLeft ?? 30) : 30,
      regHealth === 'soon' ? (row.registration?.daysLeft ?? 30) : 30
    )
    return 5000 + (30 - minDays)
  }

  if (visaHealth === 'missing' || regHealth === 'missing') {
    return 1000
  }

  return 0
}

// Unified Document Cell for spacious, elegant table representation
function UnifiedDocCell({
  doc,
  health,
  isLight,
  onScan,
  type,
  extra,
  address,
}: {
  doc: InternationalDoc | null
  health: DocHealth
  isLight: boolean
  onScan: (docId: string) => void
  type: 'visa' | 'registration'
  extra?: string | null
  address?: string | null
}) {
  if (!doc || health === 'missing') {
    return (
      <div
        className={`p-3 rounded-2xl border border-dashed flex flex-col justify-center min-h-[72px] transition-colors ${
          isLight ? 'border-slate-300/80 bg-slate-50/50' : 'border-slate-800 bg-slate-900/40'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          <span className={`text-xs font-bold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            {doc?.status === 'cancelled' ? 'Bekor qilingan' : 'Kiritilmagan'}
          </span>
        </div>
        <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          {type === 'visa' ? 'Viza hujjati yo‘q' : 'Propiska mavjud emas'}
        </p>
      </div>
    )
  }

  const isExpired = health === 'expired'
  const isSoon = health === 'soon'

  return (
    <div
      className={`p-3 rounded-2xl border transition-all ${
        isExpired
          ? isLight
            ? 'bg-rose-50/40 border-rose-200/90'
            : 'bg-rose-950/20 border-rose-900/60'
          : isSoon
            ? isLight
              ? 'bg-amber-50/40 border-amber-200/90'
              : 'bg-amber-950/20 border-amber-900/60'
            : isLight
              ? 'bg-white border-slate-200/90'
              : 'bg-slate-900/70 border-slate-800'
      }`}
    >
      {/* 1. Header: Status Pill + Basis Pill */}
      <div className="flex items-center justify-between gap-1.5 flex-wrap">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
            isExpired
              ? isLight
                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                : 'bg-rose-950 text-rose-300 border border-rose-800'
              : isSoon
                ? isLight
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
                : isLight
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isExpired
                ? 'bg-rose-600'
                : isSoon
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            }`}
          />
          {isExpired
            ? `${-doc.daysLeft} kun o‘tgan`
            : isSoon
              ? doc.daysLeft === 0
                ? 'Bugun tugaydi'
                : `${doc.daysLeft} kun qoldi`
              : 'Amalda'}
        </span>

        {extra && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
              isLight
                ? 'bg-slate-100 text-slate-700 border border-slate-200'
                : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}
            title={`Ro‘yxat asosi: ${extra}`}
          >
            {extra}
          </span>
        )}
      </div>

      {/* 2. Middle: Expiration date and Doc number */}
      <div className="mt-2 flex items-center justify-between gap-2 text-xs whitespace-nowrap">
        <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
          <Calendar size={13} className={`shrink-0 ${isExpired ? 'text-rose-500' : isSoon ? 'text-amber-500' : 'text-slate-400'}`} />
          <span
            className={`font-black tracking-tight tabular-nums whitespace-nowrap ${
              isExpired
                ? 'text-rose-700 dark:text-rose-400'
                : isSoon
                  ? 'text-amber-700 dark:text-amber-400'
                  : isLight
                    ? 'text-slate-900'
                    : 'text-slate-100'
            }`}
          >
            {fmtDate(doc.expiresOn)}
          </span>
        </div>

        {doc.number && (
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded border font-semibold whitespace-nowrap shrink-0 ${
              isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title={`Hujjat raqami: ${doc.number}`}
          >
            № {doc.number}
          </span>
        )}
      </div>

      {/* 3. Bottom: Address (for propiska) or Skan link */}
      <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
        {address ? (
          <div
            className={`flex items-center gap-1 text-[11px] max-w-[190px] truncate ${
              isLight ? 'text-slate-600' : 'text-slate-400'
            }`}
            title={`Propiska manzili: ${address}`}
          >
            <MapPin size={11} className="shrink-0 text-slate-400" />
            <span className="truncate">{address}</span>
          </div>
        ) : (
          <span className="text-[10px] text-slate-400 italic">
            {type === 'visa' ? 'Viza hujjati' : 'Manzil kiritilmagan'}
          </span>
        )}

        {doc.hasFile && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onScan(doc.id)
            }}
            className={`no-shelf inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              isLight
                ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                : 'bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-800'
            }`}
            title="Hujjat skanerini ochish"
          >
            <FileSearch size={11} />
            <span>Skan</span>
          </button>
        )}
      </div>
    </div>
  )
}

// Asosiy amal tugmasi: talaba dossiyesini ochadi. To'q indigo fon va oq matn
// bilan ikkinchi darajali tugmalardan (Nusxa, Skan) aniq ajralib turadi.
function DetailButton({ onOpen, isLight, fullWidth }: { onOpen: () => void; isLight: boolean; fullWidth?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      className={`no-shelf group/detail inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2 active:bg-indigo-800 ${
        isLight
          ? 'bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-offset-white'
          : 'bg-indigo-500 hover:bg-indigo-400 focus-visible:ring-offset-slate-950'
      } ${fullWidth ? 'w-full' : ''}`}
      title="Talabaning to‘liq dosyesini ochish"
    >
      <Eye size={14} className="shrink-0" />
      <span>Batafsil</span>
      <ChevronRight size={14} className="shrink-0 transition-transform group-hover/detail:translate-x-0.5" />
    </button>
  )
}

export default function XalqaroDashboardPage() {
  const theme = useThemeStore((s) => s.theme)
  const isLight = theme === 'light'
  const ui = dekanUI(isLight)
  const textMuted = ui.muted
  const textStrong = ui.strong

  const [rows, setRows] = useState<InternationalStudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [faculty, setFaculty] = useState('')
  const [country, setCountry] = useState('')
  const [course, setCourse] = useState<string>('')
  const [issue, setIssue] = useState<IssueFilter>('')
  const [sortBy, setSortBy] = useState<'urgency' | 'name' | 'country' | 'faculty' | 'visa' | 'registration'>('urgency')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards')
  const [page, setPage] = useState(1)
  const [selectedStudent, setSelectedStudent] = useState<InternationalStudentRow | null>(null)
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null)
  // Jadval (9 ustun) tor ekranga sig'maydi: md dan kichik ekranda doim kartalar.
  const [isNarrow, setIsNarrow] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const update = () => setIsNarrow(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const activeView = isNarrow ? 'cards' : viewMode

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const data = await fetchInternationalOverview()
      setRows(data)
    } catch (error) {
      setFailed(true)
      toast.error(error instanceof Error ? error.message : "Ma'lumotlarni yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const summary = useMemo(() => summarize(rows), [rows])

  // Aggregate distinct foreign countries
  const distinctCountries = useMemo(() => {
    const map = new Map<string, number>()
    rows.forEach((r) => {
      const norm = displayCountry(r.country)
      map.set(norm, (map.get(norm) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        code: countryCode(name),
      }))
  }, [rows])

  // Filter and sort students
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (faculty && row.faculty !== faculty) return false
      if (country && displayCountry(row.country) !== country) return false
      if (course && String(row.course ?? '') !== course) return false
      if (!matchesIssue(row, issue)) return false
      if (!q) return true

      return [
        row.fullName,
        row.country,
        row.phone,
        row.visa?.number,
        row.registration?.number,
        row.registration?.address,
      ].some((v) => (v ?? '').toLowerCase().includes(q))
    })
  }, [rows, search, faculty, country, course, issue])

  const sortedAndFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'urgency') {
        const scoreA = getUrgencyScore(a)
        const scoreB = getUrgencyScore(b)
        if (scoreA !== scoreB) return scoreB - scoreA
        return a.fullName.localeCompare(b.fullName)
      }
      if (sortBy === 'name') {
        return a.fullName.localeCompare(b.fullName)
      }
      if (sortBy === 'country') {
        const cA = displayCountry(a.country)
        const cB = displayCountry(b.country)
        return cA.localeCompare(cB)
      }
      if (sortBy === 'faculty') {
        const fA = a.faculty ?? ''
        const fB = b.faculty ?? ''
        return fA.localeCompare(fB)
      }
      // Muddati eng yaqin (yoki allaqachon o'tgan) hujjat birinchi; kiritilmagani oxirida.
      const key = (row: InternationalStudentRow) => {
        const doc = sortBy === 'visa' ? row.visa : row.registration
        return docHealth(doc) === 'missing' ? Number.POSITIVE_INFINITY : doc!.daysLeft
      }
      const kA = key(a)
      const kB = key(b)
      if (kA !== kB) return kA < kB ? -1 : 1
      return a.fullName.localeCompare(b.fullName)
    })
  }, [filtered, sortBy])

  useEffect(() => {
    setPage(1)
  }, [search, faculty, country, course, issue, sortBy])

  const totalPages = Math.max(1, Math.ceil(sortedAndFiltered.length / PAGE_SIZE))
  const pageRows = sortedAndFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Talabalar soni (hujjatlar emas): bir talabaning ikkala hujjati tugagan bo'lsa ham u bitta.
  const criticalExpiredCount = useMemo(() => rows.filter((r) => matchesIssue(r, 'expired')).length, [rows])
  const urgentSoonCount = useMemo(() => rows.filter((r) => matchesIssue(r, 'soon')).length, [rows])
  const healthyCount = rows.filter((r) => docHealth(r.visa) === 'ok' && docHealth(r.registration) === 'ok').length

  const executiveStats = [
    {
      title: 'Jami xorijiy talabalar',
      value: summary.total,
      percentage: 100,
      icon: Globe2,
      activeFilter: '',
      color: textStrong,
      barColor: isLight ? 'bg-slate-900' : 'bg-slate-200',
    },
    {
      title: 'Muddati o‘tgan hujjati bor',
      value: criticalExpiredCount,
      percentage: summary.total > 0 ? Math.round((criticalExpiredCount / summary.total) * 100) : 0,
      icon: AlertOctagon,
      activeFilter: 'expired',
      color: criticalExpiredCount > 0 ? 'text-rose-700 dark:text-rose-400' : textStrong,
      barColor: 'bg-rose-600',
      alert: criticalExpiredCount > 0,
    },
    {
      title: 'Muddati yaqin (30 kun)',
      value: urgentSoonCount,
      percentage: summary.total > 0 ? Math.round((urgentSoonCount / summary.total) * 100) : 0,
      icon: Clock,
      activeFilter: 'soon',
      color: urgentSoonCount > 0 ? 'text-amber-700 dark:text-amber-400' : textStrong,
      barColor: 'bg-amber-600',
    },
    {
      title: 'Hujjatlari to‘liq va amalda',
      value: healthyCount,
      percentage: summary.total > 0 ? Math.round((healthyCount / summary.total) * 100) : 0,
      icon: CheckCircle2,
      activeFilter: '',
      color: textStrong,
      barColor: isLight ? 'bg-slate-700' : 'bg-slate-400',
    },
  ]

  const exportXlsx = async () => {
    if (sortedAndFiltered.length === 0) return
    try {
      await downloadXlsx({
        filename: `xalqaro-viza-propiska-${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: 'Viza va propiska',
        headers: [
          'Talaba',
          'Mamlakat',
          'Fakultet',
          'Kurs',
          'Telefon',
          'Viza raqami',
          'Viza berilgan',
          'Viza muddati',
          'Viza holati',
          'Viza qolgan kun',
          'Propiska muddati',
          'Propiska holati',
          'Propiska qolgan kun',
          'Propiska asosi',
          'Propiska manzili',
        ],
        rows: sortedAndFiltered.map((r) => [
          r.fullName,
          displayCountry(r.country),
          permitFacultyLabel(r.faculty),
          r.course ? `${r.course}-kurs` : '',
          r.phone ?? '',
          r.visa?.number || EMPTY_CELL,
          r.visa?.issuedOn ? fmtDate(r.visa.issuedOn) : EMPTY_CELL,
          r.visa ? fmtDate(r.visa.expiresOn) : EMPTY_CELL,
          healthText(r.visa),
          // Son sifatida: matn bo'lsa "-20" oldiga ' qo'yiladi (formulalardan himoya).
          // Hujjat bekor qilingan/kiritilmagan bo'lsa muddat hisobi ma'nosiz.
          r.visa && docHealth(r.visa) !== 'missing' ? r.visa.daysLeft : EMPTY_CELL,
          r.registration ? fmtDate(r.registration.expiresOn) : EMPTY_CELL,
          healthText(r.registration),
          r.registration && docHealth(r.registration) !== 'missing' ? r.registration.daysLeft : EMPTY_CELL,
          r.registration?.registrationBasis ? REGISTRATION_BASIS_LABELS[r.registration.registrationBasis] : EMPTY_CELL,
          r.registration?.address || EMPTY_CELL,
        ]),
      })
      toast.success('Excel fayl muvaffaqiyatli yuklab olindi!')
    } catch {
      toast.error('Faylni yuklab bo‘lmadi')
    }
  }

  // Kompyuterda: bosish paytidayoq yangi oyna ochiladi (so'rovdan keyin ochilsa
  // brauzer uni popup deb to'sadi), havola kelgach unga qo'yiladi.
  // Telefonda (va oyna ochilmasa): ilova ichidagi brauzerlar bo'sh oynani to'sadi
  // yoki bo'sh qoldiradi, shuning uchun havola shu oynada ochiladi. PDF yuklab
  // olinadi (sahifa joyida qoladi), rasm esa ochiladi ("Orqaga" bilan qaytiladi).
  const openScan = async (docId: string) => {
    const tab = isNarrow ? null : window.open('', '_blank')
    try {
      const url = await internationalDocFileUrl(docId)
      if (tab && !tab.closed) {
        tab.opener = null
        tab.location.href = url
      } else {
        window.location.assign(url)
      }
    } catch (error) {
      tab?.close()
      toast.error(error instanceof Error ? error.message : 'Faylni ochib bo‘lmadi')
    }
  }

  const handleCopyPhone = async (phone: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(phone)
    } catch {
      toast.error('Nusxalab bo‘lmadi. Raqamni qo‘lda belgilab oling.')
      return
    }
    setCopiedPhone(phone)
    toast.success('Telefon raqami nusxalandi!')
    setTimeout(() => setCopiedPhone(null), 2000)
  }

  // Dossier oynasi: Esc bilan yopiladi, ochiq turganda orqa sahifa aylanmaydi.
  useEffect(() => {
    if (!selectedStudent) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedStudent(null)
    }
    window.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [selectedStudent])

  const sortTh = (label: string, key: typeof sortBy, widthCls: string) => (
    <th scope="col" aria-sort={sortBy === key ? 'ascending' : 'none'} className={`px-3 py-3 font-extrabold ${widthCls}`}>
      <button
        type="button"
        onClick={() => setSortBy(sortBy === key ? 'urgency' : key)}
        className={`no-shelf inline-flex items-center gap-1.5 uppercase tracking-wider transition-colors ${
          sortBy === key ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'hover:text-slate-900 dark:hover:text-slate-100'
        }`}
        title={`${label} bo‘yicha saralash`}
      >
        <span>{label}</span>
        <ArrowUpDown size={11} className={sortBy === key ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-40'} />
      </button>
    </th>
  )

  const plainTh = (label: string, widthCls: string) => (
    <th scope="col" className={`px-3 py-3 font-extrabold uppercase tracking-wider ${widthCls}`}>
      {label}
    </th>
  )

  const hasActiveFilters =
    search !== '' || faculty !== '' || country !== '' || course !== '' || issue !== ''

  const resetFilters = () => {
    setSearch('')
    setFaculty('')
    setCountry('')
    setCourse('')
    setIssue('')
    setSortBy('urgency')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Hero Command Header (Institutional University Style) */}
      <div className={`no-shelf relative overflow-hidden rounded-2xl border p-5 sm:p-6 ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800'
      }`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.07]" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3.5">
            <div className={`flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-xl border shrink-0 ${
              isLight ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-800 text-slate-100 border-slate-700'
            }`}>
              <Globe2 size={24} strokeWidth={2} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 sm:mb-1.5">
                <span className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                  isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-200 border-slate-700'
                }`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Jami: {summary.total} nafar xorijiy talaba
                </span>
                <span className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                  isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800/80 text-slate-300 border-slate-700'
                }`}>
                  {distinctCountries.length} ta xorijiy davlat
                </span>
                {summary.anyIssue > 0 && (
                  <span className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                    isLight
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-amber-950/40 text-amber-300 border-amber-900/60'
                  }`}>
                    <AlertTriangle size={12} />
                    {summary.anyIssue} ta e’tibor talab
                  </span>
                )}
              </div>
              <h1 className={`text-lg sm:text-2xl leading-snug sm:leading-tight font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Xorijiy talabalar: Viza va Propiska monitoringi
              </h1>
              <p className={`mt-1 text-xs sm:text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Xorijiy talabalarning yashash va ta’lim olish muddatlari nazorati
              </p>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:items-center md:gap-2.5 md:self-center md:shrink-0">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className={`inline-flex items-center justify-center gap-2 px-3.5 py-2.5 md:py-2 rounded-xl border text-xs font-bold transition-colors disabled:opacity-50 no-shelf cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
              title="Ma'lumotlarni yangilash"
            >
              <RotateCcw size={13} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Yuklanmoqda...' : 'Yangilash'}</span>
            </button>

            <button
              type="button"
              onClick={exportXlsx}
              disabled={loading || sortedAndFiltered.length === 0}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 md:py-2 rounded-xl border font-bold text-xs transition-colors disabled:opacity-50 no-shelf cursor-pointer ${
                isLight
                  ? 'bg-indigo-600 hover:bg-indigo-700 border-indigo-600 text-white'
                  : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-900'
              }`}
              title="Excel jadvaliga eksport qilish"
            >
              <Download size={14} />
              <span>Excel ({sortedAndFiltered.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Emergency Alert Callout (If expired documents exist) */}
      <AnimatePresence>
        {criticalExpiredCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 sm:p-5 rounded-2xl border transition-all ${
              isLight
                ? 'bg-rose-50/70 border-rose-300 text-rose-950'
                : 'bg-rose-950/20 border-rose-900/60 text-rose-200 shadow-sm'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  isLight
                    ? 'bg-rose-100 text-rose-700 border-rose-300'
                    : 'bg-rose-950 text-rose-300 border-rose-800'
                }`}>
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-extrabold">
                      Muddati o‘tgan hujjatlar mavjud
                    </h3>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${
                      isLight
                        ? 'bg-rose-200/80 text-rose-900 border-rose-300'
                        : 'bg-rose-900/80 text-rose-200 border-rose-700'
                    }`}>
                      E’tibor talab
                    </span>
                  </div>
                  <p className="text-xs mt-1 text-slate-700 dark:text-slate-300">
                    {summary.visa.expired > 0 && (
                      <span className="font-semibold mr-2 text-rose-700 dark:text-rose-400">
                        • {summary.visa.expired} nafar talabaning viza muddati tugagan.
                      </span>
                    )}
                    {summary.registration.expired > 0 && (
                      <span className="font-semibold mr-2 text-rose-700 dark:text-rose-400">
                        • {summary.registration.expired} nafar talabaning propiska muddati tugagan.
                      </span>
                    )}
                    {urgentSoonCount > 0 && (
                      <span>
                        Yana {urgentSoonCount} nafar talabaning hujjati 30 kun ichida tugaydi.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0 sm:self-center">
                <button
                  type="button"
                  onClick={() => setIssue('expired')}
                  className="inline-flex w-full items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 no-shelf cursor-pointer sm:w-auto bg-rose-700 hover:bg-rose-800 text-white border border-rose-600/40"
                >
                  <AlertOctagon size={13} />
                  <span>Muddati o‘tganlarni ko‘rsatish</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Executive KPI Indicator Cards (Uniform Institutional Styling) */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {executiveStats.map((stat, idx) => {
          const Icon = stat.icon
          const isActive = issue === stat.activeFilter && stat.activeFilter !== ''
          const toggleStat = () => {
            if (stat.activeFilter) setIssue(issue === stat.activeFilter ? '' : (stat.activeFilter as IssueFilter))
          }
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={toggleStat}
              {...(stat.activeFilter
                ? { role: 'button', tabIndex: 0, 'aria-pressed': isActive, onKeyDown: activateOnKey(toggleStat) }
                : {})}
              className={`no-shelf p-4 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer active:scale-[0.98] ${
                isActive
                  ? isLight
                    ? 'border-slate-900 ring-2 ring-slate-900/10 bg-slate-50'
                    : 'border-slate-200 ring-2 ring-slate-200/10 bg-slate-900'
                  : ui.card
              } ${ui.hoverLift}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
                    {stat.title}
                  </p>
                  <p className={`text-2xl sm:text-3xl font-black mt-1.5 leading-none ${stat.color}`}>
                    {loading ? '—' : stat.value}
                  </p>
                </div>
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-transform ${
                    stat.alert
                      ? isLight
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-rose-950/60 text-rose-300 border-rose-900/60'
                      : isLight
                        ? 'bg-slate-100 text-slate-800 border-slate-200'
                        : 'bg-slate-800 text-slate-200 border-slate-700'
                  }`}
                >
                  <Icon size={18} strokeWidth={2} />
                </div>
              </div>

              {/* Progress track */}
              <div className="mt-3.5">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                  <span>Ulush</span>
                  <span>{loading ? '—' : `${stat.percentage}%`}</span>
                </div>
                <div className={`h-1.5 w-full rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: loading ? 0 : `${stat.percentage}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full ${stat.barColor}`}
                  />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Sub-segment Quick Filters (Pills) */}
      <div className={`p-3 rounded-2xl border space-y-2 ${ui.card}`}>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] font-extrabold uppercase tracking-wider ${textMuted}`}>
            Hujjat holati bo‘yicha tezkor saralash:
          </span>
          {issue && (
            <button
              type="button"
              onClick={() => setIssue('')}
              className={`text-xs font-bold hover:underline ${textStrong}`}
            >
              Barchasini ko‘rish
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:pb-0">
          {[
            { id: '', label: 'Barchasi', count: summary.total },
            { id: 'any', label: 'Diqqat talab', count: summary.anyIssue, tone: 'warning' },
            { id: 'visa-expired', label: 'Viza: Muddati o‘tgan', count: summary.visa.expired, tone: 'danger' },
            { id: 'visa-soon', label: 'Viza: 30 kun qoldi', count: summary.visa.soon, tone: 'warning' },
            { id: 'visa-missing', label: 'Viza: Kiritilmagan', count: summary.visa.missing, tone: 'neutral' },
            { id: 'reg-expired', label: 'Propiska: Muddati o‘tgan', count: summary.registration.expired, tone: 'danger' },
            { id: 'reg-soon', label: 'Propiska: 30 kun qoldi', count: summary.registration.soon, tone: 'warning' },
            { id: 'reg-missing', label: 'Propiska: Kiritilmagan', count: summary.registration.missing, tone: 'neutral' },
          ].map((item) => {
            const isActive = issue === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setIssue(item.id as IssueFilter)}
                className={`no-shelf inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 active:scale-95 ${
                  isActive
                    ? isLight
                      ? 'bg-slate-900 text-white font-extrabold'
                      : 'bg-slate-100 text-slate-900 font-extrabold'
                    : isLight
                      ? 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold ${
                    isActive
                      ? isLight
                        ? 'bg-slate-800 text-slate-200'
                        : 'bg-slate-200 text-slate-800'
                      : item.tone === 'danger' && item.count > 0
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                        : isLight
                          ? 'bg-white text-slate-600 border border-slate-200'
                          : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Advanced Search & Filtering Toolbar */}
      <div className={`p-4 rounded-2xl border space-y-3.5 ${ui.card}`}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Main Search Input */}
          <div className="relative md:col-span-4">
            <Search className="absolute left-3.5 top-3 text-slate-400 pointer-events-none" size={17} />
            <input
              type="text"
              placeholder="Ism, mamlakat, telefon, viza yoki manzil..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full rounded-xl border py-2.5 pl-10 pr-9 text-sm outline-none transition-all ${ui.input} ${ui.ring}`}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="no-shelf absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Faculty Select */}
          <div className="md:col-span-3">
            <CustomSelect
              value={faculty}
              onChange={setFaculty}
              className={`rounded-xl border px-3 py-2.5 text-sm ${ui.input}`}
              options={[
                { value: '', label: 'Barcha fakultetlar' },
                ...PERMIT_FACULTIES.map((f) => ({ value: f.value, label: f.label })),
              ]}
            />
          </div>

          {/* Country Select */}
          <div className="md:col-span-3">
            <CustomSelect
              value={country}
              onChange={setCountry}
              className={`rounded-xl border px-3 py-2.5 text-sm ${ui.input}`}
              options={[
                { value: '', label: 'Barcha davlatlar' },
                ...distinctCountries.map((c) => ({
                  value: c.name,
                  label: `${c.name} (${c.count})`,
                })),
              ]}
            />
          </div>

          {/* Sort Select */}
          <div className="md:col-span-2">
            <CustomSelect
              value={sortBy}
              onChange={(val) => setSortBy(val as typeof sortBy)}
              className={`rounded-xl border px-3 py-2.5 text-sm ${ui.input}`}
              options={[
                { value: 'urgency', label: 'Eng shoshilinch' },
                { value: 'name', label: 'Ism bo‘yicha' },
                { value: 'country', label: 'Davlat bo‘yicha' },
                { value: 'faculty', label: 'Fakultet bo‘yicha' },
                { value: 'visa', label: 'Viza muddati bo‘yicha' },
                { value: 'registration', label: 'Propiska muddati bo‘yicha' },
              ]}
            />
          </div>
        </div>

        {/* Second Row: Course Filter + View Mode Switcher + Clear Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
          {/* Course segmented pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider mr-0.5 ${textMuted}`}>
              Kurs:
            </span>
            <div
              className={`no-shelf flex max-w-full items-center overflow-x-auto p-1 rounded-xl border gap-1 ${
                isLight ? 'bg-slate-100/90 border-slate-200/80' : 'bg-slate-950/70 border-slate-800/90'
              }`}
            >
              {[
                { id: '', label: 'Barchasi', short: 'Barchasi' },
                { id: '1', label: '1-kurs', short: '1' },
                { id: '2', label: '2-kurs', short: '2' },
                { id: '3', label: '3-kurs', short: '3' },
                { id: '4', label: '4-kurs', short: '4' },
                { id: '5', label: 'Magistr', short: 'Mag.' },
              ].map((c) => {
                const isActive = course === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCourse(c.id)}
                    className={`no-shelf shrink-0 whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                      isActive
                        ? isLight
                          ? 'bg-slate-900 text-white font-black'
                          : 'bg-slate-100 text-slate-900 font-black'
                        : isLight
                          ? 'text-slate-600 hover:text-slate-900'
                          : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="sm:hidden">{c.short}</span>
                    <span className="hidden sm:inline">{c.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right side: View Mode Toggle & Reset */}
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className={`no-shelf inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                  isLight
                    ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                    : 'border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                }`}
              >
                <X size={13} />
                <span>Tozalash</span>
              </button>
            )}

            {/* View Switcher */}
            <div
              className={`no-shelf hidden items-center p-1 rounded-xl border gap-1 md:inline-flex ${
                isLight ? 'bg-slate-100/90 border-slate-200/80' : 'bg-slate-950/70 border-slate-800/90'
              }`}
            >
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`no-shelf inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'cards'
                    ? isLight
                      ? 'bg-slate-900 text-white font-black'
                      : 'bg-slate-100 text-slate-900 font-black'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-white'
                }`}
                title="Kartochkalar ko‘rinishi"
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline">Kartalar</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`no-shelf inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'table'
                    ? isLight
                      ? 'bg-slate-900 text-white font-black'
                      : 'bg-slate-100 text-slate-900 font-black'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-white'
                }`}
                title="Jadval ko‘rinishi"
              >
                <TableIcon size={14} />
                <span className="hidden sm:inline">Jadval</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Cards or Table */}
      {loading ? (
        <div className="py-20 text-center">
          <RotateCcw size={32} className={`animate-spin mx-auto mb-3 ${isLight ? 'text-slate-800' : 'text-slate-200'}`} />
          <p className={`text-sm font-bold ${textStrong}`}>Xorijiy talabalar ma’lumotlari yuklanmoqda...</p>
          <p className={`text-xs ${textMuted} mt-1`}>Iltimos, kuting</p>
        </div>
      ) : failed ? (
        <div className={`p-12 text-center rounded-2xl border ${ui.card}`}>
          <AlertOctagon size={40} className="mx-auto text-rose-500 mb-3" />
          <h3 className={`text-base font-black ${textStrong}`}>Ma’lumotlarni yuklab bo‘lmadi</h3>
          <p className={`text-xs ${textMuted} mt-1 max-w-md mx-auto`}>
            Server bilan bog‘lanishda xatolik yuz berdi. Internet aloqasini tekshiring yoki qayta urinib ko‘ring.
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold hover:bg-slate-800 transition-all no-shelf"
          >
            Qayta urinish
          </button>
        </div>
      ) : sortedAndFiltered.length === 0 ? (
        <div className={`p-16 text-center rounded-2xl border ${ui.card}`}>
          <Inbox size={44} className="mx-auto text-slate-400 mb-3 opacity-60" />
          <h3 className={`text-base font-black ${textStrong}`}>Mos keluvchi talaba topilmadi</h3>
          <p className={`text-xs ${textMuted} mt-1`}>
            Tanlangan filtrlar yoki qidiruv so‘zi bo‘yicha hech qanday natija mavjud emas.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 text-xs font-bold transition-all no-shelf"
            >
              Filtrlarni tozalash
            </button>
          )}
        </div>
      ) : activeView === 'cards' ? (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pageRows.map((student) => {
            const visaHealth = docHealth(student.visa)
            const regHealth = docHealth(student.registration)
            const countryName = displayCountry(student.country)
            const isCritical = visaHealth === 'expired' || regHealth === 'expired'
            const isWarning = visaHealth === 'soon' || regHealth === 'soon'

            return (
              <motion.div
                key={student.studentId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSelectedStudent(student)}
                role="button"
                tabIndex={0}
                onKeyDown={activateOnKey(() => setSelectedStudent(student))}
                className={`no-shelf p-4 sm:p-5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between group cursor-pointer active:scale-[0.99] ${
                  isCritical
                    ? isLight
                      ? 'border-slate-200 border-l-4 border-l-rose-600 bg-white'
                      : 'border-slate-800 border-l-4 border-l-rose-600 bg-slate-900/90 shadow-sm'
                    : isWarning
                      ? isLight
                        ? 'border-slate-200 border-l-4 border-l-amber-500 bg-white'
                        : 'border-slate-800 border-l-4 border-l-amber-500 bg-slate-900/90 shadow-sm'
                      : ui.card
                } ${ui.hoverLift}`}
              >
                {/* Top Card Row: Avatar + Country + Full Name */}
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border transition-transform group-hover:scale-105 ${
                          isCritical
                            ? isLight
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-rose-950/50 text-rose-300 border-rose-900/50'
                            : isLight
                              ? 'bg-slate-100 text-slate-800 border-slate-200'
                              : 'bg-slate-800 text-slate-200 border-slate-700'
                        }`}
                      >
                        {getInitials(student.fullName)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <CountryBadge country={student.country} isLight={isLight} />
                          <span className={`text-xs font-bold truncate ${textStrong}`}>
                            {countryName}
                          </span>
                          {student.course && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {student.course}-kurs
                            </span>
                          )}
                        </div>
                        <h4 className={`text-sm font-black tracking-tight truncate mt-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ${textStrong}`}>
                          {student.fullName}
                        </h4>
                      </div>
                    </div>

                    {/* Urgency Badge */}
                    {isCritical ? (
                      <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                        Muddati o‘tgan
                      </span>
                    ) : isWarning ? (
                      <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        30 kun qoldi
                      </span>
                    ) : (
                      <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        Amalda
                      </span>
                    )}
                  </div>

                  {/* Faculty & Phone details */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs gap-2">
                    <span className={`truncate ${textMuted} flex items-center gap-1.5`}>
                      <GraduationCap size={13} className="shrink-0 text-slate-400" />
                      {permitFacultyLabel(student.faculty) || 'Fakultet nomaʼlum'}
                    </span>

                    {student.phone ? (
                      <button
                        type="button"
                        onClick={(e) => handleCopyPhone(student.phone!, e)}
                        className={`no-shelf inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                          isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                        title="Telefon raqamidan nusxa olish"
                      >
                        <Phone size={11} className="text-slate-500" />
                        <span>{student.phone}</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Telefon yo‘q</span>
                    )}
                  </div>

                  {/* Dual Meters: VISA & PROPISKA */}
                  <div className="mt-3.5 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
                    {/* Visa Box */}
                    <div
                      className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                        isLight ? 'bg-slate-50/70 border-slate-200/80' : 'bg-slate-900/50 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${textMuted}`}>
                          Viza
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            visaHealth === 'expired'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : visaHealth === 'soon'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : visaHealth === 'ok'
                                  ? 'bg-slate-200/80 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400'
                          }`}
                        >
                          {healthText(student.visa)}
                        </span>
                      </div>

                      {student.visa && visaHealth !== 'missing' ? (
                        <div>
                          <p className={`text-xs font-bold ${textStrong}`}>
                            {fmtDate(student.visa.expiresOn)}
                          </p>
                          <p
                            className={`text-[11px] mt-0.5 ${
                              visaHealth === 'expired'
                                ? 'text-rose-700 dark:text-rose-400 font-bold'
                                : visaHealth === 'soon'
                                  ? 'text-amber-700 dark:text-amber-400 font-semibold'
                                  : textMuted
                            }`}
                          >
                            {daysText(student.visa.daysLeft)}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">Viza kiritilmagan</p>
                      )}

                      {student.visa?.hasFile && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void openScan(student.visa!.id)
                          }}
                          className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:underline"
                        >
                          <FileSearch size={11} /> Skan ko‘rish
                        </button>
                      )}
                    </div>

                    {/* Propiska Box */}
                    <div
                      className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                        isLight ? 'bg-slate-50/70 border-slate-200/80' : 'bg-slate-900/50 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${textMuted}`}>
                          Propiska
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            regHealth === 'expired'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : regHealth === 'soon'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : regHealth === 'ok'
                                  ? 'bg-slate-200/80 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400'
                          }`}
                        >
                          {healthText(student.registration)}
                        </span>
                      </div>

                      {student.registration && regHealth !== 'missing' ? (
                        <div>
                          <p className={`text-xs font-bold ${textStrong}`}>
                            {fmtDate(student.registration.expiresOn)}
                          </p>
                          <p
                            className={`text-[11px] mt-0.5 ${
                              regHealth === 'expired'
                                ? 'text-rose-700 dark:text-rose-400 font-bold'
                                : regHealth === 'soon'
                                  ? 'text-amber-700 dark:text-amber-400 font-semibold'
                                  : textMuted
                            }`}
                          >
                            {daysText(student.registration.daysLeft)}
                          </p>
                          {student.registration.registrationBasis && (
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {REGISTRATION_BASIS_LABELS[student.registration.registrationBasis]}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">Propiska yo‘q</p>
                      )}

                      {student.registration?.hasFile && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void openScan(student.registration!.id)
                          }}
                          className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:underline"
                        >
                          <FileSearch size={11} /> Skan ko‘rish
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Card Footer */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  <DetailButton onOpen={() => setSelectedStudent(student)} isLight={isLight} />
                  {student.phone && (
                    <a
                      href={`tel:${student.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className={`h-7 px-2.5 rounded-lg border flex items-center gap-1 text-[11px] font-bold transition-all active:scale-95 ${
                        isLight
                          ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                      title="Qo‘ng‘iroq qilish"
                    >
                      <Phone size={11} className="text-slate-500" /> Qo‘ng‘iroq
                    </a>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      ) : (
        /* REDESIGNED SPACIOUS, BEAUTIFUL & USER-FRIENDLY TABLE */
        <div className={`overflow-hidden rounded-3xl border shadow-sm ${ui.card}`}>
          {/* Table Header Bar with Counts and Legend */}
          <div
            className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 ${
              isLight ? 'border-slate-200/80 bg-slate-50/80' : 'border-slate-800/80 bg-slate-950/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <p className={`font-black text-sm tracking-tight ${textStrong}`}>
                Xorijiy talabalar monitoringi
              </p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums border ${
                  isLight
                    ? 'bg-slate-200/80 text-slate-800 border-slate-300'
                    : 'bg-slate-800 text-slate-200 border-slate-700'
                }`}
              >
                {sortedAndFiltered.length} nafar
              </span>
              {sortedAndFiltered.length !== rows.length && (
                <span className={`text-[11px] ${textMuted}`}>
                  (jami {rows.length} tadan saralandi)
                </span>
              )}
            </div>

            {/* Quick Status Legend */}
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-bold ${textMuted}`}>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Muddati o‘tgan ({criticalExpiredCount})
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                30 kun qoldi ({urgentSoonCount})
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Amalda ({healthyCount})
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-slate-500">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                Kiritilmagan
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left text-xs">
              <thead>
                <tr
                  className={`border-b text-[11px] uppercase tracking-wider font-extrabold ${textMuted} ${
                    isLight ? 'border-slate-200/90 bg-slate-100/70' : 'border-slate-800/90 bg-slate-900/70'
                  }`}
                >
                  <th scope="col" className="w-12 px-3 py-3.5 text-center font-bold">
                    №
                  </th>
                  {sortTh('Talaba (Ism)', 'name', 'w-[32%] min-w-[240px] pl-3')}
                  {plainTh('Telefon raqami', 'w-[18%] min-w-[140px] px-3.5')}
                  {sortTh('Viza', 'visa', 'w-[25%] min-w-[220px] px-3.5')}
                  {sortTh('Propiska', 'registration', 'w-[25%] min-w-[230px] px-3.5')}
                </tr>
              </thead>
              <tbody className={`divide-y ${ui.divide}`}>
                {pageRows.map((student, idx) => {
                  const rowNumber = (page - 1) * PAGE_SIZE + idx + 1
                  const visaHealth = docHealth(student.visa)
                  const regHealth = docHealth(student.registration)
                  const isCritical = visaHealth === 'expired' || regHealth === 'expired'
                  const isWarning = !isCritical && (visaHealth === 'soon' || regHealth === 'soon')
                  const isMissing = !isCritical && !isWarning && (visaHealth === 'missing' || regHealth === 'missing')
                  const accent = isCritical
                    ? 'bg-rose-500'
                    : isWarning
                      ? 'bg-amber-400'
                      : isMissing
                        ? 'bg-slate-300 dark:bg-slate-600'
                        : 'bg-emerald-400'

                  return (
                    <tr
                      key={student.studentId}
                      onClick={() => setSelectedStudent(student)}
                      tabIndex={0}
                      onKeyDown={activateOnKey(() => setSelectedStudent(student))}
                      className={`group cursor-pointer align-top transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/50 ${
                        isCritical
                          ? isLight
                            ? 'bg-rose-50/25 hover:bg-rose-50/70'
                            : 'bg-rose-950/15 hover:bg-rose-950/30'
                          : isWarning
                            ? isLight
                              ? 'bg-amber-50/20 hover:bg-amber-50/50'
                              : 'bg-amber-950/10 hover:bg-amber-950/25'
                            : isLight
                              ? 'hover:bg-slate-50/90'
                              : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* № and Accent Line */}
                      <td className="relative px-2.5 py-3.5 text-center align-middle">
                        <span
                          className={`absolute inset-y-2 left-0 w-1.5 rounded-r-md transition-colors ${accent}`}
                          aria-hidden="true"
                        />
                        <span className={`text-xs font-black tabular-nums ${textMuted}`}>
                          {rowNumber}
                        </span>
                      </td>

                      {/* 1. Talaba (Ism + Davlat + Kurs + Fakultet) */}
                      <td className="py-3.5 pl-3 pr-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-black border transition-transform group-hover:scale-105 ${
                              isCritical
                                ? isLight
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-rose-950/70 text-rose-300 border-rose-900/60'
                                : isWarning
                                  ? isLight
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-amber-950/70 text-amber-300 border-amber-900/60'
                                  : isLight
                                    ? 'bg-slate-100 text-slate-800 border-slate-200'
                                    : 'bg-slate-800 text-slate-200 border-slate-700'
                            }`}
                          >
                            {getInitials(student.fullName)}
                          </div>
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-black tracking-tight ${textStrong} group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors`}
                              title={student.fullName}
                            >
                              {student.fullName}
                            </p>

                            {/* Country & Course */}
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap text-xs">
                              <CountryBadge country={student.country} isLight={isLight} />
                              <span className={`font-semibold ${textMuted}`}>
                                {displayCountry(student.country)}
                              </span>
                              {student.course && (
                                <span
                                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                                    isLight ? 'bg-slate-100 text-slate-700 border border-slate-200/80' : 'bg-slate-800 text-slate-300 border border-slate-700'
                                  }`}
                                >
                                  {student.course}-kurs
                                </span>
                              )}
                            </div>

                            {/* Faculty */}
                            {student.faculty && (
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                <GraduationCap size={12} className="shrink-0 text-slate-400" />
                                <span className="truncate max-w-[220px]" title={permitFacultyLabel(student.faculty)}>
                                  {permitFacultyLabel(student.faculty)}
                                </span>
                              </div>
                            )}

                            {/* Batafsil tugmasi (Ism va ma'lumotlar ostida) */}
                            <div className="mt-3">
                              <DetailButton onOpen={() => setSelectedStudent(student)} isLight={isLight} />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Telefon raqami */}
                      <td className="px-3.5 py-3.5">
                        {student.phone ? (
                          <div className="space-y-1.5">
                            <span className={`font-mono text-xs font-bold tabular-nums block ${textStrong}`}>
                              {student.phone}
                            </span>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => void handleCopyPhone(student.phone!, e)}
                                className={`no-shelf inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                                  copiedPhone === student.phone
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                    : isLight
                                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                }`}
                                title="Raqamdan nusxa olish"
                              >
                                {copiedPhone === student.phone ? (
                                  <>
                                    <Check size={11} className="text-emerald-500" />
                                    <span>Nusxalandi</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={11} />
                                    <span>Nusxa</span>
                                  </>
                                )}
                              </button>

                              <a
                                href={`tel:${student.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className={`no-shelf inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                                  isLight
                                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    : 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800'
                                }`}
                                title="Qo‘ng‘iroq qilish"
                              >
                                <Phone size={11} />
                                <span>Qo‘ng‘iroq</span>
                              </a>
                            </div>
                          </div>
                        ) : (
                          <span className={`text-xs italic ${textMuted}`}>Telefon yo‘q</span>
                        )}
                      </td>

                      {/* 3. Viza nazorati */}
                      <td className="px-3.5 py-3.5 min-w-[210px]">
                        <UnifiedDocCell
                          doc={student.visa}
                          health={visaHealth}
                          isLight={isLight}
                          onScan={(id) => void openScan(id)}
                          type="visa"
                        />
                      </td>

                      {/* 4. Propiska nazorati */}
                      <td className="px-3.5 py-3.5 min-w-[220px]">
                        <UnifiedDocCell
                          doc={student.registration}
                          health={regHealth}
                          isLight={isLight}
                          onScan={(id) => void openScan(id)}
                          type="registration"
                          extra={
                            student.registration?.registrationBasis
                              ? REGISTRATION_BASIS_LABELS[student.registration.registrationBasis]
                              : null
                          }
                          address={student.registration?.address ?? null}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && sortedAndFiltered.length > PAGE_SIZE && (
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
            isLight ? 'bg-slate-50/80 border-slate-200/90' : 'bg-slate-900/60 border-slate-800'
          }`}
        >
          <p className={`text-xs ${textMuted}`}>
            Jami <span className="font-bold">{sortedAndFiltered.length}</span> tadan{' '}
            <span className="font-bold">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedAndFiltered.length)}</span> ko‘rsatilmoqda
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={`no-shelf inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-40 active:scale-95 ${
                isLight ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'
              }`}
            >
              <ChevronLeft size={14} /> Oldingi
            </button>

            <span className={`text-xs font-black px-2 ${textStrong}`}>
              {page} / {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={`no-shelf inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-40 active:scale-95 ${
                isLight ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'
              }`}
            >
              Keyingi <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Student Dossier Modal */}
      <AnimatePresence>
        {selectedStudent && (
          <motion.div
            key="student-dossier"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedStudent(null)
            }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-md sm:items-center sm:p-4 md:p-6"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`${selectedStudent.fullName} — viza va propiska ma’lumotlari`}
              initial={{ opacity: 0, scale: 0.97, y: 28 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 28 }}
              transition={{ duration: 0.18 }}
              className={`w-full max-w-2xl rounded-t-3xl border border-b-0 backdrop-blur-xl relative flex flex-col max-h-[94vh] shadow-2xl overflow-hidden sm:rounded-3xl sm:border-b sm:max-h-[92vh] ${
                isLight ? 'bg-white border-slate-200/90 shadow-slate-900/20' : 'bg-slate-950 border-slate-800/90 shadow-black'
              }`}
            >
              {/* Modal Header */}
              <div
                className={`px-4 sm:px-6 py-3.5 sm:py-4 border-b flex items-center justify-between gap-3 sm:gap-4 shrink-0 ${
                  isLight ? 'border-slate-100 bg-slate-50/80' : 'border-slate-800/70 bg-slate-900/50'
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                  <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-bold text-sm sm:text-base shrink-0 border ${
                    isLight ? 'bg-slate-900 text-white border-slate-700' : 'bg-slate-800 text-slate-100 border-slate-700'
                  }`}>
                    {getInitials(selectedStudent.fullName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CountryBadge country={selectedStudent.country} isLight={isLight} />
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {displayCountry(selectedStudent.country)} fuqarosi
                      </span>
                      {selectedStudent.course && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {selectedStudent.course}-kurs
                        </span>
                      )}
                    </div>
                    <h3 className={`text-base sm:text-lg font-black tracking-tight truncate mt-0.5 ${textStrong}`}>
                      {selectedStudent.fullName}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className={`no-shelf p-2 rounded-xl transition-colors ${
                    isLight ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title="Yopish"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 sm:space-y-4">
                {/* Contact & Faculty Row */}
                <div className={`p-4 rounded-2xl border grid grid-cols-1 sm:grid-cols-2 gap-3 ${isLight ? 'bg-slate-50/60 border-slate-200/80' : 'bg-slate-900/40 border-slate-800/80'}`}>
                  <div>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>Fakultet:</p>
                    <p className={`text-xs font-black mt-0.5 ${textStrong}`}>
                      {permitFacultyLabel(selectedStudent.faculty) || 'Biriktirilmagan'}
                    </p>
                  </div>
                  <div>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>Telefon raqami:</p>
                    {selectedStudent.phone ? (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs font-black ${textStrong}`}>{selectedStudent.phone}</span>
                        <a
                          href={`tel:${selectedStudent.phone}`}
                          className="text-xs text-slate-700 dark:text-slate-300 hover:underline font-bold inline-flex items-center gap-1"
                        >
                          <Phone size={11} className="text-slate-500" /> Qo‘ng‘iroq
                        </a>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic mt-0.5">Telefon ko‘rsatilmagan</p>
                    )}
                  </div>
                </div>

                {/* Section 1: VISA DOSSIER */}
                <div
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isLight ? 'bg-white border-slate-200/90' : 'bg-slate-900/70 border-slate-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b pb-2.5 border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs ${
                        isLight ? 'bg-slate-900 text-white' : 'bg-slate-800 text-slate-200'
                      }`}>
                        V
                      </div>
                      <h4 className={`text-xs font-black uppercase tracking-wider ${textStrong}`}>
                        Viza ma’lumotlari
                      </h4>
                    </div>

                    <span
                      className={`shrink-0 whitespace-nowrap px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                        docHealth(selectedStudent.visa) === 'expired'
                          ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-900'
                          : docHealth(selectedStudent.visa) === 'soon'
                            ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900'
                            : docHealth(selectedStudent.visa) === 'ok'
                              ? 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                              : 'bg-slate-100/60 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
                      }`}
                    >
                      {healthText(selectedStudent.visa)}
                    </span>
                  </div>

                  {selectedStudent.visa && docHealth(selectedStudent.visa) !== 'missing' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Viza raqami:</p>
                        <p className={`font-mono font-bold mt-0.5 ${textStrong}`}>
                          {selectedStudent.visa.number || '—'}
                        </p>
                      </div>
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Amal qilish muddati:</p>
                        <p className={`font-bold mt-0.5 ${textStrong}`}>
                          {fmtDate(selectedStudent.visa.expiresOn)}
                        </p>
                      </div>
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Qolgan kunlar:</p>
                        <p
                          className={`font-black mt-0.5 ${
                            docHealth(selectedStudent.visa) === 'expired'
                              ? 'text-rose-700 dark:text-rose-400'
                              : docHealth(selectedStudent.visa) === 'soon'
                                ? 'text-amber-700 dark:text-amber-400'
                                : textStrong
                          }`}
                        >
                          {daysText(selectedStudent.visa.daysLeft)}
                        </p>
                      </div>

                      {selectedStudent.visa.hasFile && (
                        <div className="col-span-2 sm:col-span-3 pt-2">
                          <button
                            type="button"
                            onClick={() => void openScan(selectedStudent.visa!.id)}
                            className={`inline-flex w-full items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 no-shelf cursor-pointer sm:w-auto sm:py-2 ${
                              isLight
                                ? 'bg-slate-900 hover:bg-slate-800 text-white'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                            }`}
                          >
                            <FileSearch size={14} />
                            <span>Viza skanerini ochish</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-2 text-center text-xs text-slate-400 italic">
                      Ushbu talaba uchun viza ma’lumotlari hali tizimga kiritilmagan.
                    </div>
                  )}
                </div>

                {/* Section 2: PROPISKA DOSSIER */}
                <div
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isLight ? 'bg-white border-slate-200/90' : 'bg-slate-900/70 border-slate-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b pb-2.5 border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs ${
                        isLight ? 'bg-slate-900 text-white' : 'bg-slate-800 text-slate-200'
                      }`}>
                        P
                      </div>
                      <h4 className={`text-xs font-black uppercase tracking-wider ${textStrong}`}>
                        Ro‘yxatga qo‘yish (Propiska)
                      </h4>
                    </div>

                    <span
                      className={`shrink-0 whitespace-nowrap px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                        docHealth(selectedStudent.registration) === 'expired'
                          ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-900'
                          : docHealth(selectedStudent.registration) === 'soon'
                            ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900'
                            : docHealth(selectedStudent.registration) === 'ok'
                              ? 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                              : 'bg-slate-100/60 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
                      }`}
                    >
                      {healthText(selectedStudent.registration)}
                    </span>
                  </div>

                  {selectedStudent.registration && docHealth(selectedStudent.registration) !== 'missing' ? (
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Propiska asosi:</p>
                          <p className={`font-bold mt-0.5 ${textStrong}`}>
                            {selectedStudent.registration.registrationBasis
                              ? REGISTRATION_BASIS_LABELS[selectedStudent.registration.registrationBasis]
                              : '—'}
                          </p>
                        </div>
                        <div>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Amal qilish muddati:</p>
                          <p className={`font-bold mt-0.5 ${textStrong}`}>
                            {fmtDate(selectedStudent.registration.expiresOn)}
                          </p>
                        </div>
                        <div>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Qolgan kunlar:</p>
                          <p
                            className={`font-black mt-0.5 ${
                              docHealth(selectedStudent.registration) === 'expired'
                                ? 'text-rose-700 dark:text-rose-400'
                                : docHealth(selectedStudent.registration) === 'soon'
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : textStrong
                            }`}
                          >
                            {daysText(selectedStudent.registration.daysLeft)}
                          </p>
                        </div>
                      </div>

                      {selectedStudent.registration.address && (
                        <div>
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Ro‘yxatdan o‘tgan manzili:</p>
                          <p className={`font-semibold mt-0.5 flex items-start gap-1.5 ${textStrong}`}>
                            <MapPin size={13} className="text-slate-500 shrink-0 mt-0.5" />
                            <span>{selectedStudent.registration.address}</span>
                          </p>
                        </div>
                      )}

                      {selectedStudent.registration.hasFile && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => void openScan(selectedStudent.registration!.id)}
                            className={`inline-flex w-full items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 no-shelf cursor-pointer sm:w-auto sm:py-2 ${
                              isLight
                                ? 'bg-slate-900 hover:bg-slate-800 text-white'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                            }`}
                          >
                            <FileSearch size={14} />
                            <span>Propiska skanerini ochish</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-2 text-center text-xs text-slate-400 italic">
                      Ushbu talaba uchun propiska ma’lumotlari hali tizimga kiritilmagan.
                    </div>
                  )}
                </div>

                {/* Section 3: Legal Warning & Rules for International Office */}
                <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                  isLight ? 'bg-slate-50 border-slate-200/90 text-slate-700' : 'bg-slate-900/60 border-slate-800 text-slate-300'
                }`}>
                  <Info size={17} className="text-slate-500 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className={`font-bold ${textStrong}`}>Eslatma</p>
                    <p className={textMuted}>
                      Ma’lumotlarni talabalar o‘zlari kiritgan hujjatlar asosida ko‘rsatiladi. Muddatlarni o‘z vaqtida uzaytirish uchun talabani muddat tugashidan oldin ogohlantiring; ma’lumot noto‘g‘ri bo‘lsa, skanerni ochib tekshiring.
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                className={`px-4 sm:px-6 pt-3 sm:py-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3.5 border-t flex items-center justify-between gap-3 shrink-0 ${
                  isLight ? 'border-slate-100 bg-slate-50/80' : 'border-slate-800/70 bg-slate-900/50'
                }`}
              >
                <span className="hidden text-xs text-slate-500 italic sm:block">
                  O‘zMU Xalqaro bo‘lim · Faqat ko‘rish
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className={`w-full py-2.5 px-5 rounded-xl text-xs font-bold transition-all no-shelf cursor-pointer active:scale-95 sm:w-auto sm:py-2 ${
                    isLight ? 'bg-slate-900 hover:bg-slate-800 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  Yopish
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
