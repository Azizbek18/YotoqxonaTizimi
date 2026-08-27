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
  UserX,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useThemeStore } from '@/lib/stores/theme-store'
import {
  fetchFacultyPayments,
  fetchFacultyStudents,
  sendStudentWarning,
  setStudentBlacklist,
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
import { useRoomFloors } from '@/lib/hooks/useRoomFloors'
import { permitFacultyLabel } from '@/lib/faculties'
import { directionLabel } from '@/lib/directions'
import { genderAccent, genderLabel, normalizeGender } from '@/lib/gender'
import { dekanUI, statusChip } from '@/lib/dekan-ui'

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
  danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  unknown: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
}

const WARNING_DOT_CLASSES: Record<WarningTone, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  danger: 'bg-rose-500',
  unknown: 'bg-slate-400',
}

const HUJJAT_LABELS = ['Passport seriya', 'JSHSHIR', 'Passport sanasi', 'Hudud', 'Millati', 'Jinsi']

type FolderKey = 'all' | 'roomless' | 'debtor' | 'paid' | 'male' | 'female' | 'captain' | 'warned' | 'blacklisted'

export default function DekanStudentsPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const ui = dekanUI(isLight)

  const { floorOf } = useRoomFloors()

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

  const [blacklistModalOpen, setBlacklistModalOpen] = useState(false)
  const [blacklistReason, setBlacklistReason] = useState('')
  const [blacklistBusy, setBlacklistBusy] = useState(false)

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
      // 'all', not 'placed' — a student removed from their room (room_number
      // cleared) stays an active student of this faculty and must still be
      // visible here (in the "Xonasiz" folder) so the dekan can re-house them.
      const rows = await fetchFacultyStudents('all')
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
      if (activeFolder === 'roomless') {
        matchesFolder = !student.room_number
      } else if (activeFolder === 'blacklisted') {
        matchesFolder = Boolean(student.blacklisted)
      } else if (activeFolder === 'male' || activeFolder === 'female') {
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

  const studentInfoItems = (student: StudentProfileRow) => {
    // Read the floor off the admin's qavat tarxi rather than the student's
    // stored assigned_floor, so a room moved between floors shows up here
    // immediately instead of after the next re-assignment.
    const floor = floorOf(student.room_number) ?? student.assigned_floor
    return [
      { icon: Mail, label: 'Email', value: student.email },
      { icon: Phone, label: 'Telefon', value: student.phone_number },
      { icon: GraduationCap, label: 'Fakultet', value: permitFacultyLabel(student.faculty) || undefined },
      { icon: GraduationCap, label: "Yo'nalish", value: directionLabel(student.direction) || undefined },
      { icon: ShieldCheck, label: 'Kurs', value: student.course ? `${student.course}-kurs` : undefined },
      { icon: Home, label: 'Xona', value: student.room_number },
      { icon: BedDouble, label: 'Qavat', value: floor ? `${floor}-qavat` : undefined },
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
  }

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

  const handleToggleBlacklist = async () => {
    if (!selectedStudent || blacklistBusy) return
    const next = !selectedStudent.blacklisted
    if (next && blacklistReason.trim().length < 5) {
      toast.error('Chetlatish sababini yozing')
      return
    }
    setBlacklistBusy(true)
    try {
      const result = await setStudentBlacklist({
        studentId: selectedStudent.id,
        blacklisted: next,
        reason: next ? blacklistReason.trim() : undefined,
      })
      // Blacklisting also frees the room server-side — mirror that locally.
      const patch: Partial<StudentProfileRow> = result.blacklisted
        ? { blacklisted: true, room_number: null, assigned_floor: null, is_floor_captain: false }
        : { blacklisted: false }
      setStudents((prev) =>
        prev.map((student) => (student.id === selectedStudent.id ? { ...student, ...patch } : student)),
      )
      setSelectedStudent((prev) => (prev ? { ...prev, ...patch } : prev))
      toast.success(result.blacklisted ? 'Talaba yotoqxonadan chetlatildi' : 'Chetlatish bekor qilindi')
      setBlacklistModalOpen(false)
      setBlacklistReason('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Amalni bajarib bo'lmadi")
    } finally {
      setBlacklistBusy(false)
    }
  }

  const totalCount = students.length || 1
  const roomlessCount = students.filter((student) => !student.room_number).length
  const placedCount = students.length - roomlessCount
  const blacklistedCount = students.filter((student) => student.blacklisted).length
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
      title: 'Jami talabalar',
      count: students.length,
      percentage: 100,
      icon: Users,
      description:
        roomlessCount > 0
          ? `${placedCount} joylashgan · ${roomlessCount} xonasiz`
          : captainCount > 0
            ? `${captainCount} ta qavat sardori`
            : undefined,
    },
    {
      title: "O'g'il bolalar",
      count: maleCount,
      percentage: Math.round((maleCount / totalCount) * 100),
      icon: UserRound,
    },
    {
      title: 'Qiz bolalar',
      count: femaleCount,
      percentage: Math.round((femaleCount / totalCount) * 100),
      icon: UsersRound,
    },
    {
      title: "To'liq to'laganlar",
      count: paidCount,
      percentage: paidCount === null ? 0 : Math.round((paidCount / totalCount) * 100),
      icon: CheckCircle2,
    },
    {
      title: 'Qarzdorlar',
      count: debtorCount,
      percentage: debtorCount === null ? 0 : Math.round((debtorCount / totalCount) * 100),
      icon: DollarSign,
      description: totalDebt ? `Jami qarz: ${formatSum(totalDebt)}` : undefined,
    },
    {
      title: 'Kutilayotgan cheklar',
      count: waitingCount,
      percentage: payments.length ? Math.round((waitingCount / payments.length) * 100) : 0,
      icon: Clock,
      description: waitingCount > 0 ? 'Admin tasdig‘ini kutmoqda' : undefined,
    },
  ]

  const folders: { key: FolderKey; label: string; count: number | null }[] = [
    { key: 'all', label: 'Barchasi', count: students.length },
    { key: 'roomless', label: 'Xonasiz', count: roomlessCount },
    { key: 'debtor', label: 'Qarzdor', count: debtorCount },
    { key: 'paid', label: "To'lagan", count: paidCount },
    { key: 'male', label: "O'g'il", count: maleCount },
    { key: 'female', label: 'Qiz', count: femaleCount },
    { key: 'captain', label: 'Sardorlar', count: captainCount },
    { key: 'warned', label: 'Ogohlantirilgan', count: warnedCount },
    { key: 'blacklisted', label: 'Chetlatilgan', count: blacklistedCount },
  ]

  const cardSurface = ui.card
  const infoTileSurface = isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-800/40 text-slate-400'
  const infoValueText = ui.strong
  const busy = loading || paymentsLoading

  return (
    <div>
      {/* Title Header */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${ui.strong}`}>Talabalar</h1>
          <p className={`mt-1 text-xs sm:text-sm ${ui.muted}`}>
            Ro&apos;yxatdan o&apos;tib, yotoqxonaga to&apos;liq joylashtirilgan fakultet talabalari va ularning to&apos;lov holati
          </p>
        </div>

        <button
          onClick={refreshAll}
          disabled={busy}
          className={`inline-flex items-center justify-center rounded-lg border p-3 transition-colors disabled:opacity-50 ${ui.btnGhost}`}
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.2 }}
              className={`rounded-2xl border p-5 ${ui.card} ${ui.hoverLift}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${ui.muted}`}>{card.title}</p>
                  <p className={`mt-2 text-3xl font-bold leading-none tracking-tight ${ui.strong}`}>
                    {busy ? '...' : card.count ?? '—'}
                  </p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${ui.accentTile}`}>
                  <Icon size={20} strokeWidth={2.2} />
                </div>
              </div>

              <div className="mt-4">
                <div className={`mb-1 flex items-center justify-between text-[10px] font-semibold ${ui.faint}`}>
                  <span>ULUSH</span>
                  <span>{busy || card.count === null ? '...' : `${card.percentage}%`}</span>
                </div>
                <div className={`h-1.5 w-full overflow-hidden rounded-full ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: busy || card.count === null ? 0 : `${card.percentage}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full bg-indigo-600"
                  />
                </div>
              </div>

              {card.description && !busy && (
                <p className={`mt-2 text-[10px] font-medium ${ui.muted}`}>{card.description}</p>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Split list / detail layout */}
      <div
        className={`grid h-[620px] grid-cols-1 overflow-hidden rounded-2xl border md:grid-cols-12 ${ui.card}`}
      >
        {/* Left: students list */}
        <div
          className={`col-span-12 h-full min-h-0 border-r md:col-span-4 lg:col-span-3 ${
            isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-900'
          } ${selectedStudent ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}
        >
          {/* Search inputs */}
          <div className="space-y-2.5 p-4">
            <div className="relative">
              <Search className={`absolute left-3 top-3.5 ${ui.faint}`} size={16} />
              <input
                type="text"
                placeholder="Ism yoki email bo'yicha..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className={`w-full rounded-lg border py-3 pl-10 pr-4 text-xs transition-colors ${ui.input} ${ui.ring}`}
              />
            </div>
            <div className="relative">
              <Home className={`absolute left-3 top-3.5 ${ui.faint}`} size={16} />
              <input
                type="text"
                placeholder="Xona raqami bo'yicha..."
                value={filterRoom}
                onChange={(event) => setFilterRoom(event.target.value)}
                className={`w-full rounded-lg border py-3 pl-10 pr-4 text-xs transition-colors ${ui.input} ${ui.ring}`}
              />
            </div>
          </div>

          {/* Folder tabs */}
          <div className={`no-scrollbar flex gap-1 overflow-x-auto border-b px-4 pb-2 ${ui.border}`}>
            {folders.map((folder) => {
              const isActive = activeFolder === folder.key
              const disabled = folder.count === null
              return (
                <button
                  key={folder.key}
                  onClick={() => !disabled && setActiveFolder(folder.key)}
                  disabled={disabled}
                  className={`relative shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : `${ui.muted} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'}`
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {folder.label}
                    {folder.count !== null && folder.count > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : isLight ? 'bg-slate-200 text-slate-600' : 'bg-slate-700 text-slate-300'
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
              <div className={`p-8 text-center text-xs ${ui.faint}`}>Yuklanmoqda...</div>
            ) : filteredStudents.length === 0 ? (
              <div className={`p-8 text-center text-xs ${ui.faint}`}>
                {students.length === 0 ? "Hozircha bu fakultetda talaba yo'q" : 'Talaba topilmadi'}
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
                    className={`no-shelf flex w-full items-center gap-3 border-b p-3 text-left transition-colors ${ui.border} ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : `${ui.strong} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800/70'}`
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className={`relative h-11 w-11 overflow-hidden rounded-lg ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
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
                            className={`flex h-full w-full items-center justify-center text-xs font-bold ${
                              isActive
                                ? 'bg-white/10 text-white'
                                : isLight ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {getInitials(student.full_name)}
                          </div>
                        )}
                      </div>

                      {/* Gender dot */}
                      <span
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ${
                          isLight ? 'ring-white' : 'ring-slate-900'
                        } ${accent.dot}`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="truncate text-xs font-semibold leading-none">{student.full_name}</p>
                        <span className="flex shrink-0 items-center gap-1">
                          {student.blacklisted && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                                isActive ? 'bg-white/20 text-white' : statusChip('danger', isLight).chip
                              }`}
                            >
                              Chetlatilgan
                            </span>
                          )}
                          {student.is_floor_captain && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                                isActive ? 'bg-white/20 text-white' : (isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-300')
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
                        <p className={`truncate text-[10px] ${isActive ? 'text-indigo-100' : ui.muted}`}>
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
            isLight ? 'bg-slate-50' : 'bg-slate-950'
          } ${!selectedStudent ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}
        >
          {!selectedStudent ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className={`mb-4 rounded-full p-6 ${isLight ? 'bg-slate-200 text-slate-400' : 'bg-slate-800 text-slate-500'}`}>
                <UsersRound size={48} />
              </div>
              <p className={`max-w-xs text-sm ${ui.muted}`}>
                Talabaning to&apos;liq ma&apos;lumotlari va to&apos;lov holatini ko&apos;rish uchun chap ro&apos;yxatdan tanlang
              </p>
            </div>
          ) : (
            <>
              {/* Selected student header */}
              <div className={`flex shrink-0 flex-col justify-between gap-3 border-b p-4 sm:flex-row sm:items-center ${ui.border} ${isLight ? 'bg-white' : 'bg-slate-900'}`}>
                <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
                  <button
                    onClick={() => setSelectedStudent(null)}
                    className={`-ml-2 rounded-lg p-2 md:hidden ${ui.muted} ${isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'}`}
                    aria-label="Ro'yxatga qaytish"
                  >
                    <ArrowLeft size={20} />
                  </button>

                  <div
                    className={`relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-lg ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}
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
                      <div className={`flex h-full w-full items-center justify-center text-xs font-bold ${isLight ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-slate-300'}`}>
                        {getInitials(selectedStudent.full_name)}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className={`break-words text-sm font-semibold leading-tight ${ui.strong}`}>
                      {selectedStudent.full_name}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {selectedStudent.room_number ? (
                        <span className={`flex items-center gap-1.5 text-[10px] font-semibold ${statusChip('success', isLight).text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusChip('success', isLight).dot}`} />
                          {selectedStudent.room_number}-xonada joylashgan
                        </span>
                      ) : (
                        <span className={`flex items-center gap-1.5 text-[10px] font-semibold ${statusChip('warning', isLight).text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusChip('warning', isLight).dot}`} />
                          Xonasiz — joylashtirilmagan
                        </span>
                      )}
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
                        <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${ui.accentSoft}`}>
                          Qavat sardori
                        </span>
                      )}
                      {selectedStudent.blacklisted && (
                        <span className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${statusChip('danger', isLight).chip}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusChip('danger', isLight).dot}`} />
                          Yotoqxonadan chetlatilgan
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex w-full shrink-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
                  <button
                    onClick={openWarningModal}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${ui.btnGhost}`}
                  >
                    <AlertTriangle size={14} />
                    Ogohlantirish
                  </button>
                  <button
                    onClick={() => { setBlacklistReason(''); setBlacklistModalOpen(true) }}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      selectedStudent.blacklisted ? ui.btnGhost : ui.dangerSoft
                    }`}
                  >
                    <UserX size={14} />
                    {selectedStudent.blacklisted ? 'Chetlatishni bekor qilish' : 'Chetlatish'}
                  </button>
                </div>
              </div>

              {/* Details body */}
              <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {/* Tab menu */}
                <div className={`no-scrollbar flex flex-nowrap gap-1 overflow-x-auto rounded-lg border p-1 ${ui.inset}`}>
                  {([
                    { key: 'profil', label: 'Profil' },
                    { key: 'hujjatlar', label: 'Hujjat & Manzil' },
                    { key: 'oila', label: 'Oila' },
                    { key: 'tolovlar', label: "To'lovlar" },
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setDetailTab(tab.key)}
                      className={`flex-1 shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors sm:px-4 ${
                        detailTab === tab.key
                          ? 'bg-indigo-600 text-white'
                          : `${ui.muted} ${isLight ? 'hover:text-slate-800' : 'hover:text-slate-200'}`
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab: Profil */}
                {detailTab === 'profil' && (
                  <div className={`space-y-3.5 rounded-xl border p-4 ${cardSurface}`}>
                    <h3 className={`mb-2 text-[10px] font-bold uppercase tracking-[0.18em] ${ui.muted}`}>
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
                  <div className={`space-y-3.5 rounded-xl border p-4 ${cardSurface}`}>
                    <h3 className={`mb-2 text-[10px] font-bold uppercase tracking-[0.18em] ${ui.muted}`}>
                      Hujjat va manzillar
                    </h3>
                    {studentInfoItems(selectedStudent).filter((item) => HUJJAT_LABELS.includes(item.label)).length ===
                    0 ? (
                      <p className={`text-xs ${ui.faint}`}>Kiritilmagan</p>
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
                  <div className={`space-y-3.5 rounded-xl border p-4 ${cardSurface}`}>
                    <h3 className={`mb-2 text-[10px] font-bold uppercase tracking-[0.18em] ${ui.muted}`}>
                      Oila a&apos;zolari
                    </h3>
                    {familyInfoItems(selectedStudent).length === 0 ? (
                      <p className={`text-xs ${ui.faint}`}>Kiritilmagan</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {familyInfoItems(selectedStudent).map((item) => (
                          <div key={item.label} className="flex items-center gap-3">
                            <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
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
                      <div className={`rounded-xl border p-6 text-center text-xs ${cardSurface} ${ui.muted}`}>
                        Shartnoma summasi sozlamasi yuklanmoqda...
                      </div>
                    ) : settingsStatus === 'error' ? (
                      <div className={`rounded-xl border p-6 text-center text-xs ${
                        isLight ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-rose-500/25 bg-rose-500/10 text-rose-300'
                      }`}>
                        <p>Shartnoma summasi sozlamasini yuklab bo&apos;lmadi.</p>
                        <button
                          type="button"
                          onClick={() => void loadSettings()}
                          className={`mt-3 rounded-lg px-3 py-2 font-bold uppercase tracking-wider transition-colors ${ui.dangerSoft}`}
                        >
                          Qayta urinish
                        </button>
                      </div>
                    ) : selectedSummary ? (
                      <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {[
                            { label: "To'langan summa", value: selectedSummary.paid, icon: CheckCircle2 },
                            { label: 'Qolgan summa', value: selectedSummary.remaining, icon: DollarSign },
                            { label: 'Shartnoma miqdori', value: selectedSummary.contractFee, icon: FileText },
                            { label: "Kutilayotgan to'lovlar", value: selectedSummary.waiting, icon: Clock },
                          ].map((card) => {
                            const Icon = card.icon
                            return (
                              <div
                                key={card.label}
                                className={`flex items-center gap-3 rounded-xl border p-4 ${cardSurface}`}
                              >
                                <div className={`shrink-0 rounded-lg p-2.5 ${infoTileSurface}`}>
                                  <Icon size={20} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm font-bold leading-none ${infoValueText}`}>
                                    {card.value.toLocaleString('uz-UZ')} UZS
                                  </p>
                                  <p className={`mt-1 text-[9px] font-bold uppercase tracking-wider ${ui.faint}`}>
                                    {card.label}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div className={`rounded-xl border p-4 ${cardSurface}`}>
                          <div className="mb-2 flex items-center justify-between">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>
                              To&apos;lov progressi
                            </span>
                            <span className={`text-xs font-bold ${ui.accentText}`}>
                              {selectedSummary.progressPercent}%
                            </span>
                          </div>
                          <div className={`h-2.5 w-full overflow-hidden rounded-full ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>
                            <div
                              className="h-2.5 rounded-full bg-indigo-600 transition-all duration-500"
                              style={{ width: `${selectedSummary.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </>
                    ) : null}

                    <div className={`rounded-xl border p-4 ${cardSurface}`}>
                      <h3 className={`mb-4 text-[10px] font-bold uppercase tracking-[0.18em] ${ui.muted}`}>
                        To&apos;lov kvitansiyalari tarixi
                      </h3>

                      {paymentsLoading ? (
                        <p className={`py-4 text-center text-xs ${ui.faint}`}>Yuklanmoqda...</p>
                      ) : selectedPayments.length === 0 ? (
                        <p className={`py-4 text-center text-xs ${ui.faint}`}>
                          To&apos;lov kvitansiyalari mavjud emas
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {selectedPayments.map((record) => {
                            const isApproved = APPROVED_PAYMENT_STATUSES.has(record.status)
                            const isWaiting = WAITING_PAYMENT_STATUSES.has(record.status)

                            return (
                              <div key={record.id} className={`rounded-lg border p-3 text-xs ${ui.inset}`}>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className={`font-semibold ${infoValueText}`}>
                                      {record.month}, {record.year}
                                    </p>
                                    <p className={`mt-0.5 text-[10px] ${ui.faint}`}>
                                      Summa: {record.amount.toLocaleString('uz-UZ')} UZS
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    {record.has_receipt && (
                                      <span
                                        className={`flex items-center gap-1 text-[9px] font-bold ${ui.faint}`}
                                        title="Chek yuklangan (faylni faqat admin ko'ra oladi)"
                                      >
                                        <Receipt size={12} />
                                        Chek
                                      </span>
                                    )}
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                        statusChip(isApproved ? 'success' : isWaiting ? 'info' : 'danger', isLight).chip
                                      }`}
                                    >
                                      {isApproved ? 'Tasdiqlangan' : isWaiting ? 'Kutilmoqda' : 'Rad etilgan'}
                                    </span>
                                  </div>
                                </div>
                                {record.admin_message && (
                                  <p className={`mt-2 border-t pt-2 text-[10px] italic ${ui.border} ${ui.faint}`}>
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
                  <div className={`rounded-xl border p-4 ${cardSurface}`}>
                    <h3 className={`mb-4 text-[10px] font-bold uppercase tracking-[0.18em] ${ui.muted}`}>
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
                          <div className={`relative h-12 w-12 overflow-hidden rounded-lg border transition-colors group-hover:border-indigo-400/50 ${ui.border} ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>
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
                              <div className={`flex h-full w-full items-center justify-center text-[10px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                                {getInitials(roommate.full_name)}
                              </div>
                            )}
                          </div>
                          <span className={`max-w-[64px] truncate text-[9px] font-semibold ${ui.muted}`}>
                            {roommate.full_name.split(' ')[0]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className={`rounded-xl border p-4 text-center ${ui.inset}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${ui.muted}`}>
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
            <label className={`mb-2 block text-xs font-bold uppercase tracking-wider ${ui.muted}`}>Daraja</label>
            <div className={`grid grid-cols-2 gap-1 rounded-lg border p-1 ${ui.inset}`}>
              {([
                { key: 'info', label: 'Eslatma', hint: "Hisobga qo'shilmaydi" },
                { key: 'warning', label: 'Ogohlantirish', hint: "Intizomiy hisobga qo'shiladi" },
              ] as const).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setWarningLevel(option.key)}
                  className={`rounded-md px-3 py-2.5 text-center transition-colors ${
                    warningLevel === option.key
                      ? option.key === 'warning'
                        ? 'bg-amber-500 text-white'
                        : 'bg-indigo-600 text-white'
                      : `${ui.muted} ${isLight ? 'hover:text-slate-800' : 'hover:text-slate-200'}`
                  }`}
                >
                  <span className="block text-[11px] font-bold uppercase tracking-wider">{option.label}</span>
                  <span className="mt-0.5 block text-[9px] font-medium opacity-80">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={`mb-2 block text-xs font-bold uppercase tracking-wider ${ui.muted}`}>Xabar matni</label>
            <textarea
              value={warningText}
              onChange={(event) => setWarningText(event.target.value)}
              rows={5}
              maxLength={1000}
              placeholder="Talabaga yetkazmoqchi bo'lgan xabaringizni yozing..."
              className={`w-full resize-none rounded-lg border px-4 py-3 text-sm transition-colors ${ui.input} ${ui.ring}`}
            />
            <p className={`mt-1 text-right text-[10px] font-medium ${ui.faint}`}>{warningText.length}/1000</p>
          </div>

          <div
            className={`rounded-lg border p-3 text-[11px] leading-relaxed ${
              warningLevel === 'warning'
                ? (isLight ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-amber-500/25 bg-amber-500/10 text-amber-200')
                : (isLight ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-indigo-500/25 bg-indigo-500/10 text-indigo-200')
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

      {/* Blacklist / reinstate modal */}
      <ConfirmModal
        isOpen={blacklistModalOpen}
        title={selectedStudent?.blacklisted ? 'Chetlatishni bekor qilish' : 'Yotoqxonadan chetlatish'}
        description={selectedStudent ? selectedStudent.full_name : undefined}
        onClose={() => setBlacklistModalOpen(false)}
        onConfirm={handleToggleBlacklist}
        confirmText={selectedStudent?.blacklisted ? 'Bekor qilish' : 'Chetlatish'}
        confirmVariant={selectedStudent?.blacklisted ? 'primary' : 'danger'}
        isLoading={blacklistBusy}
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          {selectedStudent?.blacklisted ? (
            <div className={`rounded-lg border p-3 text-[11px] leading-relaxed ${isLight ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-indigo-500/25 bg-indigo-500/10 text-indigo-200'}`}>
              Talaba yana yotoqxona tizimidan to&apos;liq foydalana oladi. <span className="font-black">Xona avtomatik qaytarilmaydi</span> — «Xonalar» bo&apos;limidan qayta biriktiring.
            </div>
          ) : (
            <>
              <div>
                <label className={`mb-2 block text-xs font-bold uppercase tracking-wider ${ui.muted}`}>Chetlatish sababi</label>
                <textarea
                  value={blacklistReason}
                  onChange={(event) => setBlacklistReason(event.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Nima sababdan chetlatilmoqda? (talabaga emailda yuboriladi)"
                  className={`w-full resize-none rounded-lg border px-4 py-3 text-sm transition-colors ${ui.input} ${ui.ring}`}
                />
                <p className={`mt-1 text-right text-[10px] font-medium ${ui.faint}`}>{blacklistReason.length}/1000</p>
              </div>
              <div className={`rounded-lg border p-3 text-[11px] leading-relaxed ${isLight ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-rose-500/25 bg-rose-500/10 text-rose-200'}`}>
                Talaba <span className="font-black">qora ro&apos;yxatga</span> olinadi, unga biriktirilgan <span className="font-black">xona bo&apos;shatiladi</span> (sardorlik ham olib tashlanadi) va talabaga email yuboriladi. Bu amalni keyin bekor qilish mumkin, lekin xona qo&apos;lda qayta biriktiriladi.
              </div>
            </>
          )}
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
