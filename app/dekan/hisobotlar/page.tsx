'use client'

import DormTabs from '@/components/dekan/DormTabs'
import { useDormTabs } from '@/lib/hooks/useDormTabs'
import { studentsInDorm } from '@/features/faculty-students/domain/dorm-scope'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Award,
  Building2,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  FilterX,
  Home,
  RotateCcw,
  Search,
  Sparkles,
  UserRound,
  Users,
  UsersRound,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import CustomSelect from '@/components/ui/CustomSelect'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useDekanScope } from '@/lib/hooks/useDekanScope'
import { permitFacultyLabel } from '@/lib/faculties'
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
import { Skel } from '@/components/dekan/Skeletons'

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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (name.slice(0, 2) || 'TL').toUpperCase()
}

export default function DekanReportsPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const ui = dekanUI(isLight)
  const { effectiveFaculty: dekanFaculty } = useDekanScope()

  const dormScope = useDormTabs()
  const { floors: layoutFloors, floorOf: layoutFloorOf, loaded: floorsLoaded } = useRoomFloors(dormScope.dormId ?? undefined)

  const [allStudents, setStudents] = useState<StudentProfileRow[]>([])
  const [allPayments, setPayments] = useState<FacultyPaymentRecord[]>([])
  const students = useMemo(() => studentsInDorm(allStudents, dormScope.dormId), [allStudents, dormScope.dormId])
  const payments = useMemo(() => {
    const ids = new Set(students.map((student) => student.id))
    return allPayments.filter((payment) => ids.has(payment.student_id))
  }, [allPayments, students])
  const floorOf = useCallback((roomNumber?: string | null) => {
    if (!floorsLoaded || dormScope.activeDorm?.layoutKind === 'blocked') {
      return null
    }
    return layoutFloorOf(roomNumber)
  }, [floorsLoaded, dormScope.activeDorm?.layoutKind, layoutFloorOf])
  const studentFloor = useCallback((student: StudentProfileRow) => student.block
    ? student.assigned_floor : floorOf(student.room_number) ?? student.assigned_floor,
  [floorOf])
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
    () => (floorsLoaded && dormScope.activeDorm?.layoutKind !== 'blocked' && layoutFloors.length > 0
      ? layoutFloors
      : [...new Set(students.map(studentFloor).filter((f): f is number => f !== null))].sort(
          (a, b) => a - b
        )),
    [layoutFloors, students, studentFloor, floorsLoaded, dormScope.activeDorm?.layoutKind]
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
      if (filters.floor && String(studentFloor(student) ?? '') !== filters.floor) return false
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
  }, [students, filters, paySummaries, studentFloor])

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

  const exportTable = async (format: 'excel' | 'csv') => {
    if (filteredStudents.length === 0) {
      toast.error("Tanlangan filtrlar bo'yicha talaba topilmadi")
      return
    }
    const toastId = toast.loading("Fayl tayyorlanmoqda...")
    try {
      const { headers, rawRows, displayRows, merges } = buildStudentReportTable(filteredStudents, floorOf)

      if (format === 'excel') {
        await downloadXlsx({
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

  const unpaidCount = useMemo(
    () => students.filter((s) => paySummaries?.get(s.id)?.state === 'none').length,
    [students, paySummaries]
  )
  const debtorCount = useMemo(
    () => students.filter((s) => paySummaries?.get(s.id)?.state !== 'paid').length,
    [students, paySummaries]
  )
  const maleCount = useMemo(
    () => students.filter((s) => normalizeGender(s.gender) === 'male').length,
    [students]
  )
  const femaleCount = useMemo(
    () => students.filter((s) => normalizeGender(s.gender) === 'female').length,
    [students]
  )
  const captainCount = useMemo(
    () => students.filter((s) => s.is_floor_captain).length,
    [students]
  )
  const warnedCount = useMemo(
    () => students.filter((s) => (s.warning_count ?? 0) > 0).length,
    [students]
  )

  const presetItems = [
    {
      label: "To'lov qilmaganlar",
      count: unpaidCount,
      icon: DollarSign,
      isActive: filters.pay === 'unpaid',
      toggle: () => setFilters((prev) => ({ ...EMPTY_FILTERS, pay: prev.pay === 'unpaid' ? '' : 'unpaid' })),
    },
    {
      label: 'Xonasiz talabalar',
      count: roomlessCount,
      icon: Home,
      isActive: filters.placement === 'roomless',
      toggle: () => setFilters((prev) => ({ ...EMPTY_FILTERS, placement: prev.placement === 'roomless' ? '' : 'roomless' })),
    },
    {
      label: 'Qarzdorlar',
      count: debtorCount,
      icon: AlertTriangle,
      isActive: filters.pay === 'debtor',
      toggle: () => setFilters((prev) => ({ ...EMPTY_FILTERS, pay: prev.pay === 'debtor' ? '' : 'debtor' })),
    },
    {
      label: "O'g'il bolalar",
      count: maleCount,
      icon: UserRound,
      isActive: filters.gender === 'male',
      toggle: () => setFilters((prev) => ({ ...EMPTY_FILTERS, gender: prev.gender === 'male' ? '' : 'male' })),
    },
    {
      label: 'Qiz bolalar',
      count: femaleCount,
      icon: UsersRound,
      isActive: filters.gender === 'female',
      toggle: () => setFilters((prev) => ({ ...EMPTY_FILTERS, gender: prev.gender === 'female' ? '' : 'female' })),
    },
    {
      label: 'Qavat sardorlari',
      count: captainCount,
      icon: Award,
      isActive: filters.onlyCaptains,
      toggle: () => setFilters((prev) => ({ ...EMPTY_FILTERS, onlyCaptains: !prev.onlyCaptains })),
    },
    {
      label: 'Ogohlantirilganlar',
      count: warnedCount,
      icon: AlertTriangle,
      isActive: filters.onlyWarned,
      toggle: () => setFilters((prev) => ({ ...EMPTY_FILTERS, onlyWarned: !prev.onlyWarned })),
    },
  ]

  const previewRows = filteredStudents.slice(0, 8)
  const inputCls = `rounded-xl border text-xs sm:text-sm px-3.5 py-2.5 transition-colors ${ui.input} ${ui.ring}`

  return (
    <div className="space-y-6 pb-12">
      {/* ── Executive Multi-Layered Hero Banner (Compact) ─────────── */}
      <div className="no-shelf relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-800 p-4 sm:p-5 shadow-lg shadow-indigo-950/15 border border-white/20 text-white">
        {/* Ambient lighting & subtle micro-dot texture */}
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-16 h-48 w-48 rounded-full bg-violet-400/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.07]" />

        {/* Top bar inside hero */}
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md text-white border border-white/25 shadow-inner shrink-0">
              <FileSpreadsheet size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-white backdrop-blur-md border border-white/20"
                  style={{ color: '#ffffff' }}
                >
                  <Building2 size={11} className="text-white/80" />
                  {dekanFaculty ? permitFacultyLabel(dekanFaculty) : "Fakultet hisoboti"}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  32 ustunli format
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white" style={{ color: '#ffffff' }}>
                Hisobot va eksport
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center justify-center h-8.5 w-8.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white transition-all disabled:opacity-50 no-shelf cursor-pointer active:scale-95 shadow-xs"
              title="Yangilash"
            >
              <motion.div
                animate={loading ? { rotate: 360 } : {}}
                transition={loading ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}
              >
                <RotateCcw size={15} />
              </motion.div>
            </button>
            <button
              type="button"
              onClick={() => exportTable('excel')}
              disabled={loading || filteredStudents.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-indigo-50 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-indigo-700 transition-all shadow-md active:scale-95 no-shelf cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet size={15} strokeWidth={2.5} />
              <span>Excel yuklab olish</span>
            </button>
          </div>
        </div>

        {/* Hero KPI Stat Cards (Compact Horizontal Row) */}
        <div className="relative mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Card 1: Jami talabalar */}
          <div className="relative text-left rounded-xl px-3.5 py-2.5 backdrop-blur-md transition-all no-shelf flex items-center justify-between gap-3 border bg-white/10 border-white/15">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white shrink-0">
                <Users size={15} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-indigo-100 truncate" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  Jami talabalar
                </p>
                <p className="text-lg sm:text-xl font-black text-white tabular-nums tracking-tight leading-tight" style={{ color: '#ffffff' }}>
                  {loading ? '...' : students.length}
                </p>
              </div>
            </div>
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/15 text-white">
              {placedCount} joylashgan
            </span>
          </div>

          {/* Card 2: Filtrlangan natija */}
          <div className="relative text-left rounded-xl px-3.5 py-2.5 backdrop-blur-md transition-all no-shelf flex items-center justify-between gap-3 border bg-white/15 border-white/30 ring-1 ring-white/30">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/25 text-emerald-200 shrink-0">
                <Filter size={15} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-indigo-100 truncate" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  Tanlangan talabalar
                </p>
                <p className="text-lg sm:text-xl font-black text-white tabular-nums tracking-tight leading-tight" style={{ color: '#ffffff' }}>
                  {loading ? '...' : filteredStudents.length}
                </p>
              </div>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Eksportga tayyor
            </span>
          </div>

          {/* Card 3: Jami hisoblangan qarz */}
          <div className="relative text-left rounded-xl px-3.5 py-2.5 backdrop-blur-md transition-all no-shelf flex items-center justify-between gap-3 border bg-white/10 border-white/15">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/25 text-amber-200 shrink-0">
                <DollarSign size={15} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-indigo-100 truncate" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  Tanlanganlar qarzi
                </p>
                <p className="text-base sm:text-lg font-black text-white tabular-nums tracking-tight leading-tight truncate" style={{ color: '#ffffff' }}>
                  {loading ? '...' : selectionDebt !== null ? formatSum(selectionDebt) : '0 UZS'}
                </p>
              </div>
            </div>
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-400/20 text-amber-200 border border-amber-400/30">
              Qarzdorlik
            </span>
          </div>
        </div>
      </div>

      {/* ── Yotoqxona Tanlash (Dorm Tabs) ──────────────────── */}
      <DormTabs scope={dormScope} isLight={isLight} onChange={() => setFilters(EMPTY_FILTERS)} />

      {/* ── Yagona Saralash va Filtrlar Markazi ───────────── */}
      <div className={`rounded-3xl border p-5 sm:p-6 backdrop-blur-xl transition-all ${ui.card} space-y-5 shadow-xs`}>
        {/* Top Header of Filter Hub */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 dark:border-slate-800 border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${ui.accentTile}`}>
              <Filter size={17} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className={`text-sm font-extrabold tracking-tight ${ui.strong}`}>
                Saralash va Filtrlar
              </h3>
              <p className={`text-[11px] font-medium ${ui.muted}`}>
                Talabalarni kerakli parametrlar bo‘yicha filtrlash
              </p>
            </div>
            {activeFilterChips.length > 0 && (
              <span className={`ml-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ui.accentSoft}`}>
                {activeFilterChips.length} ta faol filtr
              </span>
            )}
          </div>

          {activeFilterChips.length > 0 && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="no-shelf inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 transition-all cursor-pointer"
            >
              <FilterX size={14} />
              <span>Filtrlarni tozalash</span>
            </button>
          )}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search size={16} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${ui.faint}`} />
          <input
            type="text"
            placeholder="F.I.Sh., xona raqami yoki email bo'yicha tezkor qidirish..."
            value={filters.search}
            onChange={(event) => setFilter('search', event.target.value)}
            className={`w-full rounded-xl border py-2.5 pl-10 pr-10 text-xs sm:text-sm font-semibold transition-all ${ui.input} ${ui.ring}`}
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => clearFilter('search')}
              aria-label="Qidiruvni tozalash"
              className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition-colors no-shelf cursor-pointer ${ui.muted} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'}`}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Quick Presets Track */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className={`text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>
              Tezkor tanlovlar
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {presetItems.map((preset) => {
              const Icon = preset.icon
              const isActive = preset.isActive
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={preset.toggle}
                  className={`no-shelf inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer active:scale-95 ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-bold'
                      : isLight
                        ? 'bg-slate-100/90 hover:bg-slate-200 text-slate-700 border-slate-200/80'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  <Icon size={13} className={isActive ? 'text-white' : 'text-slate-400'} />
                  <span>{preset.label}</span>
                  <span className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : isLight ? 'bg-white text-slate-600 border border-slate-200' : 'bg-slate-900 text-slate-300'
                  }`}>
                    {preset.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Detailed Criteria Dropdowns */}
        <div className="space-y-2 pt-2 border-t dark:border-slate-800/80 border-slate-200/60">
          <label className={`block text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>
            Batafsil parametrlar
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([
              {
                label: 'Joylashuv',
                node: (
                  <CustomSelect
                    value={filters.placement}
                    onChange={(v) => setFilter('placement', v as PlacementFilter)}
                    className={inputCls}
                    options={[
                      { value: '', label: `Barchasi (${students.length})` },
                      { value: 'placed', label: `${PLACEMENT_FILTER_LABELS.placed} (${placedCount})` },
                      { value: 'roomless', label: `${PLACEMENT_FILTER_LABELS.roomless} (${roomlessCount})` },
                    ]}
                  />
                ),
              },
              {
                label: 'Jinsi',
                node: (
                  <CustomSelect
                    value={filters.gender}
                    onChange={(v) => setFilter('gender', v)}
                    className={inputCls}
                    options={[
                      { value: '', label: `Barchasi (${students.length})` },
                      { value: 'male', label: `O'g'il bolalar (${maleCount})` },
                      { value: 'female', label: `Qiz bolalar (${femaleCount})` },
                    ]}
                  />
                ),
              },
              {
                label: "To'lov holati",
                node: (
                  <CustomSelect
                    value={filters.pay}
                    onChange={(v) => setFilter('pay', v as PayFilter)}
                    className={inputCls}
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
                ),
              },
              {
                label: 'Kursi',
                node: (
                  <CustomSelect
                    value={filters.course}
                    onChange={(v) => setFilter('course', v)}
                    className={inputCls}
                    options={[
                      { value: '', label: 'Barchasi' },
                      ...courses.map((course) => ({ value: String(course), label: `${course}-kurs` })),
                    ]}
                  />
                ),
              },
              {
                label: 'Qavati',
                node: (
                  <CustomSelect
                    value={filters.floor}
                    onChange={(v) => setFilter('floor', v)}
                    className={inputCls}
                    options={[
                      { value: '', label: 'Barchasi' },
                      ...floors.map((floor) => ({ value: String(floor), label: `${floor}-qavat` })),
                    ]}
                  />
                ),
              },
              {
                label: "Yo'nalish",
                node: (
                  <CustomSelect
                    value={filters.direction}
                    onChange={(v) => setFilter('direction', v)}
                    className={inputCls}
                    options={[
                      { value: '', label: 'Barchasi' },
                      ...directions.map((value) => ({ value, label: directionLabel(value) })),
                    ]}
                  />
                ),
              },
              {
                label: 'Viloyati',
                node: (
                  <CustomSelect
                    value={filters.region}
                    onChange={(v) => setFilter('region', v)}
                    className={inputCls}
                    options={[
                      { value: '', label: 'Barchasi' },
                      ...regions.map((value) => ({ value, label: value })),
                    ]}
                  />
                ),
              },
              {
                label: 'Moliya turi',
                node: (
                  <CustomSelect
                    value={filters.studyType}
                    onChange={(v) => setFilter('studyType', v)}
                    className={inputCls}
                    options={[
                      { value: '', label: 'Barchasi' },
                      ...studyTypes.map((value) => ({ value, label: value })),
                    ]}
                  />
                ),
              },
            ]).map(({ label, node }) => (
              <div key={label} className="space-y-1.5">
                <label className={`block text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>{label}</label>
                {node}
              </div>
            ))}
          </div>
        </div>

        {/* Toggles: Sardorlar & Ogohlantirilganlar */}
        <div className="flex flex-wrap gap-2.5 pt-2">
          {[
            {
              key: 'onlyCaptains' as const,
              label: 'Faqat qavat sardorlari',
              count: captainCount,
              icon: Award,
            },
            {
              key: 'onlyWarned' as const,
              label: 'Faqat ogohlantirilgan talabalar',
              count: warnedCount,
              icon: AlertTriangle,
            },
          ].map((toggle) => {
            const Icon = toggle.icon
            const isChecked = filters[toggle.key]
            return (
              <button
                key={toggle.key}
                type="button"
                onClick={() => setFilter(toggle.key, !filters[toggle.key])}
                className={`no-shelf inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                  isChecked
                    ? isLight
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-bold shadow-xs'
                      : 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300 font-bold'
                    : ui.btnGhost
                }`}
              >
                <Icon size={13} className={isChecked ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                <span>{toggle.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isChecked ? 'bg-indigo-200/50 text-indigo-900 dark:text-indigo-200' : 'bg-slate-200/60 dark:bg-slate-800'
                }`}>
                  {toggle.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Active Filter Chips */}
        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-4 dark:border-slate-800 border-slate-200/80">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>
              Faol filtrlar ({activeFilterChips.length}):
            </span>
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => clearFilter(chip.key)}
                className={`no-shelf inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${ui.accentSoft} hover:opacity-80 cursor-pointer`}
              >
                <span>{chip.label}</span>
                <X size={12} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Selection Summary & Export Action Card ────────── */}
      <div className={`rounded-3xl border p-5 sm:p-6 backdrop-blur-xl ${ui.card} shadow-sm space-y-4`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3.5">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${ui.accentTile}`}>
                <FileSpreadsheet size={22} strokeWidth={2.2} />
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl sm:text-3xl font-black tracking-tight ${ui.strong}`}>
                    {loading ? '...' : filteredStudents.length}
                  </span>
                  <span className={`text-xs font-semibold ${ui.muted}`}>
                    / {students.length} ta talaba
                  </span>
                </div>
                <p className={`text-[11px] font-semibold text-slate-500 dark:text-slate-400`}>
                  {selectedRoomlessCount > 0
                    ? `${filteredStudents.length - selectedRoomlessCount} xonada • ${selectedRoomlessCount} xonasiz`
                    : "Barcha saralanganlar xonaga biriktirilgan"}
                </p>
              </div>
            </div>

            {selectionDebt !== null && selectionDebt > 0 && (
              <div className="flex items-center gap-3.5 border-l pl-6 dark:border-slate-800 border-slate-200">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${statusChipInline(isLight)}`}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <span className={`text-2xl sm:text-3xl font-black tracking-tight ${ui.strong}`}>
                    {formatSum(selectionDebt)}
                  </span>
                  <p className={`text-[11px] font-semibold text-amber-600 dark:text-amber-400`}>
                    Saralanganlarning jami qarzdorligi
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Export action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => exportTable('excel')}
              disabled={loading || filteredStudents.length === 0}
              className="no-shelf inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-700/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet size={18} />
              <span>Excel yuklab olish ({filteredStudents.length})</span>
            </button>
            <button
              type="button"
              onClick={() => exportTable('csv')}
              disabled={loading || filteredStudents.length === 0}
              className={`no-shelf inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer ${ui.btnGhost}`}
            >
              <Download size={16} />
              <span>CSV</span>
            </button>
          </div>
        </div>

        <div className={`rounded-2xl p-3.5 border text-xs leading-relaxed flex items-start gap-2.5 ${
          isLight ? 'bg-slate-50 border-slate-200/80 text-slate-600' : 'bg-slate-900/40 border-slate-800 text-slate-300'
        }`}>
          <Sparkles size={16} className="text-indigo-500 shrink-0 mt-0.5" />
          <span>
            <strong>Vazirlik standarti:</strong> Ushbu fayl admin paneldagi jadval bilan 100% bir xil: 32 ta rasmiy ustun, xona bo‘yicha to‘liq tartiblangan va bo‘sh o‘rinlar 4 tagacha avtomatik to‘ldirilgan holda shakllanadi.
          </span>
        </div>
      </div>

      {/* ── Preview Table (Ko'rib chiqish) ────────────────── */}
      <div className={`rounded-3xl border p-5 sm:p-6 backdrop-blur-xl ${ui.card} shadow-xs`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${ui.strong}`}>
            <FileText size={15} className="text-indigo-600 dark:text-indigo-400" />
            Ko&apos;rib chiqish
            <span className={`font-normal lowercase ${ui.muted}`}>
              (dastlabki {Math.min(previewRows.length, filteredStudents.length)} ta yozuv)
            </span>
          </h3>
        </div>

        {loading ? (
          <div className="space-y-2.5 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skel className="h-8 w-8 shrink-0 rounded-lg" />
                <Skel className="h-3.5 flex-1" />
                <Skel className="hidden h-3 w-24 shrink-0 sm:block" />
              </div>
            ))}
          </div>
        ) : filteredStudents.length === 0 ? (
          <p className={`py-10 text-center text-xs font-medium ${ui.muted}`}>
            Tanlangan filtrlar bo&apos;yicha talaba topilmadi
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border dark:border-slate-800 border-slate-200/80">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead>
                  <tr className={`border-b ${isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-900/50 border-slate-800'}`}>
                    {['Xona', 'F.I.Sh.', 'Kursi', 'Jinsi', 'Millati', "To'lov holati"].map((header) => (
                      <th key={header} className={`whitespace-nowrap px-4 py-3 text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800 divide-slate-200/60">
                  {previewRows.map((student) => {
                    const summary = paySummaries?.get(student.id)
                    return (
                      <tr key={student.id} className={`transition-colors ${isLight ? 'hover:bg-slate-50/70' : 'hover:bg-slate-800/40'}`}>
                        <td className="whitespace-nowrap px-4 py-3">
                          {student.room_number ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              № {student.room_number}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-black text-[10px] flex items-center justify-center shrink-0 border border-indigo-200/60 dark:border-indigo-800/60">
                              {getInitials(student.full_name)}
                            </div>
                            <span className={`font-bold ${ui.strong}`}>
                              {student.full_name}
                            </span>
                          </div>
                        </td>
                        <td className={`whitespace-nowrap px-4 py-3 ${ui.muted}`}>
                          {student.course ? `${student.course}-kurs` : '-'}
                        </td>
                        <td className={`whitespace-nowrap px-4 py-3 ${ui.muted}`}>
                          {genderLabel(student.gender)}
                        </td>
                        <td className={`whitespace-nowrap px-4 py-3 ${ui.muted}`}>
                          {student.nationality || '-'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {summary ? (
                            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${PAY_STATE_BADGE_CLASSES[summary.state]}`}>
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
