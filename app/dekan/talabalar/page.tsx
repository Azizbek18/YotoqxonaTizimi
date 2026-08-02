'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  GraduationCap,
  Home,
  Mail,
  MapPin,
  Phone,
  Receipt,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useThemeStore } from '@/lib/stores/theme-store'
import {
  fetchFacultyPayments,
  fetchFacultyStudents,
  sendStudentWarning,
} from '@/features/faculty-students/client/api'
import type {
  FacultyPaymentRecord,
  StudentProfileRow,
  StudentWarningLevel,
} from '@/features/faculty-students/types'
import {
  APPROVED_PAYMENT_STATUSES,
  PAY_STATE_BADGE_CLASSES,
  PAY_STATE_LABELS,
  WAITING_PAYMENT_STATUSES,
  buildPaySummaries,
  formatSum,
} from '@/features/faculty-students/domain/payment-summary'
import { fetchAppSettings } from '@/features/app-settings/client/api'
import { permitFacultyLabel } from '@/lib/faculties'
import { directionLabel } from '@/lib/directions'
import { genderAccent, genderLabel, normalizeGender } from '@/lib/gender'

type WarningTone = 'ok' | 'warn' | 'danger' | 'unknown'

// threshold=null means the real warningThreshold setting hasn't loaded yet —
// treat that as "unknown" rather than guessing, so a warning count isn't
// colored as if it were confirmed within/past a threshold we don't have.
function getWarningTone(count: number, threshold: number | null): WarningTone {
  if (count === 0) return 'ok'
  if (threshold === null) return 'unknown'
  return count <= threshold ? 'warn' : 'danger'
}

const WARNING_BADGE_CLASSES: Record<WarningTone, string> = {
  ok: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 animate-pulse',
  unknown: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
}

const WARNING_DOT_CLASSES: Record<WarningTone, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  danger: 'bg-rose-500',
  unknown: 'bg-slate-400',
}

const HUJJAT_LABELS = ['Passport seriya', 'JSHSHIR', 'Passport sanasi', 'Hudud', 'Millati', 'Jinsi']

type FolderKey = 'all' | 'debtor' | 'paid' | 'male' | 'female' | 'captain' | 'warned'

export default function DekanStudentsPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const [students, setStudents] = useState<StudentProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<FacultyPaymentRecord[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)

  // null (not a guessed default) while settings are loading or unavailable —
  // a wrong warningThreshold would mis-colour badges, and a wrong contract
  // fee would show a debt figure that looks real but isn't.
  const [warningThreshold, setWarningThreshold] = useState<number | null>(null)
  const [yearlyContractFee, setYearlyContractFee] = useState<number | null>(null)
  const [settingsStatus, setSettingsStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const [searchTerm, setSearchTerm] = useState('')
  const [filterRoom, setFilterRoom] = useState('')
  const [activeFolder, setActiveFolder] = useState<FolderKey>('all')

  const [selectedStudent, setSelectedStudent] = useState<StudentProfileRow | null>(null)
  const [detailTab, setDetailTab] = useState<'profil' | 'hujjatlar' | 'oila' | 'tolovlar'>('profil')
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null)

  const [warningModalOpen, setWarningModalOpen] = useState(false)
  const [warningLevel, setWarningLevel] = useState<StudentWarningLevel>('info')
  const [warningText, setWarningText] = useState('')
  const [sendingWarning, setSendingWarning] = useState(false)

  const getInitials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0] ?? '')
      .slice(0, 2)
      .join('')
      .toUpperCase()

  const formatDate = (value?: string | null) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString('uz-UZ')
  }

  const loadStudents = useCallback(async () => {
    try {
      setLoading(true)
      const rows = await fetchFacultyStudents('placed')
      setStudents(rows)
      setSelectedStudent((prev) => (prev ? rows.find((row) => row.id === prev.id) ?? prev : prev))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Talabalarni yuklashda xato!"
      console.error('Dekan talabalarini yuklashda xato:', message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPayments = useCallback(async () => {
    try {
      setPaymentsLoading(true)
      setPayments(await fetchFacultyPayments())
    } catch (error) {
      console.error("To'lovlarni yuklashda xato:", error)
      toast.error(error instanceof Error ? error.message : "To'lovlarni yuklab bo'lmadi")
    } finally {
      setPaymentsLoading(false)
    }
  }, [])

  const loadSettings = useCallback(async () => {
    setSettingsStatus('loading')
    try {
      const settings = await fetchAppSettings()
      setWarningThreshold(settings.warningThreshold)
      setYearlyContractFee(settings.yearlyContractFee)
      setSettingsStatus('ready')
    } catch {
      setWarningThreshold(null)
      setYearlyContractFee(null)
      setSettingsStatus('error')
      toast.error("Tizim sozlamalarini yuklab bo'lmadi")
    }
  }, [])

  const refreshAll = useCallback(() => {
    void loadStudents()
    void loadPayments()
    void loadSettings()
  }, [loadStudents, loadPayments, loadSettings])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  // null while the real contract fee hasn't loaded — every debt/progress
  // figure below is measured against it, so there is nothing honest to show
  // until it arrives.
  const paySummaries = useMemo(
    () => (yearlyContractFee === null ? null : buildPaySummaries(students, payments, yearlyContractFee)),
    [students, payments, yearlyContractFee]
  )

  const selectedPayments = useMemo(() => {
    if (!selectedStudent) return []
    return payments
      .filter((record) => record.student_id === selectedStudent.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [payments, selectedStudent])

  const selectedSummary = selectedStudent ? paySummaries?.get(selectedStudent.id) ?? null : null

  const filteredStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const room = filterRoom.trim().toLowerCase()

    return students.filter((student) => {
      const matchesSearch =
        !query ||
        student.full_name.toLowerCase().includes(query) ||
        (student.email ?? '').toLowerCase().includes(query)

      const matchesRoom = !room || (student.room_number ?? '').toLowerCase().includes(room)

      let matchesFolder = true
      if (activeFolder === 'male' || activeFolder === 'female') {
        matchesFolder = normalizeGender(student.gender) === activeFolder
      } else if (activeFolder === 'captain') {
        matchesFolder = Boolean(student.is_floor_captain)
      } else if (activeFolder === 'warned') {
        matchesFolder = (student.warning_count ?? 0) > 0
      } else if (activeFolder === 'paid' || activeFolder === 'debtor') {
        const state = paySummaries?.get(student.id)?.state
        matchesFolder = activeFolder === 'paid' ? state === 'paid' : state === 'partial' || state === 'none'
      }

      return matchesSearch && matchesRoom && matchesFolder
    })
  }, [students, searchTerm, filterRoom, activeFolder, paySummaries])

  const roommates = useMemo(() => {
    if (!selectedStudent?.room_number) return []
    return students.filter(
      (student) => student.room_number === selectedStudent.room_number && student.id !== selectedStudent.id
    )
  }, [students, selectedStudent])

  const studentInfoItems = (student: StudentProfileRow) =>
    [
      { icon: Mail, label: 'Email', value: student.email },
      { icon: Phone, label: 'Telefon', value: student.phone_number },
      { icon: GraduationCap, label: 'Fakultet', value: permitFacultyLabel(student.faculty) || undefined },
      { icon: GraduationCap, label: "Yo'nalish", value: directionLabel(student.direction) || undefined },
      { icon: ShieldCheck, label: 'Kurs', value: student.course ? `${student.course}-kurs` : undefined },
      { icon: Home, label: 'Xona', value: student.room_number },
      { icon: BedDouble, label: 'Qavat', value: student.assigned_floor ? `${student.assigned_floor}-qavat` : undefined },
      { icon: ShieldCheck, label: 'Sardorlik holati', value: student.is_floor_captain ? 'Qavat sardori' : undefined },
      {
        icon: CalendarDays,
        label: "Tug'ilgan sana",
        value: formatDate(student.birth_date) !== '-' ? formatDate(student.birth_date) : undefined,
      },
      {
        icon: CalendarDays,
        label: 'Yotoqxonaga kirgan sana',
        value: formatDate(student.entry_date) !== '-' ? formatDate(student.entry_date) : undefined,
      },
      { icon: ShieldCheck, label: "Ta'lim turi", value: student.study_type },
      { icon: UserRound, label: 'Sharifi', value: student.middle_name },
      { icon: ShieldCheck, label: 'Passport seriya', value: student.passport_series },
      { icon: ShieldCheck, label: 'JSHSHIR', value: student.jshshir },
      {
        icon: CalendarDays,
        label: 'Passport sanasi',
        value: formatDate(student.passport_date) !== '-' ? formatDate(student.passport_date) : undefined,
      },
      {
        icon: MapPin,
        label: 'Hudud',
        value: [student.region, student.district, student.mahalla].filter(Boolean).join(', ') || undefined,
      },
      { icon: UserRound, label: 'Millati', value: student.nationality },
      { icon: UserRound, label: 'Jinsi', value: student.gender ? genderLabel(student.gender) : undefined },
    ].filter((item) => item.value)

  const familyInfoItems = (student: StudentProfileRow) =>
    [
      { label: 'Ota F.I.Sh.', value: student.father_full_name },
      { label: 'Ota ish joyi', value: student.father_workplace },
      { label: 'Ota telefoni', value: student.father_phone },
      { label: 'Ona F.I.Sh.', value: student.mother_full_name },
      { label: 'Ona ish joyi', value: student.mother_workplace },
      { label: 'Ona telefoni', value: student.mother_phone },
    ].filter((item) => item.value)

  const openWarningModal = () => {
    if (!selectedStudent) return
    const remaining = selectedSummary?.remaining ?? 0
    setWarningLevel('info')
    setWarningText(
      remaining > 0
        ? `Hurmatli ${selectedStudent.full_name}, yotoqxona shartnoma to'lovi bo'yicha ${formatSum(remaining)} qarzdorligingiz mavjud. Iltimos, to'lovni imkon qadar tezroq amalga oshiring.`
        : ''
    )
    setWarningModalOpen(true)
  }

  const handleSendWarning = async () => {
    if (!selectedStudent || sendingWarning) return
    const message = warningText.trim()
    if (message.length < 5) {
      toast.error('Xabar matnini yozing')
      return
    }

    setSendingWarning(true)
    try {
      const result = await sendStudentWarning({
        studentId: selectedStudent.id,
        message,
        level: warningLevel,
      })
      // The server re-derives warning_count, so take its value rather than
      // incrementing locally — otherwise the badge drifts from the database.
      setStudents((prev) =>
        prev.map((student) =>
          student.id === selectedStudent.id ? { ...student, warning_count: result.warningCount } : student
        )
      )
      setSelectedStudent((prev) => (prev ? { ...prev, warning_count: result.warningCount } : prev))
      toast.success(result.level === 'warning' ? 'Ogohlantirish yuborildi' : 'Eslatma yuborildi')
      setWarningModalOpen(false)
      setWarningText('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ogohlantirishni yuborib bo'lmadi")
    } finally {
      setSendingWarning(false)
    }
  }

  const totalCount = students.length || 1
  const maleCount = students.filter((student) => normalizeGender(student.gender) === 'male').length
  const femaleCount = students.filter((student) => normalizeGender(student.gender) === 'female').length
  const warnedCount = students.filter((student) => (student.warning_count ?? 0) > 0).length
  const captainCount = students.filter((student) => student.is_floor_captain).length

  const paidCount = paySummaries
    ? [...paySummaries.values()].filter((summary) => summary.state === 'paid').length
    : null
  const debtorCount = paySummaries
    ? [...paySummaries.values()].filter((summary) => summary.state !== 'paid').length
    : null
  const totalDebt = paySummaries
    ? [...paySummaries.values()].reduce((sum, summary) => sum + summary.remaining, 0)
    : null
  const waitingCount = payments.filter((record) => WAITING_PAYMENT_STATUSES.has(record.status)).length

  const statCards = [
    {
      title: 'Joylashgan talabalar',
      count: students.length,
      percentage: 100,
      color: 'from-indigo-500 to-violet-600',
      glow: 'rgba(99,102,241,0.18)',
      barColor: 'bg-indigo-500',
      icon: Users,
      description: captainCount > 0 ? `${captainCount} ta qavat sardori` : undefined,
    },
    {
      title: "O'g'il bolalar",
      count: maleCount,
      percentage: Math.round((maleCount / totalCount) * 100),
      color: 'from-sky-500 to-blue-600',
      glow: 'rgba(14,165,233,0.18)',
      barColor: 'bg-sky-500',
      icon: UserRound,
    },
    {
      title: 'Qiz bolalar',
      count: femaleCount,
      percentage: Math.round((femaleCount / totalCount) * 100),
      color: 'from-rose-500 to-pink-600',
      glow: 'rgba(244,63,94,0.18)',
      barColor: 'bg-rose-500',
      icon: UsersRound,
    },
    {
      title: "To'liq to'laganlar",
      count: paidCount,
      percentage: paidCount === null ? 0 : Math.round((paidCount / totalCount) * 100),
      color: 'from-emerald-500 to-teal-600',
      glow: 'rgba(16,185,129,0.18)',
      barColor: 'bg-emerald-500',
      icon: CheckCircle2,
    },
    {
      title: 'Qarzdorlar',
      count: debtorCount,
      percentage: debtorCount === null ? 0 : Math.round((debtorCount / totalCount) * 100),
      color: 'from-amber-500 to-orange-600',
      glow: 'rgba(245,158,11,0.18)',
      barColor: 'bg-amber-500',
      icon: DollarSign,
      description: totalDebt ? `Jami qarz: ${formatSum(totalDebt)}` : undefined,
    },
    {
      title: 'Kutilayotgan cheklar',
      count: waitingCount,
      percentage: payments.length ? Math.round((waitingCount / payments.length) * 100) : 0,
      color: 'from-violet-500 to-fuchsia-600',
      glow: 'rgba(139,92,246,0.18)',
      barColor: 'bg-violet-500',
      icon: Clock,
      description: waitingCount > 0 ? 'Admin tasdig‘ini kutmoqda' : undefined,
    },
  ]

  const folders: { key: FolderKey; label: string; count: number | null }[] = [
    { key: 'all', label: 'Barchasi', count: students.length },
    { key: 'debtor', label: 'Qarzdor', count: debtorCount },
    { key: 'paid', label: "To'lagan", count: paidCount },
    { key: 'male', label: "O'g'il", count: maleCount },
    { key: 'female', label: 'Qiz', count: femaleCount },
    { key: 'captain', label: 'Sardorlar', count: captainCount },
    { key: 'warned', label: 'Ogohlantirilgan', count: warnedCount },
  ]

  const cardSurface = isLight ? 'bg-white border-slate-200/70' : 'bg-[#182533] border-white/5'
  const infoTileSurface = isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-800/40 text-slate-400'
  const infoValueText = isLight ? 'text-slate-900' : 'text-white'
  const busy = loading || paymentsLoading

  return (
    <div>
      {/* Title Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-black tracking-tighter text-slate-900 dark:text-white sm:text-3xl">
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-2 text-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.12)]">
              <Users size={28} />
            </div>
            Talabalar
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Ro&apos;yxatdan o&apos;tib, yotoqxonaga to&apos;liq joylashtirilgan fakultet talabalari va ularning to&apos;lov holati
          </p>
        </div>

        <button
          onClick={refreshAll}
          disabled={busy}
          className={`inline-flex items-center justify-center rounded-xl border p-3 transition-all disabled:opacity-50 ${
            isLight
              ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
          title="Yangilash"
        >
          <motion.div
            animate={busy ? { rotate: 360 } : {}}
            transition={busy ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}
          >
            <RotateCcw size={18} />
          </motion.div>
        </button>
      </div>

      {/* Stats Section */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card, index) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              whileHover={{ y: -5, scale: 1.01 }}
              className={`group relative overflow-hidden rounded-2xl border p-5 shadow-xl backdrop-blur-xl transition-all ${
                isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-[#0b1120]/60'
              }`}
              style={{ boxShadow: `0 10px 30px -10px ${card.glow}` }}
            >
              <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-linear-to-br from-white/10 to-transparent opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />

              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {card.title}
                  </p>
                  <p className={`mt-2 text-3xl font-black leading-none ${infoValueText}`}>
                    {busy ? '...' : card.count ?? '—'}
                  </p>
                </div>
                <div className={`rounded-xl bg-linear-to-br p-3 text-white shadow-lg ${card.color}`}>
                  <Icon size={20} />
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-slate-500">
                  <span>ULUSH</span>
                  <span>{busy || card.count === null ? '...' : `${card.percentage}%`}</span>
                </div>
                <div className={`h-1.5 w-full overflow-hidden rounded-full ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: busy || card.count === null ? 0 : `${card.percentage}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full rounded-full ${card.barColor}`}
                  />
                </div>
              </div>

              {card.description && !busy && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-amber-500">
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-amber-400" />
                  {card.description}
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Split list / detail layout */}
      <div
        className={`grid h-[620px] grid-cols-1 overflow-hidden rounded-3xl border md:grid-cols-12 ${
          isLight ? 'border-slate-200 bg-white shadow-xl' : 'border-white/10 bg-[#0f172a]/30 shadow-2xl shadow-black/40'
        }`}
      >
        {/* Left: students list */}
        <div
          className={`col-span-12 h-full min-h-0 border-r md:col-span-4 lg:col-span-3 ${
            isLight ? 'border-slate-200 bg-[#f8fafc]' : 'border-white/5 bg-[#17212b]'
          } ${selectedStudent ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}
        >
          {/* Search inputs */}
          <div className="space-y-2.5 p-4">
            <div className="relative">
              <Search className={`absolute left-3 top-3.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} size={16} />
              <input
                type="text"
                placeholder="Ism yoki email bo'yicha..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className={`w-full rounded-2xl py-3 pl-10 pr-4 text-xs outline-none transition-all ${
                  isLight
                    ? 'border border-slate-200 bg-slate-100 text-slate-900 focus:border-indigo-500 focus:bg-white'
                    : 'border border-transparent bg-[#24303f] text-white focus:border-indigo-500/50 focus:bg-[#1f2936]'
                }`}
              />
            </div>
            <div className="relative">
              <Home className={`absolute left-3 top-3.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} size={16} />
              <input
                type="text"
                placeholder="Xona raqami bo'yicha..."
                value={filterRoom}
                onChange={(event) => setFilterRoom(event.target.value)}
                className={`w-full rounded-2xl py-3 pl-10 pr-4 text-xs outline-none transition-all ${
                  isLight
                    ? 'border border-slate-200 bg-slate-100 text-slate-900 focus:border-indigo-500 focus:bg-white'
                    : 'border border-transparent bg-[#24303f] text-white focus:border-indigo-500/50 focus:bg-[#1f2936]'
                }`}
              />
            </div>
          </div>

          {/* Folder tabs */}
          <div
            className={`no-scrollbar flex gap-1 overflow-x-auto border-b px-4 pb-2 ${
              isLight ? 'border-slate-100' : 'border-white/5'
            }`}
          >
            {folders.map((folder) => {
              const isActive = activeFolder === folder.key
              // Payment folders stay disabled while the contract fee is
              // unknown — filtering by a debt we can't compute would just
              // silently show an empty list.
              const disabled = folder.count === null
              return (
                <button
                  key={folder.key}
                  onClick={() => !disabled && setActiveFolder(folder.key)}
                  disabled={disabled}
                  className={`relative shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-40 ${
                    isActive
                      ? isLight
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'bg-[#2b5278] text-white'
                      : isLight
                        ? 'text-slate-500 hover:bg-slate-100'
                        : 'text-slate-400 hover:bg-[#202b36]'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {folder.label}
                    {folder.count !== null && folder.count > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                          isActive
                            ? isLight
                              ? 'bg-indigo-600 text-white'
                              : 'bg-[#182533] text-[#4f9ed9]'
                            : isLight
                              ? 'bg-slate-200 text-slate-600'
                              : 'bg-[#24303f] text-slate-400'
                        }`}
                      >
                        {folder.count}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          {/* List items */}
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Yuklanmoqda...</div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                {students.length === 0 ? "Hozircha joylashgan talaba yo'q" : 'Talaba topilmadi'}
              </div>
            ) : (
              filteredStudents.map((student) => {
                const isActive = selectedStudent?.id === student.id
                const accent = genderAccent(student.gender)
                const warnings = student.warning_count ?? 0
                const tone = getWarningTone(warnings, warningThreshold)
                const summary = paySummaries?.get(student.id)

                return (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className={`no-shelf flex w-full items-center gap-3 border-b p-3 text-left transition-colors ${
                      isLight ? 'border-slate-100/50' : 'border-white/5'
                    } ${
                      isActive
                        ? isLight
                          ? 'bg-[#4f6ccf] text-white'
                          : 'bg-[#2b5278] text-white'
                        : isLight
                          ? 'text-slate-900 hover:bg-slate-100'
                          : 'text-white hover:bg-[#202b36]'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="relative h-11 w-11 overflow-hidden rounded-full border border-white/10 bg-slate-800">
                        {student.avatar_url ? (
                          <Image
                            src={student.avatar_url}
                            alt={student.full_name}
                            fill
                            sizes="44px"
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          <div
                            className={`flex h-full w-full items-center justify-center text-xs font-black ${
                              isActive
                                ? 'bg-white/10 text-white'
                                : isLight
                                  ? 'bg-indigo-100 text-indigo-600'
                                  : 'bg-[#24303f] text-[#4f9ed9]'
                            }`}
                          >
                            {getInitials(student.full_name)}
                          </div>
                        )}
                      </div>

                      {/* Gender dot */}
                      <span
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 ${
                          isLight ? 'border-white' : 'border-[#17212b]'
                        } ${accent.dot}`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="truncate text-xs font-bold leading-none">{student.full_name}</p>
                        <span className="flex shrink-0 items-center gap-1">
                          {student.is_floor_captain && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                                isActive
                                  ? 'border-transparent bg-white/20 text-white'
                                  : 'border border-violet-500/30 bg-violet-500/15 text-violet-500 dark:text-violet-300'
                              }`}
                            >
                              Sardor
                            </span>
                          )}
                          {warnings > 0 && (
                            <span
                              className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                                isActive ? 'border-white/10 bg-white/20 text-white' : WARNING_BADGE_CLASSES[tone]
                              }`}
                            >
                              <span
                                className={`h-1 w-1 rounded-full ${isActive ? 'bg-white' : WARNING_DOT_CLASSES[tone]}`}
                              />
                              {warnings}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p
                          className={`truncate text-[10px] ${
                            isActive ? 'text-indigo-100' : isLight ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        >
                          {student.room_number ? `Xona: ${student.room_number}` : student.email}
                        </p>
                        {summary && (
                          <span
                            className={`shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                              isActive ? 'border-white/10 bg-white/20 text-white' : PAY_STATE_BADGE_CLASSES[summary.state]
                            }`}
                          >
                            {summary.state === 'paid' ? "To'lagan" : formatSum(summary.remaining)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right: student details */}
        <div
          className={`col-span-12 h-full min-h-0 overflow-hidden md:col-span-8 lg:col-span-9 ${
            isLight ? 'bg-slate-50' : 'bg-[#0e1621]'
          } ${!selectedStudent ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}
        >
          {!selectedStudent ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div
                className={`mb-4 rounded-full p-6 ${
                  isLight ? 'bg-slate-200 text-slate-400' : 'border border-white/5 bg-[#182533] text-slate-500'
                }`}
              >
                <UsersRound size={48} />
              </div>
              <p className={`max-w-xs text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Talabaning to&apos;liq ma&apos;lumotlari va to&apos;lov holatini ko&apos;rish uchun chap ro&apos;yxatdan tanlang
              </p>
            </div>
          ) : (
            <>
              {/* Selected student header */}
              <div
                className={`flex shrink-0 flex-col justify-between gap-3 border-b p-4 sm:flex-row sm:items-center ${
                  isLight ? 'border-slate-200 bg-white' : 'border-white/5 bg-[#17212b]'
                }`}
              >
                <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
                  <button
                    onClick={() => setSelectedStudent(null)}
                    className="-ml-2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 md:hidden"
                    aria-label="Ro'yxatga qaytish"
                  >
                    <ArrowLeft size={20} />
                  </button>

                  <div
                    className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-full border border-white/10 bg-slate-800"
                    onClick={() => selectedStudent.avatar_url && setFullScreenImage(selectedStudent.avatar_url)}
                  >
                    {selectedStudent.avatar_url ? (
                      <Image
                        src={selectedStudent.avatar_url}
                        alt={selectedStudent.full_name}
                        fill
                        sizes="44px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-indigo-500/20 text-xs font-black text-indigo-300">
                        {getInitials(selectedStudent.full_name)}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-sm font-bold leading-tight text-slate-900 dark:text-white">
                      {selectedStudent.full_name}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />
                        {selectedStudent.room_number}-xonada joylashgan
                      </span>
                      {selectedSummary && (
                        <span
                          className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            PAY_STATE_BADGE_CLASSES[selectedSummary.state]
                          }`}
                        >
                          {PAY_STATE_LABELS[selectedSummary.state]}
                          {selectedSummary.state !== 'paid' && ` — ${formatSum(selectedSummary.remaining)}`}
                        </span>
                      )}
                      <span
                        className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          WARNING_BADGE_CLASSES[getWarningTone(selectedStudent.warning_count ?? 0, warningThreshold)]
                        }`}
                      >
                        {(selectedStudent.warning_count ?? 0) === 0 ? (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Ogohlantirish yo&apos;q (A&apos;lo)
                          </>
                        ) : (
                          <>
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                WARNING_DOT_CLASSES[
                                  getWarningTone(selectedStudent.warning_count ?? 0, warningThreshold)
                                ]
                              }`}
                            />
                            {selectedStudent.warning_count} ta ogohlantirish
                          </>
                        )}
                      </span>
                      {selectedStudent.is_floor_captain && (
                        <span className="shrink-0 whitespace-nowrap rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-300">
                          Qavat sardori
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex w-full shrink-0 items-center justify-start gap-2 sm:w-auto sm:justify-end">
                  <button
                    onClick={openWarningModal}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white transition-all hover:bg-amber-600 active:scale-95"
                  >
                    <AlertTriangle size={14} />
                    Ogohlantirish
                  </button>
                </div>
              </div>

              {/* Details body */}
              <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {/* Tab menu */}
                <div
                  className={`no-scrollbar flex flex-nowrap gap-1 overflow-x-auto rounded-full border p-1 ${
                    isLight ? 'border-slate-200 bg-slate-100' : 'border-white/5 bg-white/5'
                  }`}
                >
                  {([
                    { key: 'profil', label: 'Profil' },
                    { key: 'hujjatlar', label: 'Hujjat & Manzil' },
                    { key: 'oila', label: 'Oila' },
                    { key: 'tolovlar', label: "To'lovlar" },
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setDetailTab(tab.key)}
                      className={`flex-1 shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all sm:px-4 ${
                        detailTab === tab.key
                          ? 'bg-indigo-600 text-white shadow-lg'
                          : isLight
                            ? 'text-slate-500 hover:text-slate-800'
                            : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab: Profil */}
                {detailTab === 'profil' && (
                  <div className={`space-y-3.5 rounded-2xl border p-4 shadow-md ${cardSurface}`}>
                    <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400">
                      Asosiy ma&apos;lumotlar
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {studentInfoItems(selectedStudent)
                        .filter((item) => !HUJJAT_LABELS.includes(item.label))
                        .map((item) => {
                          const Icon = item.icon
                          return (
                            <div key={item.label} className="flex items-center gap-3">
                              <div className={`shrink-0 rounded-lg p-2.5 ${infoTileSurface}`}>
                                <Icon size={16} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`truncate text-xs font-semibold ${infoValueText}`}>{item.value}</p>
                                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                  {item.label}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* Tab: Hujjatlar */}
                {detailTab === 'hujjatlar' && (
                  <div className={`space-y-3.5 rounded-2xl border p-4 shadow-md ${cardSurface}`}>
                    <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-violet-500 dark:text-violet-400">
                      Hujjat va manzillar
                    </h3>
                    {studentInfoItems(selectedStudent).filter((item) => HUJJAT_LABELS.includes(item.label)).length ===
                    0 ? (
                      <p className="text-xs text-slate-400">Kiritilmagan</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {studentInfoItems(selectedStudent)
                          .filter((item) => HUJJAT_LABELS.includes(item.label))
                          .map((item) => {
                            const Icon = item.icon
                            return (
                              <div key={item.label} className="flex items-center gap-3">
                                <div className={`shrink-0 rounded-lg p-2.5 ${infoTileSurface}`}>
                                  <Icon size={16} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={`truncate text-xs font-semibold ${infoValueText}`}>{item.value}</p>
                                  <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                    {item.label}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Oila */}
                {detailTab === 'oila' && (
                  <div className={`space-y-3.5 rounded-2xl border p-4 shadow-md ${cardSurface}`}>
                    <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 dark:text-emerald-400">
                      Oila a&apos;zolari
                    </h3>
                    {familyInfoItems(selectedStudent).length === 0 ? (
                      <p className="text-xs text-slate-400">Kiritilmagan</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {familyInfoItems(selectedStudent).map((item) => (
                          <div key={item.label} className="flex items-center gap-3">
                            <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                            <div className="min-w-0 flex-1">
                              <p className={`truncate text-xs font-semibold ${infoValueText}`}>{item.value}</p>
                              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                {item.label}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: To'lovlar */}
                {detailTab === 'tolovlar' && (
                  <div className="space-y-4">
                    {settingsStatus === 'loading' ? (
                      <div
                        className={`rounded-2xl border p-6 text-center text-xs shadow-md ${
                          isLight ? 'border-slate-200/50 bg-white text-slate-500' : 'border-white/5 bg-[#182533] text-slate-400'
                        }`}
                      >
                        Shartnoma summasi sozlamasi yuklanmoqda...
                      </div>
                    ) : settingsStatus === 'error' ? (
                      <div
                        className={`rounded-2xl border p-6 text-center text-xs shadow-md ${
                          isLight ? 'border-rose-200 bg-white text-rose-600' : 'border-rose-500/20 bg-[#182533] text-rose-400'
                        }`}
                      >
                        <p>Shartnoma summasi sozlamasini yuklab bo&apos;lmadi.</p>
                        <button
                          type="button"
                          onClick={() => void loadSettings()}
                          className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 font-black uppercase tracking-wider transition-colors hover:bg-rose-500/20"
                        >
                          Qayta urinish
                        </button>
                      </div>
                    ) : selectedSummary ? (
                      <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {[
                            {
                              label: "To'langan summa",
                              value: selectedSummary.paid,
                              icon: CheckCircle2,
                              tint: 'bg-emerald-500/10 text-emerald-500',
                            },
                            {
                              label: 'Qolgan summa',
                              value: selectedSummary.remaining,
                              icon: DollarSign,
                              tint: 'bg-rose-500/10 text-rose-500',
                            },
                            {
                              label: 'Shartnoma miqdori',
                              value: selectedSummary.contractFee,
                              icon: FileText,
                              tint: 'bg-violet-500/10 text-violet-400',
                            },
                            {
                              label: "Kutilayotgan to'lovlar",
                              value: selectedSummary.waiting,
                              icon: Clock,
                              tint: 'bg-amber-500/10 text-amber-500',
                            },
                          ].map((card) => {
                            const Icon = card.icon
                            return (
                              <div
                                key={card.label}
                                className={`flex items-center gap-3 rounded-2xl border p-4 shadow-md ${cardSurface}`}
                              >
                                <div className={`shrink-0 rounded-lg p-2.5 ${card.tint}`}>
                                  <Icon size={20} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm font-black leading-none ${infoValueText}`}>
                                    {card.value.toLocaleString('uz-UZ')} UZS
                                  </p>
                                  <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                    {card.label}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div className={`rounded-2xl border p-4 shadow-md ${cardSurface}`}>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              To&apos;lov progressi
                            </span>
                            <span className="text-xs font-black text-emerald-500">
                              {selectedSummary.progressPercent}%
                            </span>
                          </div>
                          <div
                            className={`h-2.5 w-full overflow-hidden rounded-full border border-white/5 ${
                              isLight ? 'bg-slate-100' : 'bg-slate-800/40'
                            }`}
                          >
                            <div
                              className="h-2.5 rounded-full bg-linear-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                              style={{ width: `${selectedSummary.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </>
                    ) : null}

                    <div className={`rounded-2xl border p-4 shadow-md ${cardSurface}`}>
                      <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400">
                        To&apos;lov kvitansiyalari tarixi
                      </h3>

                      {paymentsLoading ? (
                        <p className="py-4 text-center text-xs text-slate-500">Yuklanmoqda...</p>
                      ) : selectedPayments.length === 0 ? (
                        <p className="py-4 text-center text-xs text-slate-500">
                          To&apos;lov kvitansiyalari mavjud emas
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {selectedPayments.map((record) => {
                            const isApproved = APPROVED_PAYMENT_STATUSES.has(record.status)
                            const isWaiting = WAITING_PAYMENT_STATUSES.has(record.status)

                            return (
                              <div
                                key={record.id}
                                className={`rounded-xl border p-3 text-xs ${
                                  isLight ? 'border-slate-100 bg-slate-50' : 'border-white/5 bg-[#1b2836]'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className={`font-bold ${infoValueText}`}>
                                      {record.month}, {record.year}
                                    </p>
                                    <p className="mt-0.5 text-[10px] text-slate-400">
                                      Summa: {record.amount.toLocaleString('uz-UZ')} UZS
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    {record.has_receipt && (
                                      <span
                                        className="flex items-center gap-1 text-[9px] font-bold text-slate-400"
                                        title="Chek yuklangan (faylni faqat admin ko'ra oladi)"
                                      >
                                        <Receipt size={12} />
                                        Chek
                                      </span>
                                    )}
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${
                                        isApproved
                                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                                          : isWaiting
                                            ? 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                                            : 'border-rose-500/20 bg-rose-500/10 text-rose-500'
                                      }`}
                                    >
                                      {isApproved ? 'Tasdiqlangan' : isWaiting ? 'Kutilmoqda' : 'Rad etilgan'}
                                    </span>
                                  </div>
                                </div>
                                {record.admin_message && (
                                  <p className="mt-2 border-t border-white/5 pt-2 text-[10px] italic text-slate-400">
                                    Admin izohi: {record.admin_message}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Roommates */}
                {roommates.length > 0 && (
                  <div className={`rounded-2xl border p-4 shadow-md ${cardSurface}`}>
                    <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 dark:text-emerald-400">
                      Xonadoshlar
                    </h3>
                    <div className="flex flex-wrap gap-4">
                      {roommates.map((roommate) => (
                        <button
                          key={roommate.id}
                          type="button"
                          className="group flex flex-col items-center gap-1.5"
                          title={roommate.full_name}
                          onClick={() => setSelectedStudent(roommate)}
                        >
                          <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-all group-hover:scale-105 group-hover:border-emerald-500/50">
                            {roommate.avatar_url ? (
                              <Image
                                src={roommate.avatar_url}
                                alt={roommate.full_name}
                                fill
                                sizes="48px"
                                unoptimized
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-emerald-500/20 to-teal-500/20 text-[10px] font-black text-emerald-600 dark:text-emerald-200">
                                {getInitials(roommate.full_name)}
                              </div>
                            )}
                          </div>
                          <span className="max-w-[64px] truncate text-[9px] font-bold text-slate-500 dark:text-slate-400">
                            {roommate.full_name.split(' ')[0]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className={`rounded-2xl border p-4 text-center ${
                    isLight ? 'border-slate-200/50 bg-slate-100' : 'border-white/5 bg-[#182533]/50'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Ro&apos;yxatdan o&apos;tgan sana: {formatDate(selectedStudent.created_at)}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Warning / reminder modal */}
      <ConfirmModal
        isOpen={warningModalOpen}
        title="Ogohlantirish yuborish"
        description={selectedStudent ? `${selectedStudent.full_name} uchun xabar` : undefined}
        onClose={() => setWarningModalOpen(false)}
        onConfirm={handleSendWarning}
        confirmText="Yuborish"
        confirmVariant={warningLevel === 'warning' ? 'danger' : 'primary'}
        isLoading={sendingWarning}
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Daraja</label>
            <div className={`grid grid-cols-2 gap-2 rounded-2xl border p-1 ${
              isLight ? 'border-slate-200 bg-slate-100' : 'border-white/5 bg-white/5'
            }`}>
              {([
                { key: 'info', label: 'Eslatma', hint: "Hisobga qo'shilmaydi" },
                { key: 'warning', label: 'Ogohlantirish', hint: "Intizomiy hisobga qo'shiladi" },
              ] as const).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setWarningLevel(option.key)}
                  className={`rounded-xl px-3 py-2.5 text-center transition-all ${
                    warningLevel === option.key
                      ? option.key === 'warning'
                        ? 'bg-amber-500 text-white shadow-lg'
                        : 'bg-indigo-600 text-white shadow-lg'
                      : isLight
                        ? 'text-slate-500 hover:text-slate-800'
                        : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="block text-[11px] font-black uppercase tracking-wider">{option.label}</span>
                  <span className="mt-0.5 block text-[9px] font-medium opacity-80">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Xabar matni</label>
            <textarea
              value={warningText}
              onChange={(event) => setWarningText(event.target.value)}
              rows={5}
              maxLength={1000}
              placeholder="Talabaga yetkazmoqchi bo'lgan xabaringizni yozing..."
              className={`w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none transition-all ${
                isLight
                  ? 'border-slate-200 bg-slate-50 text-slate-900 focus:border-indigo-500 focus:bg-white'
                  : 'border-white/10 bg-white/5 text-white focus:border-indigo-500/50'
              }`}
            />
            <p className="mt-1 text-right text-[10px] font-bold text-slate-500">{warningText.length}/1000</p>
          </div>

          <div
            className={`rounded-xl border p-3 text-[11px] leading-relaxed ${
              warningLevel === 'warning'
                ? 'border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-300/80'
                : 'border-indigo-500/20 bg-indigo-500/5 text-indigo-600 dark:text-indigo-300/80'
            }`}
          >
            {warningLevel === 'warning' ? (
              <>
                Bu xabar talabaning <span className="font-black">intizomiy hisobiga qo&apos;shiladi</span>, uning
                &quot;Ogohlantirishlar&quot; ro&apos;yxatida va bildirishnomalarida ko&apos;rinadi hamda emailga
                yuboriladi. Ogohlantirishlar soni belgilangan chegaradan oshsa, chetlatilishga sabab bo&apos;lishi
                mumkin.
              </>
            ) : (
              <>
                Eslatma talabaning bildirishnomalariga tushadi va emailga yuboriladi, lekin intizomiy hisobiga
                <span className="font-black"> ta&apos;sir qilmaydi</span>. To&apos;lov qarzi haqidagi birinchi murojaat
                uchun shu darajani tanlang.
              </>
            )}
          </div>
        </div>
      </ConfirmModal>

      {/* Full screen avatar */}
      <AnimatePresence>
        {fullScreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFullScreenImage(null)}
            className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/95 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative aspect-square w-full max-w-2xl overflow-hidden rounded-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <Image src={fullScreenImage} alt="Talaba rasmi" fill className="object-cover" unoptimized />
            </motion.div>
            <button className="absolute right-6 top-6 text-white/50 transition-colors hover:text-white" aria-label="Yopish">
              <X size={32} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
