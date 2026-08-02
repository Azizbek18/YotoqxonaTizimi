'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  RotateCcw,
  Search,
  Users,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import CustomSelect from '@/components/ui/CustomSelect'
import { useThemeStore } from '@/lib/stores/theme-store'
import { fetchFacultyPayments, fetchFacultyStudents } from '@/features/faculty-students/client/api'
import type { FacultyPaymentRecord, StudentProfileRow } from '@/features/faculty-students/types'
import {
  PAY_STATE_BADGE_CLASSES,
  PAY_STATE_LABELS,
  buildPaySummaries,
  formatSum,
} from '@/features/faculty-students/domain/payment-summary'
import { fetchAppSettings } from '@/features/app-settings/client/api'
import { downloadXlsx } from '@/lib/spreadsheet-export'
import {
  buildStudentReportCsv,
  buildStudentReportTable,
  downloadTextFile,
} from '@/lib/student-report-table'
import { extractFloor } from '@/lib/floor'
import { genderLabel, normalizeGender } from '@/lib/gender'
import { directionLabel, normalizeDirection } from '@/lib/directions'

type PayFilter = '' | 'paid' | 'debtor' | 'unpaid' | 'waiting'
type PlacementFilter = '' | 'placed' | 'roomless'

type Filters = {
  search: string
  placement: PlacementFilter
  gender: string
  pay: PayFilter
  nationality: string
  course: string
  floor: string
  direction: string
  studyType: string
  region: string
  onlyCaptains: boolean
  onlyWarned: boolean
}

const EMPTY_FILTERS: Filters = {
  search: '',
  placement: '',
  gender: '',
  pay: '',
  nationality: '',
  course: '',
  floor: '',
  direction: '',
  studyType: '',
  region: '',
  onlyCaptains: false,
  onlyWarned: false,
}

const PAY_FILTER_LABELS: Record<Exclude<PayFilter, ''>, string> = {
  paid: "To'liq to'laganlar",
  debtor: "Qarzdorlar (to'liq to'lamaganlar)",
  unpaid: "Umuman to'lov qilmaganlar",
  waiting: 'Tasdiqlanmagan cheki borlar',
}

const PLACEMENT_FILTER_LABELS: Record<Exclude<PlacementFilter, ''>, string> = {
  placed: 'Xonaga joylashganlar',
  roomless: 'Xonasiz talabalar',
}

// Distinct, alphabetically ordered values of a text column — the filter
// options are built from the actual data rather than a hardcoded list, so a
// nationality or direction nobody anticipated still becomes selectable.
function distinctValues(students: readonly StudentProfileRow[], pick: (row: StudentProfileRow) => string | null) {
  const seen = new Set<string>()
  for (const student of students) {
    const value = (pick(student) ?? '').trim()
    if (value) seen.add(value)
  }
  return [...seen].sort((a, b) => a.localeCompare(b, 'uz'))
}

export default function DekanReportsPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const [students, setStudents] = useState<StudentProfileRow[]>([])
  const [payments, setPayments] = useState<FacultyPaymentRecord[]>([])
  const [yearlyContractFee, setYearlyContractFee] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [studentRows, paymentRows, settings] = await Promise.all([
        // 'all' — xonasiz talabalar ham eksportga kirishi uchun; kesim
        // sahifadagi "Joylashuv" filtri orqali tanlanadi.
        fetchFacultyStudents('all'),
        fetchFacultyPayments(),
        fetchAppSettings(),
      ])
      setStudents(studentRows)
      setPayments(paymentRows)
      setYearlyContractFee(settings.yearlyContractFee)
    } catch (error) {
      console.error("Hisobot ma'lumotlarini yuklashda xato:", error)
      toast.error(error instanceof Error ? error.message : "Ma'lumotlarni yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // null while the contract fee is unknown — the payment filters depend
  // entirely on it, so they stay disabled rather than silently returning
  // everyone as a debtor.
  const paySummaries = useMemo(
    () => (yearlyContractFee === null ? null : buildPaySummaries(students, payments, yearlyContractFee)),
    [students, payments, yearlyContractFee]
  )

  const nationalities = useMemo(() => distinctValues(students, (s) => s.nationality), [students])
  // Kanonik qiymat bo'yicha guruhlanadi — aks holda "amaliy-matematika" va
  // "Amaliy matematika" ro'yxatda ikkita alohida yo'nalish bo'lib chiqardi.
  const directions = useMemo(() => distinctValues(students, (s) => normalizeDirection(s.direction) ?? s.direction), [students])
  const studyTypes = useMemo(() => distinctValues(students, (s) => s.study_type), [students])
  const regions = useMemo(() => distinctValues(students, (s) => s.region), [students])
  const courses = useMemo(
    () =>
      [...new Set(students.map((s) => s.course).filter((c): c is number => typeof c === 'number'))].sort(
        (a, b) => a - b
      ),
    [students]
  )
  const floors = useMemo(
    () =>
      [...new Set(students.map((s) => extractFloor(s.room_number)).filter((f): f is number => f !== null))].sort(
        (a, b) => a - b
      ),
    [students]
  )

  const filteredStudents = useMemo(() => {
    const query = filters.search.trim().toLowerCase()

    return students.filter((student) => {
      if (query) {
        const haystack = `${student.full_name} ${student.room_number ?? ''} ${student.email ?? ''}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      if (filters.placement === 'placed' && !student.room_number) return false
      if (filters.placement === 'roomless' && student.room_number) return false
      if (filters.gender && normalizeGender(student.gender) !== filters.gender) return false
      if (filters.nationality && (student.nationality ?? '').trim() !== filters.nationality) return false
      if (filters.direction && (normalizeDirection(student.direction) ?? (student.direction ?? '').trim()) !== filters.direction) return false
      if (filters.studyType && (student.study_type ?? '').trim() !== filters.studyType) return false
      if (filters.region && (student.region ?? '').trim() !== filters.region) return false
      if (filters.course && String(student.course ?? '') !== filters.course) return false
      if (filters.floor && String(extractFloor(student.room_number) ?? '') !== filters.floor) return false
      if (filters.onlyCaptains && !student.is_floor_captain) return false
      if (filters.onlyWarned && (student.warning_count ?? 0) === 0) return false

      if (filters.pay) {
        const summary = paySummaries?.get(student.id)
        if (!summary) return false
        if (filters.pay === 'paid' && summary.state !== 'paid') return false
        if (filters.pay === 'debtor' && summary.state === 'paid') return false
        if (filters.pay === 'unpaid' && summary.state !== 'none') return false
        if (filters.pay === 'waiting' && !summary.hasWaiting) return false
      }

      return true
    })
  }, [students, filters, paySummaries])

  const activeFilterChips = useMemo(() => {
    const chips: { key: keyof Filters; label: string }[] = []
    if (filters.search) chips.push({ key: 'search', label: `Qidiruv: ${filters.search}` })
    if (filters.placement) chips.push({ key: 'placement', label: PLACEMENT_FILTER_LABELS[filters.placement] })
    if (filters.gender) chips.push({ key: 'gender', label: filters.gender === 'male' ? "O'g'il bolalar" : 'Qiz bolalar' })
    if (filters.pay) chips.push({ key: 'pay', label: PAY_FILTER_LABELS[filters.pay] })
    if (filters.nationality) chips.push({ key: 'nationality', label: `Millati: ${filters.nationality}` })
    if (filters.course) chips.push({ key: 'course', label: `${filters.course}-kurs` })
    if (filters.floor) chips.push({ key: 'floor', label: `${filters.floor}-qavat` })
    if (filters.direction) chips.push({ key: 'direction', label: `Yo'nalish: ${directionLabel(filters.direction)}` })
    if (filters.studyType) chips.push({ key: 'studyType', label: `Moliya turi: ${filters.studyType}` })
    if (filters.region) chips.push({ key: 'region', label: `Viloyat: ${filters.region}` })
    if (filters.onlyCaptains) chips.push({ key: 'onlyCaptains', label: 'Faqat qavat sardorlari' })
    if (filters.onlyWarned) chips.push({ key: 'onlyWarned', label: 'Faqat ogohlantirilganlar' })
    return chips
  }, [filters])

  const placedCount = students.filter((student) => Boolean(student.room_number)).length
  const roomlessCount = students.length - placedCount
  const selectedRoomlessCount = filteredStudents.filter((student) => !student.room_number).length

  const selectionDebt = useMemo(() => {
    if (!paySummaries) return null
    return filteredStudents.reduce((sum, student) => sum + (paySummaries.get(student.id)?.remaining ?? 0), 0)
  }, [filteredStudents, paySummaries])

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }))

  const clearFilter = (key: keyof Filters) => setFilters((prev) => ({ ...prev, [key]: EMPTY_FILTERS[key] }))

  // Filename says what's inside — a folder full of "talabalar.xlsx" is
  // useless once three different cuts have been exported.
  const fileSlug = () => {
    const parts: string[] = []
    if (filters.placement) parts.push(filters.placement === 'placed' ? 'joylashgan' : 'xonasiz')
    if (filters.pay) parts.push(filters.pay)
    if (filters.gender) parts.push(filters.gender === 'male' ? 'ogil' : 'qiz')
    if (filters.nationality) parts.push(filters.nationality.toLowerCase().replace(/\s+/g, '-'))
    if (filters.course) parts.push(`${filters.course}-kurs`)
    if (filters.floor) parts.push(`${filters.floor}-qavat`)
    if (filters.onlyCaptains) parts.push('sardorlar')
    if (filters.onlyWarned) parts.push('ogohlantirilgan')
    const suffix = parts.length ? `_${parts.join('_')}` : ''
    return `talabalar${suffix}_${new Date().toISOString().slice(0, 10)}`
  }

  const exportTable = (format: 'excel' | 'csv') => {
    if (filteredStudents.length === 0) {
      toast.error("Tanlangan filtrlar bo'yicha talaba topilmadi")
      return
    }
    const toastId = toast.loading("Fayl tayyorlanmoqda...")
    try {
      const { headers, rawRows, displayRows, merges } = buildStudentReportTable(filteredStudents)

      if (format === 'excel') {
        downloadXlsx({
          filename: `${fileSlug()}.xlsx`,
          sheetName: 'Hisobot',
          headers,
          rows: displayRows,
          merges,
        })
        toast.success('Excel fayl yuklab olindi', { id: toastId })
        return
      }

      downloadTextFile(`${fileSlug()}.csv`, buildStudentReportCsv(headers, rawRows), 'text/csv;charset=utf-8;')
      toast.success('CSV fayl yuklab olindi', { id: toastId })
    } catch (error) {
      console.error('Eksport xatosi:', error)
      toast.error(error instanceof Error ? error.message : 'Eksportda xatolik', { id: toastId })
    }
  }

  const surface = isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-[#0b1120]/50 border-white/10'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const selectClass = isLight
    ? 'rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs'
    : 'rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs'

  const presets: { label: string; apply: () => void; tone: string }[] = [
    {
      label: "To'lov qilmaganlar",
      tone: 'border-rose-500/30 bg-rose-500/10 text-rose-500',
      apply: () => setFilters({ ...EMPTY_FILTERS, pay: 'unpaid' }),
    },
    {
      label: 'Xonasiz talabalar',
      tone: 'border-slate-400/30 bg-slate-400/10 text-slate-500 dark:text-slate-300',
      apply: () => setFilters({ ...EMPTY_FILTERS, placement: 'roomless' }),
    },
    {
      label: 'Qarzdorlar',
      tone: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
      apply: () => setFilters({ ...EMPTY_FILTERS, pay: 'debtor' }),
    },
    {
      label: "O'g'il bolalar",
      tone: 'border-sky-500/30 bg-sky-500/10 text-sky-500',
      apply: () => setFilters({ ...EMPTY_FILTERS, gender: 'male' }),
    },
    {
      label: 'Qiz bolalar',
      tone: 'border-pink-500/30 bg-pink-500/10 text-pink-500',
      apply: () => setFilters({ ...EMPTY_FILTERS, gender: 'female' }),
    },
    {
      label: 'Qavat sardorlari',
      tone: 'border-violet-500/30 bg-violet-500/10 text-violet-500',
      apply: () => setFilters({ ...EMPTY_FILTERS, onlyCaptains: true }),
    },
    {
      label: 'Ogohlantirilganlar',
      tone: 'border-orange-500/30 bg-orange-500/10 text-orange-500',
      apply: () => setFilters({ ...EMPTY_FILTERS, onlyWarned: true }),
    },
  ]

  const previewRows = filteredStudents.slice(0, 8)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={`flex items-center gap-3 text-2xl font-black tracking-tighter sm:text-3xl ${textStrong}`}>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.12)]">
              <FileSpreadsheet size={28} />
            </div>
            Hisobot va eksport
          </h1>
          <p className={`mt-2 text-sm ${textMuted}`}>
            Fakultet talabalarini kerakli kesimda tanlab, admin paneldagi jadval bilan bir xil ko&apos;rinishda yuklab
            oling
          </p>
        </div>

        <button
          onClick={() => void load()}
          disabled={loading}
          className={`inline-flex items-center justify-center rounded-xl border p-3 transition-all disabled:opacity-50 ${
            isLight
              ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
          title="Yangilash"
        >
          <motion.div
            animate={loading ? { rotate: 360 } : {}}
            transition={loading ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}
          >
            <RotateCcw size={18} />
          </motion.div>
        </button>
      </div>

      {/* Quick presets */}
      <div className={`rounded-3xl border p-5 ${surface}`}>
        <h3 className={`mb-3 text-[10px] font-black uppercase tracking-[0.2em] ${textMuted}`}>Tez tanlov</h3>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={preset.apply}
              className={`rounded-xl border px-3 py-2 text-[11px] font-bold transition-all hover:scale-[1.03] active:scale-95 ${preset.tone}`}
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className={`rounded-xl border px-3 py-2 text-[11px] font-bold transition-all hover:scale-[1.03] active:scale-95 ${
              isLight ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-white/10 bg-white/5 text-slate-400'
            }`}
          >
            Filtrlarni tozalash
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-3xl border p-5 ${surface}`}>
        <h3 className={`mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] ${textMuted}`}>
          <Filter size={13} />
          Batafsil filtrlar
        </h3>

        <div className="relative mb-4">
          <Search size={16} className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${textMuted}`} />
          <input
            type="text"
            placeholder="Ism, xona yoki email bo'yicha qidirish..."
            value={filters.search}
            onChange={(event) => setFilter('search', event.target.value)}
            className={`w-full rounded-2xl border py-3 pl-11 pr-10 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
              isLight ? 'border-slate-200 bg-slate-50 text-slate-900' : 'border-white/10 bg-white/5 text-white'
            }`}
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => clearFilter('search')}
              aria-label="Qidiruvni tozalash"
              className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition-colors hover:bg-slate-200/70 dark:hover:bg-white/10 ${textMuted}`}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label className={`block text-[10px] font-black uppercase tracking-wider ${textMuted}`}>Joylashuv</label>
            <CustomSelect
              value={filters.placement}
              onChange={(value) => setFilter('placement', value as PlacementFilter)}
              className={selectClass}
              options={[
                { value: '', label: `Barchasi (${students.length})` },
                { value: 'placed', label: `${PLACEMENT_FILTER_LABELS.placed} (${placedCount})` },
                { value: 'roomless', label: `${PLACEMENT_FILTER_LABELS.roomless} (${roomlessCount})` },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className={`block text-[10px] font-black uppercase tracking-wider ${textMuted}`}>Jinsi</label>
            <CustomSelect
              value={filters.gender}
              onChange={(value) => setFilter('gender', value)}
              className={selectClass}
              options={[
                { value: '', label: 'Barchasi' },
                { value: 'male', label: "O'g'il bolalar" },
                { value: 'female', label: 'Qiz bolalar' },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className={`block text-[10px] font-black uppercase tracking-wider ${textMuted}`}>
              To&apos;lov holati
            </label>
            <CustomSelect
              value={filters.pay}
              onChange={(value) => setFilter('pay', value as PayFilter)}
              className={selectClass}
              disabled={!paySummaries}
              placeholder={paySummaries ? 'Barchasi' : 'Shartnoma summasi yuklanmadi'}
              options={[
                { value: '', label: 'Barchasi' },
                ...(Object.keys(PAY_FILTER_LABELS) as Exclude<PayFilter, ''>[]).map((key) => ({
                  value: key,
                  label: PAY_FILTER_LABELS[key],
                })),
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className={`block text-[10px] font-black uppercase tracking-wider ${textMuted}`}>Millati</label>
            <CustomSelect
              value={filters.nationality}
              onChange={(value) => setFilter('nationality', value)}
              className={selectClass}
              options={[
                { value: '', label: 'Barchasi' },
                ...nationalities.map((value) => ({ value, label: value })),
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className={`block text-[10px] font-black uppercase tracking-wider ${textMuted}`}>Kursi</label>
            <CustomSelect
              value={filters.course}
              onChange={(value) => setFilter('course', value)}
              className={selectClass}
              options={[
                { value: '', label: 'Barchasi' },
                ...courses.map((course) => ({ value: String(course), label: `${course}-kurs` })),
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className={`block text-[10px] font-black uppercase tracking-wider ${textMuted}`}>Qavati</label>
            <CustomSelect
              value={filters.floor}
              onChange={(value) => setFilter('floor', value)}
              className={selectClass}
              options={[
                { value: '', label: 'Barchasi' },
                ...floors.map((floor) => ({ value: String(floor), label: `${floor}-qavat` })),
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className={`block text-[10px] font-black uppercase tracking-wider ${textMuted}`}>
              Yo&apos;nalish
            </label>
            <CustomSelect
              value={filters.direction}
              onChange={(value) => setFilter('direction', value)}
              className={selectClass}
              options={[{ value: '', label: 'Barchasi' }, ...directions.map((value) => ({ value, label: directionLabel(value) }))]}
            />
          </div>

          <div className="space-y-1.5">
            <label className={`block text-[10px] font-black uppercase tracking-wider ${textMuted}`}>Moliya turi</label>
            <CustomSelect
              value={filters.studyType}
              onChange={(value) => setFilter('studyType', value)}
              className={selectClass}
              options={[{ value: '', label: 'Barchasi' }, ...studyTypes.map((value) => ({ value, label: value }))]}
            />
          </div>

          <div className="space-y-1.5">
            <label className={`block text-[10px] font-black uppercase tracking-wider ${textMuted}`}>Viloyati</label>
            <CustomSelect
              value={filters.region}
              onChange={(value) => setFilter('region', value)}
              className={selectClass}
              options={[{ value: '', label: 'Barchasi' }, ...regions.map((value) => ({ value, label: value }))]}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { key: 'onlyCaptains' as const, label: 'Faqat qavat sardorlari' },
            { key: 'onlyWarned' as const, label: 'Faqat ogohlantirilgan talabalar' },
          ].map((toggle) => (
            <button
              key={toggle.key}
              onClick={() => setFilter(toggle.key, !filters[toggle.key])}
              className={`rounded-xl border px-3 py-2 text-[11px] font-bold transition-all ${
                filters[toggle.key]
                  ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-500 dark:text-indigo-300'
                  : isLight
                    ? 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              {toggle.label}
            </button>
          ))}
        </div>

        {activeFilterChips.length > 0 && (
          <div className={`mt-4 flex flex-wrap items-center gap-2 border-t pt-4 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
            <span className={`text-[10px] font-black uppercase tracking-wider ${textMuted}`}>Faol filtrlar:</span>
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => clearFilter(chip.key)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors ${
                  isLight
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                    : 'border-indigo-500/25 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
                }`}
              >
                {chip.label}
                <X size={11} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selection summary + download */}
      <div className={`rounded-3xl border p-5 ${surface}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-tr from-indigo-500 to-violet-600 text-white shadow-lg">
                <Users size={19} />
              </div>
              <div>
                <p className={`text-2xl font-black leading-none ${textStrong}`}>
                  {loading ? '...' : filteredStudents.length}
                </p>
                <p className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>
                  Tanlangan talaba (jami {students.length})
                  {selectedRoomlessCount > 0 && ` • ${selectedRoomlessCount} tasi xonasiz`}
                </p>
              </div>
            </div>

            {selectionDebt !== null && (
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-tr from-amber-500 to-orange-600 text-white shadow-lg">
                  <AlertTriangle size={19} />
                </div>
                <div>
                  <p className={`text-2xl font-black leading-none ${textStrong}`}>
                    {loading ? '...' : formatSum(selectionDebt)}
                  </p>
                  <p className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>
                    Tanlanganlarning jami qarzi
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => exportTable('excel')}
              disabled={loading || filteredStudents.length === 0}
              className="flex items-center gap-2 rounded-xl bg-linear-to-r from-emerald-500 to-teal-600 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-white shadow-lg transition-all hover:from-emerald-600 hover:to-teal-700 active:scale-95 disabled:opacity-50"
            >
              <FileSpreadsheet size={16} />
              Excel yuklab olish
            </button>
            <button
              onClick={() => exportTable('csv')}
              disabled={loading || filteredStudents.length === 0}
              className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 ${
                isLight
                  ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
              }`}
            >
              <Download size={16} />
              CSV
            </button>
          </div>
        </div>

        <p className={`mt-4 text-[11px] leading-relaxed ${textMuted}`}>
          Jadval admin paneldagi hisobot bilan bir xil: 32 ta ustun, xona bo&apos;yicha guruhlangan va bo&apos;sh
          o&apos;rinlar 4 tagacha to&apos;ldirilgan holda. Xonasiz talabalar Qavat/Xona ustunlarida
          &laquo;-&raquo; bilan, jadval oxirida alohida ro&apos;yxat bo&apos;lib chiqadi.
        </p>
      </div>

      {/* Preview */}
      <div className={`rounded-3xl border p-5 ${surface}`}>
        <h3 className={`mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] ${textMuted}`}>
          <FileText size={13} />
          Ko&apos;rib chiqish
        </h3>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-indigo-500" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <p className={`py-10 text-center text-xs font-bold ${textMuted}`}>
            Tanlangan filtrlar bo&apos;yicha talaba topilmadi
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead>
                  <tr className={`border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                    {['Xona', 'F.I.Sh.', 'Kursi', 'Jinsi', 'Millati', "To'lov holati"].map((header) => (
                      <th
                        key={header}
                        className={`whitespace-nowrap px-3 py-2.5 text-[10px] font-black uppercase tracking-wider ${textMuted}`}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((student) => {
                    const summary = paySummaries?.get(student.id)
                    return (
                      <tr
                        key={student.id}
                        className={`border-b last:border-0 ${isLight ? 'border-slate-100' : 'border-white/5'}`}
                      >
                        <td className={`whitespace-nowrap px-3 py-2.5 font-bold ${textStrong}`}>
                          {student.room_number ? `№-${student.room_number}` : '-'}
                        </td>
                        <td className={`px-3 py-2.5 font-semibold ${textStrong}`}>{student.full_name}</td>
                        <td className={`whitespace-nowrap px-3 py-2.5 ${textMuted}`}>
                          {student.course ? `${student.course}-kurs` : '-'}
                        </td>
                        <td className={`whitespace-nowrap px-3 py-2.5 ${textMuted}`}>{genderLabel(student.gender)}</td>
                        <td className={`whitespace-nowrap px-3 py-2.5 ${textMuted}`}>{student.nationality || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {summary ? (
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${
                                PAY_STATE_BADGE_CLASSES[summary.state]
                              }`}
                            >
                              {PAY_STATE_LABELS[summary.state]}
                              {summary.state !== 'paid' && ` — ${formatSum(summary.remaining)}`}
                            </span>
                          ) : (
                            <span className={textMuted}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {filteredStudents.length > previewRows.length && (
              <p className={`mt-3 text-center text-[11px] font-bold ${textMuted}`}>
                … va yana {filteredStudents.length - previewRows.length} ta talaba faylga kiradi
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
