'use client'

import { isRoommate } from '@/lib/roommates'
import { studentsInDorm } from '@/features/faculty-students/domain/dorm-scope'
import { fetchDekanDorm } from '@/features/dorms/client/api'
import type { DekanDorm } from '@/features/dorms/types'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  Edit2,
  FileText,
  GraduationCap,
  Home,
  Mail,
  MapPin,
  MoreVertical,
  Phone,
  Receipt,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  User,
  Users,
  UserRound,
  UsersRound,
  UserX,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import CustomSelect from '@/components/ui/CustomSelect'
import { Skel } from '@/components/dekan/Skeletons'
import { useThemeStore } from '@/lib/stores/theme-store'
import {
  deleteFacultyStudent,
  fetchFacultyPayments,
  fetchFacultyStudents,
  sendStudentWarning,
  setStudentBlacklist,
  setStudentCouncilChair,
  setStudentFloorCaptain,
  updateFacultyStudent,
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
import { useStaffPanel } from '@/lib/hooks/useStaffPanel'
import { permitFacultyLabel } from '@/lib/faculties'
import { directionLabel, directionsForFaculty, normalizeDirection } from '@/lib/directions'
import { GENDER_OPTIONS, genderAccent, genderLabel, normalizeGender } from '@/lib/gender'
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

// Editable fields, grouped to match the read-only detail tabs. Room / floor /
// warnings / status are intentionally not here — see FacultyStudentPatch in
// features/faculty-students/client/api.ts. Captaincy has its own action button
// (setStudentFloorCaptain), not a form field.
type EditTabKey = 'asosiy' | 'hujjatlar' | 'oila'

const EMPTY_EDIT_FORM = {
  full_name: '',
  middle_name: '',
  phone: '',
  course: '',
  direction: '',
  gender: '',
  birth_date: '',
  nationality: '',
  study_type: '',
  entry_date: '',
  passport_series: '',
  jshshir: '',
  passport_date: '',
  region: '',
  district: '',
  mahalla: '',
  father_full_name: '',
  father_workplace: '',
  father_phone: '',
  mother_full_name: '',
  mother_workplace: '',
  mother_phone: '',
}

type EditFieldKey = keyof typeof EMPTY_EDIT_FORM

const EDIT_TABS: { key: EditTabKey; label: string }[] = [
  { key: 'asosiy', label: 'Asosiy' },
  { key: 'hujjatlar', label: 'Hujjat & Manzil' },
  { key: 'oila', label: 'Oila' },
]

const EDIT_FIELDS: Record<EditTabKey, { key: EditFieldKey; label: string; type: 'text' | 'number' | 'date' }[]> = {
  asosiy: [
    { key: 'full_name', label: "To'liq ism", type: 'text' },
    { key: 'middle_name', label: 'Sharifi', type: 'text' },
    { key: 'phone', label: 'Telefon', type: 'text' },
    { key: 'course', label: 'Kurs', type: 'number' },
    { key: 'direction', label: "Yo'nalish", type: 'text' },
    { key: 'gender', label: 'Jinsi', type: 'text' },
    { key: 'birth_date', label: "Tug'ilgan sana", type: 'date' },
    { key: 'nationality', label: 'Millati', type: 'text' },
    { key: 'study_type', label: "Ta'lim turi", type: 'text' },
    { key: 'entry_date', label: 'Yotoqxonaga kirgan sana', type: 'date' },
  ],
  hujjatlar: [
    { key: 'passport_series', label: 'Passport seriya', type: 'text' },
    { key: 'jshshir', label: 'JSHSHIR', type: 'text' },
    { key: 'passport_date', label: 'Passport sanasi', type: 'date' },
    { key: 'region', label: 'Viloyat', type: 'text' },
    { key: 'district', label: 'Tuman', type: 'text' },
    { key: 'mahalla', label: 'Mahalla', type: 'text' },
  ],
  oila: [
    { key: 'father_full_name', label: 'Ota F.I.Sh.', type: 'text' },
    { key: 'father_workplace', label: 'Ota ish joyi', type: 'text' },
    { key: 'father_phone', label: 'Ota telefoni', type: 'text' },
    { key: 'mother_full_name', label: 'Ona F.I.Sh.', type: 'text' },
    { key: 'mother_workplace', label: 'Ona ish joyi', type: 'text' },
    { key: 'mother_phone', label: 'Ona telefoni', type: 'text' },
  ],
}

const sliceDate = (value: string | null | undefined) => (value ? String(value).slice(0, 10) : '')

export default function DekanStudentsPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const ui = dekanUI(isLight)
  // View-only in the tarbiyachi panel — edit / warning / blacklist /
  // delete controls are hidden; every read-only detail tab stays.
  const { readOnly } = useStaffPanel()

  const [dorms, setDorms] = useState<DekanDorm[]>([])
  const [dormsLoading, setDormsLoading] = useState(true)
  const [dormsError, setDormsError] = useState(false)
  const [activeDormId, setActiveDormId] = useState<string | null | undefined>(undefined)
  const activeDorm = dorms.find((dorm) => dorm.dormId === activeDormId)
  const { floorOf, loaded: floorsLoaded } = useRoomFloors(activeDormId ?? undefined)

  const [allStudents, setStudents] = useState<StudentProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [allPayments, setPayments] = useState<FacultyPaymentRecord[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const students = useMemo(
    () => studentsInDorm(allStudents, dormsLoading || dormsError ? undefined : activeDormId),
    [allStudents, activeDormId, dormsLoading, dormsError],
  )
  const payments = useMemo(() => {
    const ids = new Set(students.map((student) => student.id))
    return allPayments.filter((payment) => ids.has(payment.student_id))
  }, [allPayments, students])

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

  // The header used to lay out five actions (edit / warn / captain / expel /
  // delete) as a wrapping button row — on a real name + all the status
  // badges it never had room and fell apart. One "..." menu instead, mirroring
  // the pattern already used on /admin/foydalanuvchilar.
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false)
  const [actionsMenuPos, setActionsMenuPos] = useState<{ top: number; left: number } | null>(null)
  const actionsButtonRef = useRef<HTMLButtonElement>(null)
  const ACTIONS_MENU_WIDTH = 224

  useEffect(() => {
    if (!actionsMenuOpen) return
    const close = () => setActionsMenuOpen(false)
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [actionsMenuOpen])

  useEffect(() => { setActionsMenuOpen(false) }, [selectedStudent?.id])

  const openActionsMenu = () => {
    const rect = actionsButtonRef.current?.getBoundingClientRect()
    if (rect) {
      const left = Math.min(
        Math.max(8, rect.right - ACTIONS_MENU_WIDTH),
        window.innerWidth - ACTIONS_MENU_WIDTH - 8,
      )
      setActionsMenuPos({ top: rect.bottom + 8, left })
    }
    setActionsMenuOpen(true)
  }

  const [warningModalOpen, setWarningModalOpen] = useState(false)
  const [warningLevel, setWarningLevel] = useState<StudentWarningLevel>('info')
  const [warningText, setWarningText] = useState('')
  const [sendingWarning, setSendingWarning] = useState(false)

  const [blacklistModalOpen, setBlacklistModalOpen] = useState(false)
  const [blacklistReason, setBlacklistReason] = useState('')
  const [blacklistBusy, setBlacklistBusy] = useState(false)

  const [captainModalOpen, setCaptainModalOpen] = useState(false)
  const [captainBusy, setCaptainBusy] = useState(false)

  const [councilModalOpen, setCouncilModalOpen] = useState(false)
  const [councilBusy, setCouncilBusy] = useState(false)

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editTab, setEditTab] = useState<EditTabKey>('asosiy')
  const [editForm, setEditForm] = useState<typeof EMPTY_EDIT_FORM>(EMPTY_EDIT_FORM)
  const [savingEdit, setSavingEdit] = useState(false)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletingStudent, setDeletingStudent] = useState(false)

  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const copyToClipboard = (text: string | undefined | null, key: string, label: string) => {
    if (!text) return
    void navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success(`${label} nusxalandi`)
    setTimeout(() => setCopiedKey(null), 2000)
  }

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
      setSelectedStudent((prev) => (prev ? rows.find((row) => row.id === prev.id) ?? null : prev))
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

  const loadDorms = useCallback(async () => {
    setDormsLoading(true)
    setDormsError(false)
    try {
      const result = await fetchDekanDorm()
      const wanted = new URLSearchParams(window.location.search).get('dormId')
      setDorms(result.dorms)
      setActiveDormId((prev) => {
        if (prev === null || result.dorms.some((dorm) => dorm.dormId === prev)) return prev
        return result.dorms.find((dorm) => dorm.dormId === wanted)?.dormId
          ?? result.dorms.find((dorm) => dorm.isPrimary)?.dormId
          ?? result.dorms[0]?.dormId
          ?? null
      })
    } catch (error) {
      setDormsError(true)
      setSelectedStudent(null)
      toast.error(error instanceof Error ? error.message : "Yotoqxonalarni yuklab bo'lmadi")
    } finally {
      setDormsLoading(false)
    }
  }, [])

  const selectDorm = (dormId: string | null) => {
    setSelectedStudent(null)
    setActionsMenuOpen(false)
    setActiveDormId(dormId)
    setActiveFolder('all')
    setSearchTerm('')
    setFilterRoom('')
  }

  // A reload may move the open student to a different building.
  useEffect(() => {
    if (selectedStudent && !students.some((student) => student.id === selectedStudent.id)) {
      setSelectedStudent(null)
    }
  }, [students, selectedStudent])

  useEffect(() => {
    refreshAll()
    void loadDorms()
  }, [refreshAll, loadDorms])

  // Deep link from the room map ("Talaba kabinetini ochish"):
  // /…/talabalar?student=<id> auto-opens that student's detail once the list
  // has loaded, then strips the param so a refresh/back doesn't re-trigger.
  // Reads window.location directly (no <Suspense> boundary needed) — same
  // pattern the room map uses for ?dormId.
  const deepLinkConsumed = useRef(false)
  useEffect(() => {
    if (deepLinkConsumed.current || loading || dormsLoading || dormsError) return
    const wanted = new URLSearchParams(window.location.search).get('student')
    deepLinkConsumed.current = true
    if (!wanted) return
    const match = allStudents.find((row) => row.id === wanted)
    if (match && (match.dorm_id === null || dorms.some((dorm) => dorm.dormId === match.dorm_id))) {
      setActiveDormId(match.dorm_id)
      setSelectedStudent(match)
      setActiveFolder('all')
      setSearchTerm('')
      setFilterRoom('')
    } else {
      toast.error("Bu talaba ro'yxatda topilmadi")
    }
    window.history.replaceState(null, '', window.location.pathname)
  }, [allStudents, loading, dorms, dormsLoading, dormsError])

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
      (student) => isRoommate(student, selectedStudent)
    )
  }, [students, selectedStudent])

  const studentInfoItems = (student: StudentProfileRow) => {
    // Read the floor off the admin's qavat tarxi rather than the student's
    // stored assigned_floor, so a room moved between floors shows up here
    // immediately instead of after the next re-assignment.
    const floor = activeDorm?.layoutKind === 'blocked' || !floorsLoaded
      ? student.assigned_floor
      : floorOf(student.room_number) ?? student.assigned_floor
    return [
      { icon: Mail, label: 'Email', value: student.email },
      { icon: Phone, label: 'Telefon', value: student.phone_number },
      { icon: GraduationCap, label: 'Fakultet', value: permitFacultyLabel(student.faculty) || undefined },
      { icon: GraduationCap, label: "Yo'nalish", value: directionLabel(student.direction) || undefined },
      { icon: ShieldCheck, label: 'Kurs', value: student.course ? `${student.course}-kurs` : undefined },
      { icon: Home, label: 'Xona', value: student.room_number },
      { icon: BedDouble, label: 'Qavat', value: floor ? `${floor}-qavat` : undefined },
      { icon: ShieldCheck, label: 'Sardorlik holati', value: student.is_floor_captain ? 'Qavat sardori' : undefined },
      { icon: ShieldCheck, label: 'Kengash raisligi', value: student.is_council_chair ? 'Talaba kengashi raisi' : undefined },
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

  // Captaincy is bound to the student's own residence floor + gender — a
  // roomless student has neither, so the server rejects the promote. The
  // action button is only offered once those are set (or the student is
  // already a captain, so it can be revoked).
  const captainEligible = (student: StudentProfileRow) =>
    Boolean(student.is_floor_captain) ||
    Boolean(student.assigned_floor && normalizeGender(student.gender))

  const handleToggleFloorCaptain = async () => {
    if (!selectedStudent || captainBusy) return
    const next = !selectedStudent.is_floor_captain
    setCaptainBusy(true)
    try {
      await setStudentFloorCaptain({ studentId: selectedStudent.id, isCaptain: next })
      // The RPC also demotes the previous captain of this floor/gender, so a
      // local merge would leave that other row stale — re-fetch instead.
      await loadStudents()
      toast.success(next ? 'Talaba qavat sardori etib tayinlandi' : 'Sardorlik olib tashlandi')
      setCaptainModalOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Amalni bajarib bo'lmadi")
    } finally {
      setCaptainBusy(false)
    }
  }

  // Chairmanship is scoped to the student's own gender across the whole
  // faculty, not one floor — a roomless student can still be appointed, as
  // long as their gender is set (asked at registration, so this almost
  // never blocks anyone in practice, unlike floor captaincy).
  const councilEligible = (student: StudentProfileRow) =>
    Boolean(student.is_council_chair) || Boolean(normalizeGender(student.gender))

  const handleToggleCouncilChair = async () => {
    if (!selectedStudent || councilBusy) return
    const next = !selectedStudent.is_council_chair
    setCouncilBusy(true)
    try {
      await setStudentCouncilChair({ studentId: selectedStudent.id, isChair: next })
      // The RPC also demotes the previous chair of this gender, so a local
      // merge would leave that other row stale — re-fetch instead.
      await loadStudents()
      toast.success(next ? 'Talaba kengash raisi etib tayinlandi' : 'Kengash raisligi olib tashlandi')
      setCouncilModalOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Amalni bajarib bo'lmadi")
    } finally {
      setCouncilBusy(false)
    }
  }

  const openEditModal = () => {
    if (!selectedStudent) return
    setEditForm({
      full_name: selectedStudent.full_name ?? '',
      middle_name: selectedStudent.middle_name ?? '',
      phone: selectedStudent.phone_number ?? '',
      course: selectedStudent.course != null ? String(selectedStudent.course) : '',
      direction: normalizeDirection(selectedStudent.direction) ?? '',
      gender: selectedStudent.gender ?? '',
      birth_date: sliceDate(selectedStudent.birth_date),
      nationality: selectedStudent.nationality ?? '',
      study_type: selectedStudent.study_type ?? '',
      entry_date: sliceDate(selectedStudent.entry_date),
      passport_series: selectedStudent.passport_series ?? '',
      jshshir: selectedStudent.jshshir ?? '',
      passport_date: sliceDate(selectedStudent.passport_date),
      region: selectedStudent.region ?? '',
      district: selectedStudent.district ?? '',
      mahalla: selectedStudent.mahalla ?? '',
      father_full_name: selectedStudent.father_full_name ?? '',
      father_workplace: selectedStudent.father_workplace ?? '',
      father_phone: selectedStudent.father_phone ?? '',
      mother_full_name: selectedStudent.mother_full_name ?? '',
      mother_workplace: selectedStudent.mother_workplace ?? '',
      mother_phone: selectedStudent.mother_phone ?? '',
    })
    setEditTab('asosiy')
    setEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedStudent || savingEdit) return
    if (editForm.full_name.trim().length < 3) {
      toast.error("To'liq ismni to'g'ri kiriting")
      return
    }
    setSavingEdit(true)
    try {
      await updateFacultyStudent(selectedStudent.id, { ...editForm })
      // The endpoint returns only { ok }, and its normalisation rules
      // (empty string clears a field, blank number is ignored) don't map 1:1
      // to a local merge — re-fetch so the row and its detail panel reflect
      // exactly what the database now holds.
      await loadStudents()
      toast.success("Talaba ma'lumotlari yangilandi")
      setEditModalOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ma'lumotlarni yangilab bo'lmadi")
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteStudent = async () => {
    if (!selectedStudent || deletingStudent) return
    setDeletingStudent(true)
    try {
      await deleteFacultyStudent(selectedStudent.id)
      setStudents((prev) => prev.filter((student) => student.id !== selectedStudent.id))
      setSelectedStudent(null)
      setDeleteModalOpen(false)
      toast.success('Talaba tizimdan o‘chirildi')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Talabani o'chirib bo'lmadi")
    } finally {
      setDeletingStudent(false)
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

  const metricPills = [
    {
      title: 'Jami talabalar',
      value: students.length,
      icon: Users,
      color: 'indigo' as const,
      sub: roomlessCount > 0 ? `${placedCount} joylashgan • ${roomlessCount} xonasiz` : `${placedCount} joylashgan`,
    },
    {
      title: 'Xonada joylashgan',
      value: placedCount,
      icon: Home,
      color: 'emerald' as const,
      sub: `${Math.round((placedCount / totalCount) * 100)}% qamrov`,
    },
    {
      title: 'Xonasiz talabalar',
      value: roomlessCount,
      icon: AlertTriangle,
      color: roomlessCount > 0 ? 'amber' as const : 'slate' as const,
      sub: roomlessCount > 0 ? 'Joylashtirish zarur' : 'Barchasi joylashgan',
    },
    {
      title: "To'liq to'laganlar",
      value: paidCount ?? '—',
      icon: CheckCircle2,
      color: 'emerald' as const,
      sub: paidCount !== null ? `${Math.round((paidCount / totalCount) * 100)}% to'lagan` : 'Hisoblanmoqda...',
    },
    {
      title: 'Qarzdor talabalar',
      value: debtorCount ?? '—',
      icon: DollarSign,
      color: (debtorCount ?? 0) > 0 ? 'rose' as const : 'slate' as const,
      sub: totalDebt ? formatSum(totalDebt) : 'Qarz mavjud emas',
    },
    {
      title: 'Kutilayotgan cheklar',
      value: waitingCount,
      icon: Clock,
      color: waitingCount > 0 ? 'sky' as const : 'slate' as const,
      sub: waitingCount > 0 ? 'Admin tasdig‘ida' : 'Kutilayotgan chek yo‘q',
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
  const busy = loading || paymentsLoading || dormsLoading

  return (
    <div className="space-y-4">
      {/* ── Executive Multi-Layered Hero Banner (Compact) ─────────── */}
      <div className="no-shelf relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-800 p-4 sm:p-5 shadow-lg shadow-indigo-950/15 border border-white/20 text-white">
        {/* Decorative ambient lighting & subtle micro-dot texture */}
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-16 h-48 w-48 rounded-full bg-violet-400/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.07]" />

        {/* Top bar inside hero */}
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md text-white border border-white/25 shadow-inner shrink-0">
              <Users size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-white backdrop-blur-md border border-white/20"
                  style={{ color: '#ffffff' }}
                >
                  <Building2 size={11} className="text-white/80" />
                  {activeDorm ? `${activeDorm.number}-sonli TTJ` : "Yotoqxona biriktirilmagan"}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {students.length} nafar talaba
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white" style={{ color: '#ffffff' }}>
                Talabalar boshqaruvi
              </h1>
              <p className="mt-0.5 text-xs text-indigo-100" style={{ color: '#e0e7ff' }}>
                {dormsLoading || dormsError
                  ? 'Fakultet talabalari, to‘lov kvitansiyalari va xonalar monitoringi'
                  : activeDorm
                    ? `${activeDorm.number}-yotoqxona talabalari ro‘yxati, xonalarga joylashuv va to‘lov nazorati`
                    : 'Yotoqxona biriktirilmagan talabalar ro‘yxati'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => { refreshAll(); void loadDorms() }}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white text-xs font-bold transition-all disabled:opacity-50 no-shelf cursor-pointer active:scale-95 shadow-xs"
              title="Ma'lumotlarni yangilash"
            >
              <motion.div
                animate={busy ? { rotate: 360 } : {}}
                transition={busy ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}
              >
                <RotateCcw size={14} />
              </motion.div>
              <span style={{ color: '#ffffff' }}>{busy ? '...' : 'Yangilash'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dormitory Selector Tabs */}
      {dormsLoading ? (
        <div className="flex gap-2"><Skel className="h-9 w-32 rounded-xl" /><Skel className="h-9 w-32 rounded-xl" /></div>
      ) : dormsError ? (
        <div className={`rounded-xl border p-3 ${ui.card}`}>
          <p className={`text-xs ${ui.muted}`}>Yotoqxonalarni yuklab bo‘lmadi.</p>
          <button onClick={() => void loadDorms()} className="no-shelf mt-1 text-xs font-bold text-indigo-600">Qayta urinish</button>
        </div>
      ) : (
        <div
          role="group"
          aria-label="Yotoqxona tanlash"
          className={`no-shelf inline-flex max-w-full items-center gap-1 p-1 rounded-xl border overflow-x-auto scrollbar-none transition-colors ${
            isLight
              ? 'bg-slate-100/90 border-slate-200/80'
              : 'bg-slate-900/90 border-slate-800'
          }`}
        >
          {[...dorms.map((dorm) => ({ id: dorm.dormId as string | null, label: `${dorm.number}-yotoqxona` })),
            ...(allStudents.some((student) => student.dorm_id === null) || dorms.length === 0
              ? [{ id: null, label: 'Biriktirilmagan' }] : [])].map((tab) => {
            const isActive = activeDormId === tab.id
            const count = studentsInDorm(allStudents, tab.id).length
            return (
              <button
                key={tab.id ?? 'unassigned'}
                type="button"
                aria-pressed={isActive}
                onClick={() => selectDorm(tab.id)}
                className={`no-shelf relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 select-none ${
                  isActive
                    ? isLight
                      ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80 font-black'
                      : 'bg-indigo-600 text-white shadow-xs border border-indigo-500/30 font-black'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] border border-transparent'
                }`}
              >
                <Building2
                  size={13}
                  className={`shrink-0 ${
                    isActive
                      ? isLight ? 'text-indigo-600' : 'text-white'
                      : isLight ? 'text-slate-400' : 'text-slate-500'
                  }`}
                />
                <span>{tab.label}</span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-black ${
                    isActive
                      ? isLight
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-white/20 text-white'
                      : isLight
                        ? 'bg-slate-200 text-slate-600'
                        : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Ultra-Compact 6-Metric KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {metricPills.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.title}
              className={`rounded-xl border p-2.5 transition-all ${
                isLight
                  ? 'bg-white border-slate-200/80 shadow-xs hover:border-indigo-200'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${ui.muted} truncate`}>
                  {card.title}
                </span>
                <div className={`p-1 rounded-md shrink-0 ${
                  card.color === 'indigo' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' :
                  card.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                  card.color === 'amber' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                  card.color === 'rose' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                  card.color === 'sky' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' :
                  'bg-slate-500/10 text-slate-500'
                }`}>
                  <Icon size={12} />
                </div>
              </div>
              <p className={`text-lg font-black leading-tight tracking-tight ${ui.strong}`}>
                {busy ? '...' : card.value}
              </p>
              <p className={`text-[9px] font-semibold mt-0.5 truncate ${
                card.color === 'amber' && roomlessCount > 0 ? 'text-amber-600 dark:text-amber-400' :
                card.color === 'rose' && (debtorCount ?? 0) > 0 ? 'text-rose-600 dark:text-rose-400' :
                ui.faint
              }`}>
                {busy ? '...' : card.sub}
              </p>
            </div>
          )
        })}
      </div>

      {/* Split list / detail layout */}
      <div
        className={`grid h-[680px] lg:h-[720px] grid-cols-1 overflow-hidden rounded-2xl border md:grid-cols-12 ${
          isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
        }`}
      >
        {/* Left: students directory */}
        <div
          className={`col-span-12 h-full min-h-0 border-r md:col-span-4 lg:col-span-4 xl:col-span-3 ${
            isLight ? 'border-slate-200/80 bg-slate-50/50' : 'border-slate-800 bg-slate-900/50'
          } ${selectedStudent ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}
        >
          {/* Search inputs */}
          <div className={`p-3 space-y-2 border-b ${isLight ? 'border-slate-200/80' : 'border-slate-800'}`}>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Ism yoki email..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className={`w-full rounded-xl border py-2 pl-9 pr-8 text-xs transition-colors ${ui.input} ${ui.ring}`}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="no-shelf absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="relative">
              <Home className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Xona raqami bo'yicha..."
                value={filterRoom}
                onChange={(event) => setFilterRoom(event.target.value)}
                className={`w-full rounded-xl border py-2 pl-9 pr-8 text-xs transition-colors ${ui.input} ${ui.ring}`}
              />
              {filterRoom && (
                <button
                  type="button"
                  onClick={() => setFilterRoom('')}
                  className="no-shelf absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Folder filter pills */}
          <div className={`no-scrollbar flex gap-1 overflow-x-auto border-b p-2 ${isLight ? 'border-slate-200/80' : 'border-slate-800'}`}>
            {folders.map((folder) => {
              const isActive = activeFolder === folder.key
              const disabled = folder.count === null
              return (
                <button
                  key={folder.key}
                  type="button"
                  onClick={() => !disabled && setActiveFolder(folder.key)}
                  disabled={disabled}
                  className={`no-shelf relative shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all disabled:opacity-40 select-none ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : isLight
                        ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 bg-white/70 border border-slate-200/60'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800 bg-slate-800/40 border border-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {folder.label}
                    {folder.count !== null && (
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[9px] font-black ${
                          isActive
                            ? 'bg-white/25 text-white'
                            : isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-700 text-slate-300'
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
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto py-1">
            {loading || dormsLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                    <Skel className="h-9 w-9 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skel className="h-3.5 w-2/3" />
                      <Skel className="h-2.5 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className={`p-8 text-center text-xs ${ui.faint}`}>
                {dormsError ? 'Yotoqxonani yuklash uchun qayta urinib ko‘ring' : students.length === 0 ? 'Bu bo‘limda hozircha talaba yo‘q' : 'Talaba topilmadi'}
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
                    className={`no-shelf group relative flex w-[calc(100%-12px)] mx-1.5 my-1 items-center gap-2.5 rounded-xl p-2.5 text-left transition-all duration-150 select-none ${
                      isActive
                        ? isLight
                          ? 'bg-indigo-50/80 hover:bg-indigo-50/90 text-slate-900 border-2 border-indigo-500 shadow-xs ring-2 ring-indigo-500/10'
                          : 'bg-indigo-950/40 hover:bg-indigo-950/60 text-slate-100 border-2 border-indigo-500 shadow-xs ring-2 ring-indigo-500/20'
                        : isLight
                          ? 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/70 hover:border-indigo-200'
                          : 'bg-slate-800/40 hover:bg-slate-800/80 text-slate-100 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Left Active Indicator Notch */}
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-indigo-600 dark:bg-indigo-400" />
                    )}

                    <div className="relative shrink-0">
                      <div className={`relative h-10 w-10 overflow-hidden rounded-xl border ${
                        isActive
                          ? isLight ? 'border-indigo-300 bg-indigo-100/70' : 'border-indigo-500/50 bg-indigo-900/40'
                          : isLight ? 'border-slate-200 bg-slate-100' : 'border-slate-700 bg-slate-800'
                      }`}>
                        {student.avatar_url ? (
                          <Image
                            src={student.avatar_url}
                            alt={student.full_name}
                            fill
                            sizes="40px"
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          <div
                            className={`flex h-full w-full items-center justify-center text-[11px] font-black ${
                              isActive
                                ? isLight ? 'text-indigo-700' : 'text-indigo-200'
                                : isLight ? 'text-slate-600' : 'text-slate-300'
                            }`}
                          >
                            {getInitials(student.full_name)}
                          </div>
                        )}
                      </div>

                      {/* Gender dot */}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ${
                          isActive
                            ? isLight ? 'ring-indigo-100' : 'ring-slate-900'
                            : isLight ? 'ring-white' : 'ring-slate-900'
                        } ${accent.dot}`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`truncate text-xs font-bold leading-tight ${
                          isActive
                            ? isLight ? 'text-indigo-950 font-extrabold' : 'text-white font-extrabold'
                            : isLight ? 'text-slate-900' : 'text-slate-100'
                        }`}>
                          {student.full_name}
                        </p>
                        <span className="flex shrink-0 items-center gap-1">
                          {student.blacklisted && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                                statusChip('danger', isLight).chip
                              }`}
                            >
                              Chetlatilgan
                            </span>
                          )}
                          {student.is_floor_captain && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                                isLight ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-indigo-900/40 text-indigo-300 border border-indigo-800'
                              }`}
                            >
                              Sardor
                            </span>
                          )}
                          {warnings > 0 && (
                            <span
                              className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-black ${WARNING_BADGE_CLASSES[tone]}`}
                            >
                              <span
                                className={`h-1 w-1 rounded-full ${WARNING_DOT_CLASSES[tone]}`}
                              />
                              {warnings}
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          {student.room_number ? (
                            <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              isActive
                                ? isLight ? 'bg-white text-indigo-700 border border-indigo-200 shadow-2xs' : 'bg-slate-800 text-indigo-300 border border-indigo-800/60'
                                : isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300'
                            }`}>
                              <Home size={10} className="shrink-0" />
                              {student.room_number}-xona
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              Xonasiz
                            </span>
                          )}
                          {student.course && (
                            <span className={`text-[10px] font-medium ${
                              isActive
                                ? isLight ? 'text-indigo-600 font-semibold' : 'text-indigo-300 font-semibold'
                                : 'text-slate-400'
                            }`}>
                              {student.course}-kurs
                            </span>
                          )}
                        </div>

                        {summary && (
                          <span
                            className={`shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9px] font-black ${PAY_STATE_BADGE_CLASSES[summary.state]}`}
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

        {/* Right: student profile & cabinet */}
        <div
          className={`col-span-12 h-full min-h-0 overflow-hidden md:col-span-8 lg:col-span-8 xl:col-span-9 ${
            isLight ? 'bg-slate-50/70' : 'bg-slate-950/70'
          } ${!selectedStudent ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}
        >
          {!selectedStudent ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className={`mb-4 rounded-3xl p-6 border ${
                isLight ? 'bg-white border-slate-200/80 text-slate-400 shadow-xs' : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}>
                <UsersRound size={44} strokeWidth={1.75} className="text-indigo-500" />
              </div>
              <h3 className={`text-base font-black tracking-tight ${ui.strong}`}>
                Talaba tanlanmagan
              </h3>
              <p className={`mt-1 max-w-xs text-xs ${ui.muted}`}>
                Talabaning to&apos;liq shaxsiy profili, hujjati, oila ma&apos;lumotlari va to&apos;lov holatini ko&apos;rish uchun chap ro&apos;yxatdan tanlang
              </p>
            </div>
          ) : (
            <>
              {/* Selected student header */}
              <div className={`flex shrink-0 flex-col justify-between gap-3 border-b p-4 sm:flex-row sm:items-center ${
                isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
              }`}>
                <div className="flex w-full min-w-0 items-center gap-3.5 sm:w-auto">
                  <button
                    onClick={() => setSelectedStudent(null)}
                    className={`no-shelf -ml-1 rounded-xl p-2 md:hidden transition-colors ${
                      isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                    aria-label="Ro'yxatga qaytish"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <div
                    className={`group relative h-13 w-13 shrink-0 cursor-pointer overflow-hidden rounded-2xl border-2 transition-transform hover:scale-105 ${
                      isLight ? 'border-slate-200 bg-slate-100' : 'border-slate-700 bg-slate-800'
                    }`}
                    onClick={() => selectedStudent.avatar_url && setFullScreenImage(selectedStudent.avatar_url)}
                    title="Rasmni kattalashtirish"
                  >
                    {selectedStudent.avatar_url ? (
                      <Image
                        src={selectedStudent.avatar_url}
                        alt={selectedStudent.full_name}
                        fill
                        sizes="52px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center text-sm font-black ${
                        isLight ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-950/60 text-indigo-300'
                      }`}>
                        {getInitials(selectedStudent.full_name)}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className={`truncate text-base sm:text-lg font-black tracking-tight ${ui.strong}`}>
                        {selectedStudent.full_name}
                      </h2>
                      {selectedStudent.gender && (
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${genderAccent(selectedStudent.gender).dot}`}
                          title={genderLabel(selectedStudent.gender)}
                        />
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {selectedStudent.room_number ? (
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${statusChip('success', isLight).chip}`}>
                          <Home size={11} />
                          {selectedStudent.room_number}-xona
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${statusChip('warning', isLight).chip}`}>
                          <AlertTriangle size={11} />
                          Xonasiz
                        </span>
                      )}

                      {selectedSummary && (
                        <span
                          className={`shrink-0 whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-black ${
                            PAY_STATE_BADGE_CLASSES[selectedSummary.state]
                          }`}
                        >
                          {PAY_STATE_LABELS[selectedSummary.state]}
                          {selectedSummary.state !== 'paid' && ` — ${formatSum(selectedSummary.remaining)}`}
                        </span>
                      )}

                      <span
                        className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-black ${
                          WARNING_BADGE_CLASSES[getWarningTone(selectedStudent.warning_count ?? 0, warningThreshold)]
                        }`}
                      >
                        {(selectedStudent.warning_count ?? 0) === 0 ? (
                          <>
                            <CheckCircle2 size={11} className="text-emerald-500" />
                            Intizom: A&apos;lo
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={11} />
                            {selectedStudent.warning_count} ta ogohlantirish
                          </>
                        )}
                      </span>

                      {selectedStudent.is_floor_captain && (
                        <span className="shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-black bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                          Qavat sardori
                        </span>
                      )}
                      {selectedStudent.is_council_chair && (
                        <span className="shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-black bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
                          Kengash raisi
                        </span>
                      )}
                      {selectedStudent.blacklisted && (
                        <span className={`shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-black ${statusChip('danger', isLight).chip}`}>
                          Chetlatilgan
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {selectedStudent.phone_number && (
                    <a
                      href={`tel:${selectedStudent.phone_number}`}
                      className={`no-shelf inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                        isLight
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                          : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/60'
                      }`}
                      title="Qo'ng'iroq qilish"
                    >
                      <Phone size={13} />
                      <span className="hidden sm:inline">Qo&apos;ng&apos;iroq</span>
                    </a>
                  )}

                  {!readOnly && (
                    <div className="relative">
                      <button
                        ref={actionsButtonRef}
                        onClick={() => (actionsMenuOpen ? setActionsMenuOpen(false) : openActionsMenu())}
                        aria-label="Amallar"
                        title="Boshqarish amallari"
                        className={`no-shelf inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                          actionsMenuOpen
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : isLight
                              ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                      >
                        <MoreVertical size={14} />
                        <span>Amallar</span>
                      </button>
                      {typeof document !== 'undefined' && createPortal(
                        <AnimatePresence>
                          {actionsMenuOpen && actionsMenuPos && (
                            <>
                              <button
                                type="button"
                                aria-label="Menyuni yopish"
                                onClick={() => setActionsMenuOpen(false)}
                                className="fixed inset-0 z-40 cursor-default"
                              />
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -6 }}
                                transition={{ duration: 0.15 }}
                                style={{ top: actionsMenuPos.top, left: actionsMenuPos.left, width: ACTIONS_MENU_WIDTH }}
                                className={`fixed z-50 space-y-0.5 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-xl ${ui.card}`}
                              >
                                <button
                                  onClick={() => { setActionsMenuOpen(false); openEditModal() }}
                                  className={`no-shelf flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${ui.body} ${isLight ? 'hover:bg-slate-100 hover:text-slate-900' : 'hover:bg-slate-800 hover:text-white'}`}
                                >
                                  <Edit2 size={14} />
                                  Tahrirlash
                                </button>
                                <button
                                  onClick={() => { setActionsMenuOpen(false); openWarningModal() }}
                                  className={`no-shelf flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${isLight ? 'text-amber-700 hover:bg-amber-50' : 'text-amber-400 hover:bg-amber-500/10'}`}
                                >
                                  <AlertTriangle size={14} />
                                  Ogohlantirish
                                </button>
                                {captainEligible(selectedStudent) && (
                                  <button
                                    onClick={() => { setActionsMenuOpen(false); setCaptainModalOpen(true) }}
                                    className={`no-shelf flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${isLight ? 'text-indigo-700 hover:bg-indigo-50' : 'text-indigo-300 hover:bg-indigo-500/10'}`}
                                  >
                                    <ShieldCheck size={14} />
                                    {selectedStudent.is_floor_captain ? 'Sardorlikdan olish' : 'Sardor tayinlash'}
                                  </button>
                                )}
                                {councilEligible(selectedStudent) && (
                                  <button
                                    onClick={() => { setActionsMenuOpen(false); setCouncilModalOpen(true) }}
                                    className={`no-shelf flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${isLight ? 'text-indigo-700 hover:bg-indigo-50' : 'text-indigo-300 hover:bg-indigo-500/10'}`}
                                  >
                                    <Award size={14} />
                                    {selectedStudent.is_council_chair ? 'Kengash raisligidan olish' : 'Kengash raisi tayinlash'}
                                  </button>
                                )}
                                <button
                                  onClick={() => { setActionsMenuOpen(false); setBlacklistReason(''); setBlacklistModalOpen(true) }}
                                  className={`no-shelf flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${isLight ? 'text-rose-600 hover:bg-rose-50' : 'text-rose-400 hover:bg-rose-500/10'}`}
                                >
                                  <UserX size={14} />
                                  {selectedStudent.blacklisted ? 'Chetlatishni bekor qilish' : 'Chetlatish'}
                                </button>
                                <div className={`mx-1.5 my-1 border-t ${ui.border}`} />
                                <button
                                  onClick={() => { setActionsMenuOpen(false); setDeleteModalOpen(true) }}
                                  className={`no-shelf flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${isLight ? 'text-rose-600 hover:bg-rose-50' : 'text-rose-400 hover:bg-rose-500/10'}`}
                                >
                                  <Trash2 size={14} />
                                  Talabani o&apos;chirish
                                </button>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>,
                        document.body,
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Details body */}
              <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {/* Segmented Tab Bar */}
                <div className={`no-scrollbar flex flex-nowrap gap-1 overflow-x-auto rounded-xl border p-1 ${
                  isLight ? 'bg-slate-100/90 border-slate-200/80' : 'bg-slate-900 border-slate-800'
                }`}>
                  {[
                    { key: 'profil' as const, label: 'Profil', icon: User },
                    { key: 'hujjatlar' as const, label: 'Hujjat & Manzil', icon: FileText },
                    { key: 'oila' as const, label: 'Oila', icon: Users },
                    { key: 'tolovlar' as const, label: "To'lovlar", icon: CreditCard },
                  ].map((tab) => {
                    const Icon = tab.icon
                    const isActive = detailTab === tab.key
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setDetailTab(tab.key)}
                        className={`no-shelf flex-1 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5 select-none ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-xs font-black'
                            : isLight
                              ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        <Icon size={14} className={isActive ? 'text-white' : 'opacity-70'} />
                        <span>{tab.label}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Tab: Profil */}
                {detailTab === 'profil' && (
                  <div className="space-y-3.5">
                    {/* Academic & Dorm Info Card */}
                    <div className={`rounded-2xl border p-4.5 ${
                      isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
                    }`}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                          <GraduationCap size={16} />
                        </div>
                        <div>
                          <h3 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
                            Ta&apos;lim va Yotoqxona joylashuvi
                          </h3>
                          <p className={`text-[10px] ${ui.muted}`}>Fakultet, yo&apos;nalish va biriktirilgan xona ma&apos;lumotlari</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {studentInfoItems(selectedStudent)
                          .filter((item) => ['Fakultet', "Yo'nalish", 'Kurs', 'Xona', 'Qavat', "Ta'lim turi", 'Yotoqxonaga kirgan sana'].includes(item.label))
                          .map((item) => {
                            const Icon = item.icon
                            return (
                              <div
                                key={item.label}
                                className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                                  isLight ? 'bg-slate-50/70 border-slate-100' : 'bg-slate-800/40 border-slate-800'
                                }`}
                              >
                                <div className={`shrink-0 rounded-lg p-2 ${infoTileSurface}`}>
                                  <Icon size={16} className="text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                    {item.label}
                                  </p>
                                  <p className={`truncate text-xs font-bold ${infoValueText} mt-0.5`}>
                                    {item.value}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>

                    {/* Personal & Contact Info Card */}
                    <div className={`rounded-2xl border p-4.5 ${
                      isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
                    }`}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <User size={16} />
                        </div>
                        <div>
                          <h3 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
                            Shaxsiy va Bog&apos;lanish ma&apos;lumotlari
                          </h3>
                          <p className={`text-[10px] ${ui.muted}`}>Talaba bilan bevosita aloqa vositalari</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {studentInfoItems(selectedStudent)
                          .filter((item) => !HUJJAT_LABELS.includes(item.label) && !['Fakultet', "Yo'nalish", 'Kurs', 'Xona', 'Qavat', "Ta'lim turi", 'Yotoqxonaga kirgan sana'].includes(item.label))
                          .map((item) => {
                            const Icon = item.icon
                            const isPhone = item.label === 'Telefon'
                            const isEmail = item.label === 'Email'
                            return (
                              <div
                                key={item.label}
                                className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                                  isLight ? 'bg-slate-50/70 border-slate-100' : 'bg-slate-800/40 border-slate-800'
                                }`}
                              >
                                <div className={`shrink-0 rounded-lg p-2 ${infoTileSurface}`}>
                                  <Icon size={16} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                    {item.label}
                                  </p>
                                  {isPhone ? (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <a
                                        href={`tel:${item.value}`}
                                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline truncate"
                                      >
                                        {item.value}
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(item.value, 'phone', 'Telefon')}
                                        className="no-shelf text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                        title="Nusxalash"
                                      >
                                        {copiedKey === 'phone' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                      </button>
                                    </div>
                                  ) : isEmail ? (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <a
                                        href={`mailto:${item.value}`}
                                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline truncate"
                                      >
                                        {item.value}
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(item.value, 'email', 'Email')}
                                        className="no-shelf text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                        title="Nusxalash"
                                      >
                                        {copiedKey === 'email' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                      </button>
                                    </div>
                                  ) : (
                                    <p className={`truncate text-xs font-bold ${infoValueText} mt-0.5`}>
                                      {item.value}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Hujjatlar */}
                {detailTab === 'hujjatlar' && (
                  <div className="space-y-3.5">
                    {/* ID & Passport Card */}
                    <div className={`rounded-2xl border p-4.5 ${
                      isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
                    }`}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                          <FileText size={16} />
                        </div>
                        <div>
                          <h3 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
                            Pasport va Shaxsiy Identifikatsiya
                          </h3>
                          <p className={`text-[10px] ${ui.muted}`}>Pasport seriya, raqam va JSHSHIR rekvizitlari</p>
                        </div>
                      </div>

                      {studentInfoItems(selectedStudent)
                        .filter((item) => ['Passport seriya', 'JSHSHIR', 'Passport sanasi', 'Millati', 'Jinsi'].includes(item.label)).length === 0 ? (
                        <div className={`rounded-2xl border p-6 text-center ${
                          isLight ? 'bg-white border-slate-200/80' : 'bg-slate-900 border-slate-800'
                        }`}>
                          <div className="inline-flex p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-2">
                            <FileText size={24} />
                          </div>
                          <h4 className={`text-xs font-bold ${ui.strong}`}>Pasport ma&apos;lumotlari kiritilmagan</h4>
                          <p className={`text-[10px] ${ui.faint} mt-0.5`}>
                            Ushbu talabaning pasport yoki shaxsiy identifikatsiya rekvizitlari bazada mavjud emas.
                          </p>
                        </div>
                      ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {studentInfoItems(selectedStudent)
                          .filter((item) => ['Passport seriya', 'JSHSHIR', 'Passport sanasi', 'Millati', 'Jinsi'].includes(item.label))
                          .map((item) => {
                            const Icon = item.icon
                            const isCopyable = item.label === 'Passport seriya' || item.label === 'JSHSHIR'
                            return (
                              <div
                                key={item.label}
                                className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                                  isLight ? 'bg-slate-50/70 border-slate-100' : 'bg-slate-800/40 border-slate-800'
                                }`}
                              >
                                <div className={`shrink-0 rounded-lg p-2 ${infoTileSurface}`}>
                                  <Icon size={16} className="text-sky-600 dark:text-sky-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                    {item.label}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <p className={`truncate text-xs font-bold ${infoValueText}`}>
                                      {item.value}
                                    </p>
                                    {isCopyable && (
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(item.value, item.label, item.label)}
                                        className="no-shelf text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                        title="Nusxalash"
                                      >
                                        {copiedKey === item.label ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                      )}
                    </div>

                    {/* Address Card */}
                    <div className={`rounded-2xl border p-4.5 ${
                      isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
                    }`}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                          <MapPin size={16} />
                        </div>
                        <div>
                          <h3 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
                            Doimiy Yashash Manzili
                          </h3>
                          <p className={`text-[10px] ${ui.muted}`}>Talabaning pasport bo‘yicha ro‘yxatdan o‘tgan hududi</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50/70 border-slate-100' : 'bg-slate-800/40 border-slate-800'}`}>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Viloyat / Shahar</p>
                          <p className={`text-xs font-bold ${infoValueText} mt-1`}>{selectedStudent.region || '—'}</p>
                        </div>
                        <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50/70 border-slate-100' : 'bg-slate-800/40 border-slate-800'}`}>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Tuman / Hudud</p>
                          <p className={`text-xs font-bold ${infoValueText} mt-1`}>{selectedStudent.district || '—'}</p>
                        </div>
                        <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50/70 border-slate-100' : 'bg-slate-800/40 border-slate-800'}`}>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Mahalla / Ko‘cha</p>
                          <p className={`text-xs font-bold ${infoValueText} mt-1`}>{selectedStudent.mahalla || '—'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Oila */}
                {detailTab === 'oila' && (
                  <div className="space-y-3.5">
                    {familyInfoItems(selectedStudent).length === 0 ? (
                      <div className={`rounded-2xl border p-8 text-center ${
                        isLight ? 'bg-white border-slate-200/80' : 'bg-slate-900 border-slate-800'
                      }`}>
                        <div className="inline-flex p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-2">
                          <Users size={24} />
                        </div>
                        <h4 className={`text-xs font-bold ${ui.strong}`}>Oila ma&apos;lumotlari kiritilmagan</h4>
                        <p className={`text-[10px] ${ui.faint} mt-0.5`}>
                          Ushbu talabaning ota-onasi yoki vasiylari haqidagi ma&apos;lumotlar bazada mavjud emas.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {/* Father card */}
                        <div className={`rounded-2xl border p-4.5 ${
                          isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
                        }`}>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                              <User size={16} />
                            </div>
                            <div>
                              <h3 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
                                Otasi haqida ma&apos;lumot
                              </h3>
                              <p className={`text-[10px] ${ui.muted}`}>F.I.Sh., ish joyi va telefon raqami</p>
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-slate-50/70 border-slate-100' : 'bg-slate-800/40 border-slate-800'}`}>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">To‘liq F.I.Sh.</p>
                              <p className={`text-xs font-bold ${infoValueText} mt-0.5`}>{selectedStudent.father_full_name || 'Kiritilmagan'}</p>
                            </div>
                            <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-slate-50/70 border-slate-100' : 'bg-slate-800/40 border-slate-800'}`}>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Ish joyi va lavozimi</p>
                              <p className={`text-xs font-bold ${infoValueText} mt-0.5`}>{selectedStudent.father_workplace || 'Kiritilmagan'}</p>
                            </div>
                            <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${isLight ? 'bg-slate-50/70 border-slate-100' : 'bg-slate-800/40 border-slate-800'}`}>
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Telefon raqami</p>
                                <p className={`text-xs font-bold ${infoValueText} mt-0.5`}>{selectedStudent.father_phone || 'Kiritilmagan'}</p>
                              </div>
                              {selectedStudent.father_phone && (
                                <a
                                  href={`tel:${selectedStudent.father_phone}`}
                                  className="no-shelf inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-bold transition-colors"
                                >
                                  <Phone size={11} />
                                  Qo&apos;ng&apos;iroq
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Mother card */}
                        <div className={`rounded-2xl border p-4.5 ${
                          isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
                        }`}>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400">
                              <User size={16} />
                            </div>
                            <div>
                              <h3 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
                                Onasi haqida ma&apos;lumot
                              </h3>
                              <p className={`text-[10px] ${ui.muted}`}>F.I.Sh., ish joyi va telefon raqami</p>
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-slate-50/70 border-slate-100' : 'bg-slate-800/40 border-slate-800'}`}>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">To‘liq F.I.Sh.</p>
                              <p className={`text-xs font-bold ${infoValueText} mt-0.5`}>{selectedStudent.mother_full_name || 'Kiritilmagan'}</p>
                            </div>
                            <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-slate-50/70 border-slate-100' : 'bg-slate-800/40 border-slate-800'}`}>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Ish joyi va lavozimi</p>
                              <p className={`text-xs font-bold ${infoValueText} mt-0.5`}>{selectedStudent.mother_workplace || 'Kiritilmagan'}</p>
                            </div>
                            <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${isLight ? 'bg-slate-50/70 border-slate-100' : 'bg-slate-800/40 border-slate-800'}`}>
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Telefon raqami</p>
                                <p className={`text-xs font-bold ${infoValueText} mt-0.5`}>{selectedStudent.mother_phone || 'Kiritilmagan'}</p>
                              </div>
                              {selectedStudent.mother_phone && (
                                <a
                                  href={`tel:${selectedStudent.mother_phone}`}
                                  className="no-shelf inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-bold transition-colors"
                                >
                                  <Phone size={11} />
                                  Qo&apos;ng&apos;iroq
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: To'lovlar */}
                {detailTab === 'tolovlar' && (
                  <div className="space-y-4">
                    {settingsStatus === 'loading' ? (
                      <div className={`rounded-2xl border p-6 text-center text-xs ${cardSurface} ${ui.muted}`}>
                        Shartnoma summasi sozlamasi yuklanmoqda...
                      </div>
                    ) : settingsStatus === 'error' ? (
                      <div className={`rounded-2xl border p-6 text-center text-xs ${
                        isLight ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-rose-500/25 bg-rose-500/10 text-rose-300'
                      }`}>
                        <p>Shartnoma summasi sozlamasini yuklab bo&apos;lmadi.</p>
                        <button
                          type="button"
                          onClick={() => void loadSettings()}
                          className={`no-shelf mt-3 rounded-xl px-3 py-2 font-bold uppercase tracking-wider transition-colors ${ui.dangerSoft}`}
                        >
                          Qayta urinish
                        </button>
                      </div>
                    ) : selectedSummary ? (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {[
                            { label: "To'langan summa", value: selectedSummary.paid, icon: CheckCircle2, color: 'emerald' },
                            { label: 'Qolgan qarz', value: selectedSummary.remaining, icon: DollarSign, color: 'rose' },
                            { label: 'Shartnoma miqdori', value: selectedSummary.contractFee, icon: FileText, color: 'indigo' },
                            { label: "Kutilayotgan to'lovlar", value: selectedSummary.waiting, icon: Clock, color: 'sky' },
                          ].map((card) => {
                            const Icon = card.icon
                            return (
                              <div
                                key={card.label}
                                className={`rounded-2xl border p-3 ${
                                  isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <p className={`text-[9px] font-bold uppercase tracking-wider ${ui.faint} truncate`}>
                                    {card.label}
                                  </p>
                                  <div className={`p-1 rounded-md shrink-0 ${
                                    card.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                                    card.color === 'rose' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                                    card.color === 'indigo' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' :
                                    'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                                  }`}>
                                    <Icon size={12} />
                                  </div>
                                </div>
                                <p className={`text-sm sm:text-base font-black leading-tight tracking-tight ${
                                  card.color === 'rose' && card.value > 0 ? 'text-rose-600 dark:text-rose-400' :
                                  card.color === 'emerald' && card.value > 0 ? 'text-emerald-600 dark:text-emerald-400' :
                                  infoValueText
                                }`}>
                                  {card.value.toLocaleString('uz-UZ')} UZS
                                </p>
                              </div>
                            )
                          })}
                        </div>

                        <div className={`rounded-2xl border p-4 ${
                          isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
                        }`}>
                          <div className="mb-2 flex items-center justify-between">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>
                              Yillik Shartnoma to&apos;lov progressi
                            </span>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                              {selectedSummary.progressPercent}%
                            </span>
                          </div>
                          <div className={`h-2.5 w-full overflow-hidden rounded-full ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>
                            <div
                              className="h-2.5 rounded-full bg-linear-to-r from-indigo-600 to-emerald-500 transition-all duration-500"
                              style={{ width: `${selectedSummary.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </>
                    ) : null}

                    {/* Receipts History */}
                    <div className={`rounded-2xl border p-4 ${
                      isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
                    }`}>
                      <h3 className={`mb-3 text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>
                        To&apos;lov kvitansiyalari tarixi
                      </h3>

                      {paymentsLoading ? (
                        <p className={`py-4 text-center text-xs ${ui.faint}`}>Yuklanmoqda...</p>
                      ) : selectedPayments.length === 0 ? (
                        <p className={`py-4 text-center text-xs ${ui.faint}`}>
                          To&apos;lov kvitansiyalari mavjud emas
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {selectedPayments.map((record) => {
                            const isApproved = APPROVED_PAYMENT_STATUSES.has(record.status)
                            const isWaiting = WAITING_PAYMENT_STATUSES.has(record.status)

                            return (
                              <div
                                key={record.id}
                                className={`rounded-xl border p-3 text-xs ${
                                  isLight ? 'bg-slate-50/80 border-slate-200/60' : 'bg-slate-800/40 border-slate-800'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className={`font-bold ${infoValueText}`}>
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
                                        title="Chek yuklangan"
                                      >
                                        <Receipt size={12} />
                                        Chek
                                      </span>
                                    )}
                                    <span
                                      className={`rounded-md px-2 py-0.5 text-[9px] font-bold ${
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

                {/* Roommates Card */}
                {roommates.length > 0 && (
                  <div className={`rounded-2xl border p-4.5 transition-all ${
                    isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900 border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between mb-3.5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                          <Users size={16} />
                        </div>
                        <div>
                          <h3 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
                            Xonadoshlar ({roommates.length} kishi)
                          </h3>
                          <p className={`text-[10px] ${ui.muted}`}>
                            {selectedStudent.room_number}-xonada birga istiqomat qiluvchi talabalar
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {roommates.map((roommate) => {
                        const rSummary = paySummaries?.get(roommate.id)
                        return (
                          <button
                            key={roommate.id}
                            type="button"
                            className={`no-shelf group flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                              isLight
                                ? 'bg-slate-50 hover:bg-indigo-50/60 hover:border-indigo-200 border-slate-200/70'
                                : 'bg-slate-800/40 hover:bg-slate-800 hover:border-indigo-500/40 border-slate-800'
                            }`}
                            title={`${roommate.full_name} profilini ochish`}
                            onClick={() => setSelectedStudent(roommate)}
                          >
                            <div className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border transition-colors ${
                              isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800'
                            }`}>
                              {roommate.avatar_url ? (
                                <Image
                                  src={roommate.avatar_url}
                                  alt={roommate.full_name}
                                  fill
                                  sizes="40px"
                                  unoptimized
                                  className="object-cover"
                                />
                              ) : (
                                <div className={`flex h-full w-full items-center justify-center text-[10px] font-black ${
                                  isLight ? 'text-indigo-600' : 'text-indigo-300'
                                }`}>
                                  {getInitials(roommate.full_name)}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className={`truncate text-xs font-bold ${
                                isLight ? 'text-slate-900 group-hover:text-indigo-600' : 'text-slate-100 group-hover:text-indigo-400'
                              }`}>
                                {roommate.full_name}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                {roommate.course && (
                                  <span className={`text-[10px] ${ui.muted}`}>{roommate.course}-kurs</span>
                                )}
                                {rSummary && (
                                  <span className={`text-[9px] font-bold ${
                                    rSummary.state === 'paid' ? 'text-emerald-500' : 'text-amber-500'
                                  }`}>
                                    • {rSummary.state === 'paid' ? "To'lagan" : "Qarzdor"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Footer register date */}
                <div className={`rounded-xl border p-3 text-center ${
                  isLight ? 'bg-slate-50/50 border-slate-200/60' : 'bg-slate-900/50 border-slate-800/80'
                }`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>
                    Tizimda ro&apos;yxatdan o&apos;tgan sana: {formatDate(selectedStudent.created_at)}
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
                  className={`no-shelf rounded-xl px-3 py-2.5 text-center transition-colors ${
                    warningLevel === option.key
                      ? option.key === 'warning'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-indigo-600 text-white shadow-xs'
                      : `${ui.muted} ${isLight ? 'hover:text-slate-800 hover:bg-slate-100' : 'hover:text-slate-200 hover:bg-slate-800'}`
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

      {/* Floor captain (sardor) appoint / revoke modal */}
      <ConfirmModal
        isOpen={captainModalOpen}
        title={selectedStudent?.is_floor_captain ? 'Sardorlikdan olish' : 'Qavat sardori etib tayinlash'}
        description={selectedStudent ? selectedStudent.full_name : undefined}
        onClose={() => setCaptainModalOpen(false)}
        onConfirm={handleToggleFloorCaptain}
        confirmText={selectedStudent?.is_floor_captain ? 'Olib tashlash' : 'Tayinlash'}
        confirmVariant={selectedStudent?.is_floor_captain ? 'danger' : 'primary'}
        isLoading={captainBusy}
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          {selectedStudent?.is_floor_captain ? (
            <div className={`rounded-lg border p-3 text-[11px] leading-relaxed ${isLight ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-indigo-500/25 bg-indigo-500/10 text-indigo-200'}`}>
              Talaba <span className="font-black">{selectedStudent.assigned_floor}-qavat</span> sardorligidan olib
              tashlanadi va sardor paneliga (yo&apos;qlama, qavat e&apos;lonlari) kirish huquqini yo&apos;qotadi.
              Qavat <span className="font-black">sardorsiz qoladi</span> — kerak bo&apos;lsa boshqa talabani
              tayinlang. Talabaning xonasi va boshqa ma&apos;lumotlari o&apos;zgarmaydi.
            </div>
          ) : (
            <div className={`rounded-lg border p-3 text-[11px] leading-relaxed ${isLight ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-indigo-500/25 bg-indigo-500/10 text-indigo-200'}`}>
              <span className="font-black">{selectedStudent?.full_name}</span> o&apos;zi yashaydigan{' '}
              <span className="font-black">
                {selectedStudent?.assigned_floor}-qavat
                {selectedStudent?.gender ? ` (${genderLabel(selectedStudent.gender)})` : ''}
              </span>{' '}
              sardori etib tayinlanadi va sardor paneliga (yo&apos;qlama, qavat e&apos;lonlari) kirish huquqini
              oladi. Shu qavat va jins bo&apos;yicha <span className="font-black">hozirgi sardor avtomatik
              almashtiriladi</span> — bir qavatda bitta sardor bo&apos;ladi.
            </div>
          )}
        </div>
      </ConfirmModal>

      {/* Council chair (talaba kengashi raisi) appoint / revoke modal */}
      <ConfirmModal
        isOpen={councilModalOpen}
        title={selectedStudent?.is_council_chair ? 'Kengash raisligidan olish' : 'Kengash raisi etib tayinlash'}
        description={selectedStudent ? selectedStudent.full_name : undefined}
        onClose={() => setCouncilModalOpen(false)}
        onConfirm={handleToggleCouncilChair}
        confirmText={selectedStudent?.is_council_chair ? 'Olib tashlash' : 'Tayinlash'}
        confirmVariant={selectedStudent?.is_council_chair ? 'danger' : 'primary'}
        isLoading={councilBusy}
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          {selectedStudent?.is_council_chair ? (
            <div className={`rounded-lg border p-3 text-[11px] leading-relaxed ${isLight ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-indigo-500/25 bg-indigo-500/10 text-indigo-200'}`}>
              Talaba <span className="font-black">kengash raisligidan</span> olib tashlanadi va o&apos;z paneliga
              (talabalar ro&apos;yxati, e&apos;lonlar) kirish huquqini yo&apos;qotadi. Fakultet{' '}
              <span className="font-black">raisisiz qoladi</span> — kerak bo&apos;lsa boshqa talabani tayinlang.
              Talabaning xonasi va boshqa ma&apos;lumotlari o&apos;zgarmaydi.
            </div>
          ) : (
            <div className={`rounded-lg border p-3 text-[11px] leading-relaxed ${isLight ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-indigo-500/25 bg-indigo-500/10 text-indigo-200'}`}>
              <span className="font-black">{selectedStudent?.full_name}</span> butun fakultet{' '}
              <span className="font-black">
                {selectedStudent?.gender ? genderLabel(selectedStudent.gender).toLowerCase() : ''} talabalari
              </span>{' '}
              uchun kengash raisi etib tayinlanadi va talabalar ro&apos;yxati + e&apos;lon yozish huquqini oladi
              (butun fakultet bo&apos;yicha, bitta qavat emas). Shu jins bo&apos;yicha{' '}
              <span className="font-black">hozirgi raisi avtomatik almashtiriladi</span> — bir fakultetda har
              jinsdan bitta raisi bo&apos;ladi.
            </div>
          )}
        </div>
      </ConfirmModal>

      {/* Edit student record modal */}
      <ConfirmModal
        isOpen={editModalOpen}
        title="Talaba ma'lumotlarini tahrirlash"
        description={selectedStudent ? selectedStudent.full_name : undefined}
        onClose={() => setEditModalOpen(false)}
        onConfirm={handleSaveEdit}
        confirmText="Saqlash"
        isLoading={savingEdit}
        maxWidthClass="max-w-3xl"
      >
        <div className="space-y-4">
          <div className={`rounded-lg border p-3 text-[11px] leading-relaxed ${isLight ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-indigo-500/25 bg-indigo-500/10 text-indigo-200'}`}>
            Xona, qavat, ogohlantirishlar soni va akkaunt holati bu yerdan o&apos;zgartirilmaydi —
            ular «Xonalar», ogohlantirish oqimi va email tasdig&apos;i orqali boshqariladi. Sardorlik
            yuqoridagi «Sardor tayinlash» tugmasi orqali beriladi. Fakultetni ham o&apos;zgartirib bo&apos;lmaydi.
          </div>

          <div className={`no-scrollbar flex flex-nowrap gap-1 overflow-x-auto rounded-lg border p-1 ${ui.inset}`}>
            {EDIT_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setEditTab(tab.key)}
                className={`no-shelf flex-1 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all sm:px-4 ${
                  editTab === tab.key
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : `${ui.muted} ${isLight ? 'hover:text-slate-800 hover:bg-slate-100' : 'hover:text-slate-200 hover:bg-slate-800'}`
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {EDIT_FIELDS[editTab].map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label className={`block text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>
                  {field.label}
                </label>
                {field.key === 'gender' ? (
                  <CustomSelect
                    value={editForm.gender}
                    onChange={(value) => setEditForm((current) => ({ ...current, gender: value }))}
                    placeholder="Tanlanmagan"
                    options={GENDER_OPTIONS}
                    className={`rounded-lg border px-4 py-2.5 text-sm ${ui.input}`}
                  />
                ) : field.key === 'direction' ? (
                  <CustomSelect
                    value={editForm.direction}
                    onChange={(value) => setEditForm((current) => ({ ...current, direction: value }))}
                    placeholder="Yo'nalishni tanlang"
                    options={directionsForFaculty(selectedStudent?.faculty).map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                    className={`rounded-lg border px-4 py-2.5 text-sm ${ui.input}`}
                  />
                ) : (
                  <input
                    type={field.type}
                    value={editForm[field.key]}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm transition-colors ${ui.input} ${ui.ring}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </ConfirmModal>

      {/* Delete student modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Talabani o‘chirish"
        description={selectedStudent ? selectedStudent.full_name : undefined}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteStudent}
        confirmText="O‘chirish"
        confirmVariant="danger"
        isLoading={deletingStudent}
        maxWidthClass="max-w-lg"
      >
        <div className={`rounded-lg border p-3 text-[11px] leading-relaxed ${isLight ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-rose-500/25 bg-rose-500/10 text-rose-200'}`}>
          Talabaning hisobi va profili <span className="font-black">butunlay o&apos;chiriladi</span> — bu amalni
          orqaga qaytarib bo&apos;lmaydi. Biriktirilgan xona bo&apos;shaydi. Talaba faqat yotoqxonani tark
          etgan bo&apos;lsa yoki xato ro&apos;yxatdan o&apos;tgan bo&apos;lsa o&apos;chiring; qoida buzgan talaba
          uchun «Chetlatish»dan foydalaning.
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
