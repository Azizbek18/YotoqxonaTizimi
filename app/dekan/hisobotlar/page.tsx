'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  FilterX,
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
import { useRoomFloors } from '@/lib/hooks/useRoomFloors'
import { genderLabel, normalizeGender } from '@/lib/gender'
import { directionLabel, normalizeDirection } from '@/lib/directions'
import { dekanUI } from '@/lib/dekan-ui'

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
  const ui = dekanUI(isLight)

  const { floors: layoutFloors, floorOf } = useRoomFloors()

  const [students, setStudents] = useState<StudentProfileRow[]>([])
  const [payments, setPayments] = useState<FacultyPaymentRecord[]>([])
  const [yearlyContractFee, setYearlyContractFee] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [studentRows, paymentRows, settings] = await Promise.all([
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

  const paySummaries = useMemo(
    () => (yearlyContractFee === null ? null : buildPaySummaries(students, payments, yearlyContractFee)),
    [students, payments, yearlyContractFee]
  )

  const nationalities = useMemo(() => distinctValues(students, (s) => s.nationality), [students])
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
    () => (layoutFloors.length > 0
      ? layoutFloors
      : [...new Set(students.map((s) => floorOf(s.room_number)).filter((f): f is number => f !== null))].sort(
          (a, b) => a - b
        )),
    [layoutFloors, students, floorOf]
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
      if (filters.floor && String(floorOf(student.room_number) ?? '') !== filters.floor) return false
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
  }, [students, filters, paySummaries, floorOf])

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
      const { headers, rawRows, displayRows, merges } = buildStudentReportTable(filteredStudents, floorOf)

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

  const inputCls = `rounded-lg border text-sm px-3 py-2.5 transition-colors ${ui.input} ${ui.ring}`
  const sectionLabel = `text-[10px] font-bold uppercase tracking-[0.18em] ${ui.muted}`

  const presets: { label: string; apply: () => void }[] = [
    { label: "To'lov qilmaganlar", apply: () => setFilters({ ...EMPTY_FILTERS, pay: 'unpaid' }) },
    { label: 'Xonasiz talabalar', apply: () => setFilters({ ...EMPTY_FILTERS, placement: 'roomless' }) },
    { label: 'Qarzdorlar', apply: () => setFilters({ ...EMPTY_FILTERS, pay: 'debtor' }) },
    { label: "O'g'il bolalar", apply: () => setFilters({ ...EMPTY_FILTERS, gender: 'male' }) },
    { label: 'Qiz bolalar', apply: () => setFilters({ ...EMPTY_FILTERS, gender: 'female' }) },
    { label: 'Qavat sardorlari', apply: () => setFilters({ ...EMPTY_FILTERS, onlyCaptains: true }) },
    { label: 'Ogohlantirilganlar', apply: () => setFilters({ ...EMPTY_FILTERS, onlyWarned: true }) },
  ]

  const previewRows = filteredStudents.slice(0, 8)

  const renderClearBtn = (key: string) => (
    <button
      key={key}
      onClick={() => setFilters(EMPTY_FILTERS)}
      disabled={activeFilterChips.length === 0}
      title="Barcha filtrlarni tozalash"
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${ui.dangerSoft}`}
    >
      <FilterX size={13} />
      Filtrlarni tozalash
    </button>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${ui.strong}`}>Hisobot va eksport</h1>
          <p className={`mt-1 text-xs sm:text-sm ${ui.muted}`}>
            Fakultet talabalarini kerakli kesimda tanlab, admin paneldagi jadval bilan bir xil ko&apos;rinishda yuklab oling
          </p>
        </div>

        <button
          onClick={() => void load()}
          disabled={loading}
          className={`inline-flex items-center justify-center rounded-lg border p-3 transition-colors disabled:opacity-50 ${ui.btnGhost}`}
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
      <div className={`rounded-2xl border p-5 ${ui.card}`}>
        <h3 className={`mb-3 ${sectionLabel}`}>Tez tanlov</h3>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={preset.apply}
              className={`rounded-lg border px-3 py-2 text-[11px] font-semibold transition-colors ${ui.btnGhost}`}
            >
              {preset.label}
            </button>
          ))}
          {renderClearBtn('presets')}
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-2xl border p-5 ${ui.card}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className={`flex items-center gap-2 ${sectionLabel}`}>
            <Filter size={13} />
            Batafsil filtrlar
            {activeFilterChips.length > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] leading-none ${ui.accentSoft}`}>
                {activeFilterChips.length}
              </span>
            )}
          </h3>
          {renderClearBtn('header')}
        </div>

        <div className="relative mb-4">
          <Search size={16} className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${ui.faint}`} />
          <input
            type="text"
            placeholder="Ism, xona yoki email bo'yicha qidirish..."
            value={filters.search}
            onChange={(event) => setFilter('search', event.target.value)}
            className={`w-full rounded-lg border py-3 pl-11 pr-10 text-sm transition-colors ${ui.input} ${ui.ring}`}
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => clearFilter('search')}
              aria-label="Qidiruvni tozalash"
              className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition-colors ${ui.muted} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'}`}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([
            { label: 'Joylashuv', node: (
              <CustomSelect value={filters.placement} onChange={(v) => setFilter('placement', v as PlacementFilter)} className={inputCls}
                options={[
                  { value: '', label: `Barchasi (${students.length})` },
                  { value: 'placed', label: `${PLACEMENT_FILTER_LABELS.placed} (${placedCount})` },
                  { value: 'roomless', label: `${PLACEMENT_FILTER_LABELS.roomless} (${roomlessCount})` },
                ]} />
            ) },
            { label: 'Jinsi', node: (
              <CustomSelect value={filters.gender} onChange={(v) => setFilter('gender', v)} className={inputCls}
                options={[{ value: '', label: 'Barchasi' }, { value: 'male', label: "O'g'il bolalar" }, { value: 'female', label: 'Qiz bolalar' }]} />
            ) },
            { label: "To'lov holati", node: (
              <CustomSelect value={filters.pay} onChange={(v) => setFilter('pay', v as PayFilter)} className={inputCls}
                disabled={!paySummaries} placeholder={paySummaries ? 'Barchasi' : 'Shartnoma summasi yuklanmadi'}
                options={[{ value: '', label: 'Barchasi' }, ...(Object.keys(PAY_FILTER_LABELS) as Exclude<PayFilter, ''>[]).map((key) => ({ value: key, label: PAY_FILTER_LABELS[key] }))]} />
            ) },
            { label: 'Millati', node: (
              <CustomSelect value={filters.nationality} onChange={(v) => setFilter('nationality', v)} className={inputCls}
                options={[{ value: '', label: 'Barchasi' }, ...nationalities.map((value) => ({ value, label: value }))]} />
            ) },
            { label: 'Kursi', node: (
              <CustomSelect value={filters.course} onChange={(v) => setFilter('course', v)} className={inputCls}
                options={[{ value: '', label: 'Barchasi' }, ...courses.map((course) => ({ value: String(course), label: `${course}-kurs` }))]} />
            ) },
            { label: 'Qavati', node: (
              <CustomSelect value={filters.floor} onChange={(v) => setFilter('floor', v)} className={inputCls}
                options={[{ value: '', label: 'Barchasi' }, ...floors.map((floor) => ({ value: String(floor), label: `${floor}-qavat` }))]} />
            ) },
            { label: "Yo'nalish", node: (
              <CustomSelect value={filters.direction} onChange={(v) => setFilter('direction', v)} className={inputCls}
                options={[{ value: '', label: 'Barchasi' }, ...directions.map((value) => ({ value, label: directionLabel(value) }))]} />
            ) },
            { label: 'Moliya turi', node: (
              <CustomSelect value={filters.studyType} onChange={(v) => setFilter('studyType', v)} className={inputCls}
                options={[{ value: '', label: 'Barchasi' }, ...studyTypes.map((value) => ({ value, label: value }))]} />
            ) },
            { label: 'Viloyati', node: (
              <CustomSelect value={filters.region} onChange={(v) => setFilter('region', v)} className={inputCls}
                options={[{ value: '', label: 'Barchasi' }, ...regions.map((value) => ({ value, label: value }))]} />
            ) },
          ]).map(({ label, node }) => (
            <div key={label} className="space-y-1.5">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>{label}</label>
              {node}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { key: 'onlyCaptains' as const, label: 'Faqat qavat sardorlari' },
            { key: 'onlyWarned' as const, label: 'Faqat ogohlantirilgan talabalar' },
          ].map((toggle) => (
            <button
              key={toggle.key}
              onClick={() => setFilter(toggle.key, !filters[toggle.key])}
              className={`rounded-lg border px-3 py-2 text-[11px] font-semibold transition-colors ${
                filters[toggle.key]
                  ? (isLight ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300')
                  : ui.btnGhost
              }`}
            >
              {toggle.label}
            </button>
          ))}
        </div>

        {activeFilterChips.length > 0 && (
          <div className={`mt-4 flex flex-wrap items-center gap-2 border-t pt-4 ${ui.border}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>Faol filtrlar:</span>
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => clearFilter(chip.key)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${ui.accentSoft}`}
              >
                {chip.label}
                <X size={11} />
              </button>
            ))}
            <div className="ml-auto">{renderClearBtn('chips')}</div>
          </div>
        )}
      </div>

      {/* Selection summary + download */}
      <div className={`rounded-2xl border p-5 ${ui.card}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ui.accentSoft}`}>
                <Users size={18} />
              </div>
              <div>
                <p className={`text-2xl font-bold leading-none ${ui.strong}`}>{loading ? '...' : filteredStudents.length}</p>
                <p className={`mt-1 text-[10px] font-semibold uppercase tracking-wider ${ui.muted}`}>
                  Tanlangan talaba (jami {students.length})
                  {selectedRoomlessCount > 0 && ` • ${selectedRoomlessCount} tasi xonasiz`}
                </p>
              </div>
            </div>

            {selectionDebt !== null && (
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${statusChipInline(isLight)}`}>
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <p className={`text-2xl font-bold leading-none ${ui.strong}`}>{loading ? '...' : formatSum(selectionDebt)}</p>
                  <p className={`mt-1 text-[10px] font-semibold uppercase tracking-wider ${ui.muted}`}>Tanlanganlarning jami qarzi</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => exportTable('excel')}
              disabled={loading || filteredStudents.length === 0}
              className={`flex items-center gap-2 rounded-lg px-4 py-3 text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${ui.accentSolid}`}
            >
              <FileSpreadsheet size={16} />
              Excel yuklab olish
            </button>
            <button
              onClick={() => exportTable('csv')}
              disabled={loading || filteredStudents.length === 0}
              className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${ui.btnGhost}`}
            >
              <Download size={16} />
              CSV
            </button>
          </div>
        </div>

        <p className={`mt-4 text-[11px] leading-relaxed ${ui.muted}`}>
          Jadval admin paneldagi hisobot bilan bir xil: 32 ta ustun, xona bo&apos;yicha guruhlangan va bo&apos;sh
          o&apos;rinlar 4 tagacha to&apos;ldirilgan holda. Xonasiz talabalar Qavat/Xona ustunlarida
          &laquo;-&raquo; bilan, jadval oxirida alohida ro&apos;yxat bo&apos;lib chiqadi.
        </p>
      </div>

      {/* Preview */}
      <div className={`rounded-2xl border p-5 ${ui.card}`}>
        <h3 className={`mb-4 flex items-center gap-2 ${sectionLabel}`}>
          <FileText size={13} />
          Ko&apos;rib chiqish
        </h3>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <p className={`py-10 text-center text-xs font-medium ${ui.muted}`}>
            Tanlangan filtrlar bo&apos;yicha talaba topilmadi
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead>
                  <tr className={`border-b ${ui.border}`}>
                    {['Xona', 'F.I.Sh.', 'Kursi', 'Jinsi', 'Millati', "To'lov holati"].map((header) => (
                      <th key={header} className={`whitespace-nowrap px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((student) => {
                    const summary = paySummaries?.get(student.id)
                    return (
                      <tr key={student.id} className={`border-b last:border-0 ${ui.border}`}>
                        <td className={`whitespace-nowrap px-3 py-2.5 font-semibold ${ui.strong}`}>
                          {student.room_number ? `№-${student.room_number}` : '-'}
                        </td>
                        <td className={`px-3 py-2.5 font-semibold ${ui.strong}`}>{student.full_name}</td>
                        <td className={`whitespace-nowrap px-3 py-2.5 ${ui.muted}`}>{student.course ? `${student.course}-kurs` : '-'}</td>
                        <td className={`whitespace-nowrap px-3 py-2.5 ${ui.muted}`}>{genderLabel(student.gender)}</td>
                        <td className={`whitespace-nowrap px-3 py-2.5 ${ui.muted}`}>{student.nationality || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {summary ? (
                            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${PAY_STATE_BADGE_CLASSES[summary.state]}`}>
                              {PAY_STATE_LABELS[summary.state]}
                              {summary.state !== 'paid' && ` — ${formatSum(summary.remaining)}`}
                            </span>
                          ) : (
                            <span className={ui.muted}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {filteredStudents.length > previewRows.length && (
              <p className={`mt-3 text-center text-[11px] font-medium ${ui.muted}`}>
                … va yana {filteredStudents.length - previewRows.length} ta talaba faylga kiradi
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// The debt tile carries a genuine "attention" meaning — the one place a
// warning tone is warranted here, kept muted.
function statusChipInline(isLight: boolean) {
  return isLight ? 'bg-amber-50 text-amber-600' : 'bg-amber-500/10 text-amber-400'
}
