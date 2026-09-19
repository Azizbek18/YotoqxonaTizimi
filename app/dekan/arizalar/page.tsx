'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react'
import DormTabs from '@/components/dekan/DormTabs'
import { useDormTabs } from '@/lib/hooks/useDormTabs'
import { studentsInDorm } from '@/features/faculty-students/domain/dorm-scope'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { downloadXlsx } from '@/lib/spreadsheet-export'
import {
  Search,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  X,
  ExternalLink,
  ChevronRight,
  Undo2,
  Ban,
  ShieldOff,
  Clock,
  RotateCcw,
  Sparkles,
  PhoneCall,
  GraduationCap,
  DoorClosed,
  ShieldAlert,
  ArrowRight,
  BookOpen,
  MapPin,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useDekanScope } from '@/lib/hooks/useDekanScope'
import { getAuthHeaders } from '@/lib/auth-session'
import ConfirmModal from '@/components/ui/ConfirmModal'
import {
  approvePermitRequest,
  cancelPermitApproval,
  fetchDekanOverview,
  rejectPermitRequest,
  unblockPermitRequest,
} from '@/features/permits/client/admin-api'
import { permitFacultyLabel } from '@/lib/faculties'
import { directionLabel } from '@/lib/directions'
import { genderLabel } from '@/lib/gender'
import { dekanUI, statusChip, type DekanStatusTone } from '@/lib/dekan-ui'
import { SkelList } from '@/components/dekan/Skeletons'
import CustomSelect from '@/components/ui/CustomSelect'

interface PermitRequest {
  id: string
  passport_series: string
  jshshir: string | null
  full_name: string
  email: string
  phone: string
  gender: string
  faculty: string
  direction: string
  course: number
  permit_url: string
  status: 'pending' | 'approved' | 'rejected' | 'registered'
  room_number: string | null
  dorm_id: string | null
  reject_reason: string | null
  created_at: string
  warning_count?: number
  blacklisted?: boolean
  application_type?: string
  ai_review?: string
  relative_phone?: string | null
  origin_country?: string | null
  origin_region?: string | null
  study_type?: string | null
  blocked?: boolean
  rejection_count?: number
  blocked_at?: string | null
}

const STATUS_META: Record<PermitRequest['status'], { label: string; tone: DekanStatusTone }> = {
  pending: { label: 'Kutilmoqda', tone: 'warning' },
  approved: { label: 'Tasdiqlangan', tone: 'success' },
  rejected: { label: 'Rad etilgan', tone: 'danger' },
  registered: { label: 'Ro‘yxatdan o‘tgan', tone: 'info' },
}

function submittedDate(iso: string) {
  return new Date(iso).toLocaleDateString('uz-UZ')
}

function submittedDateTime(iso: string) {
  return new Date(iso).toLocaleString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

function ArizalarContent() {
  const searchParams = useSearchParams()
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const ui = dekanUI(isLight)

  // Scope & Data State
  const dormScope = useDormTabs({ globalView: true })
  const [allRequests, setRequests] = useState<PermitRequest[]>([])
  const requests = useMemo(
    () => (dormScope.global ? allRequests : studentsInDorm(allRequests, dormScope.dormId)),
    [allRequests, dormScope.global, dormScope.dormId],
  )
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters State
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<PermitRequest['status']>('pending')
  const [courseFilter, setCourseFilter] = useState<'all' | '1' | '2' | '3' | '4'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'yollanma' | 'imtiyozli'>('all')
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all')
  const [facultyFilter, setFacultyFilter] = useState('')

  // Selected Request
  const [selectedRequest, setSelectedReq] = useState<PermitRequest | null>(null)
  const selectedReq = requests.find((request) => request.id === selectedRequest?.id) ?? null

  const {
    faculty: dekanFaculty,
    effectiveFaculty,
    role: dekanRole,
    scope: saScope,
    resolved: facultyResolved,
  } = useDekanScope()

  const isGlobal = dekanRole === 'admin' && (!saScope || saScope === '*')

  // Modals state
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [unblockModalOpen, setUnblockModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)

  const handleViewDocument = async () => {
    if (!selectedReq) return
    const response = await fetch(`/api/staff/permit-document?id=${encodeURIComponent(selectedReq.id)}`, {
      headers: await getAuthHeaders(),
    })
    const result = await response.json()
    if (!response.ok || !result.url) {
      toast.error(result.error || 'Hujjatni ochib bo‘lmadi')
      return
    }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  const fetchRequests = useCallback(
    async (faculty: string | null, isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      try {
        if (!faculty && !isGlobal) {
          setRequests([])
          setLoading(false)
          return
        }
        const overview = await fetchDekanOverview()
        setRequests(overview.requests as PermitRequest[])
      } catch (err) {
        console.error('Error fetching permits:', err)
        toast.error('Yo‘llanmalarni yuklashda xatolik yuz berdi')
      } finally {
        setLoading(false)
        if (isRefresh) setRefreshing(false)
      }
    },
    [isGlobal],
  )

  useEffect(() => {
    if (!facultyResolved) return
    fetchRequests(dekanFaculty)
  }, [facultyResolved, dekanFaculty, fetchRequests])

  // Auto-open request from URL query params
  const openedLink = useRef<string | null>(null)
  useEffect(() => {
    const id = searchParams.get('id')
    if (id && openedLink.current !== id && (dormScope.ready || dormScope.global) && !loading) {
      const found = allRequests.find((r) => r.id === id)
      if (
        found &&
        (dormScope.global ||
          found.dorm_id === null ||
          dormScope.dorms.some((dorm) => dorm.dormId === found.dorm_id))
      ) {
        openedLink.current = id
        if (!dormScope.global) dormScope.select(found.dorm_id)
        setSelectedReq(found)
      }
    }
  }, [searchParams, allRequests, loading, dormScope])

  const facultiesInQueue = isGlobal
    ? Array.from(new Set(requests.map((r) => r.faculty))).sort((a, b) =>
        permitFacultyLabel(a).localeCompare(permitFacultyLabel(b)),
      )
    : []

  // KPI Statistics
  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'pending').length
    const approved = requests.filter((r) => r.status === 'approved').length
    const rejected = requests.filter((r) => r.status === 'rejected').length
    const registered = requests.filter((r) => r.status === 'registered').length
    return {
      pending,
      approved,
      rejected,
      registered,
      total: requests.length,
    }
  }, [requests])

  // Filtered & Ordered Requests
  const filteredRequests = useMemo(() => {
    return requests
      .filter((req) => {
        // Status filter
        if (req.status !== statusFilter) return false

        // Course filter
        if (courseFilter !== 'all' && String(req.course) !== courseFilter) return false

        // Type filter
        if (typeFilter === 'yollanma' && req.application_type === 'imtiyozli') return false
        if (typeFilter === 'imtiyozli' && req.application_type !== 'imtiyozli') return false

        // Gender filter
        if (genderFilter !== 'all' && req.gender !== genderFilter) return false

        // Faculty filter (global)
        if (facultyFilter && req.faculty !== facultyFilter) return false

        // Search term
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase().trim()
          const matchName = req.full_name.toLowerCase().includes(q)
          const matchPassport = req.passport_series.toLowerCase().includes(q)
          const matchJshshir = req.jshshir?.includes(q) ?? false
          const matchFaculty = req.faculty.toLowerCase().includes(q)
          const matchDirection = (directionLabel(req.direction) || '').toLowerCase().includes(q)
          if (!matchName && !matchPassport && !matchJshshir && !matchFaculty && !matchDirection) {
            return false
          }
        }

        return true
      })
      .sort((a, b) => {
        const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        return statusFilter === 'pending' ? diff : -diff
      })
  }, [requests, statusFilter, courseFilter, typeFilter, genderFilter, facultyFilter, searchTerm])

  // First pending request for quick action
  const firstPendingRequest = useMemo(
    () => requests.find((r) => r.status === 'pending'),
    [requests],
  )

  // Export to Excel helper
  const exportToExcel = async (dataToExport: PermitRequest[]) => {
    const headers = [
      '№',
      'F.I.Sh.',
      'Turi',
      'Pasport Seriyasi',
      'JShSHIR',
      'Telefon',
      'Email',
      'Jinsi',
      'Fakultet',
      'Yo‘nalish',
      'Kurs',
      'Xona raqami',
      'Status',
      'Yuborilgan sana',
      'Yuborilgan vaqt',
    ]

    const rawRows = dataToExport.map((req, idx) => [
      String(idx + 1),
      req.full_name,
      req.application_type === 'imtiyozli' ? 'Ariza/Tilxat' : 'Yo‘llanma',
      req.passport_series,
      req.jshshir ?? '-',
      req.phone,
      req.email,
      genderLabel(req.gender),
      permitFacultyLabel(req.faculty),
      directionLabel(req.direction),
      `${req.course}-kurs`,
      req.room_number ? `№-${req.room_number}` : 'Biriktirilmagan',
      req.status,
      submittedDate(req.created_at),
      new Date(req.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
    ])

    await downloadXlsx({
      filename: `yotoqxona_arizalar_${statusFilter}.xlsx`,
      sheetName: 'Arizalar',
      headers,
      rows: rawRows,
    })

    toast.success('Excel muvaffaqiyatli yuklab olindi!')
  }

  // Action handlers
  const handleApprove = async () => {
    if (!selectedReq) return
    setProcessing(true)
    try {
      await approvePermitRequest(selectedReq.id)
      toast.success(
        `${selectedReq.full_name}ning arizasi tasdiqlandi. Xona ro‘yxatdan o‘tgach, Xonalar sahifasidagi navbatda biriktiriladi.`,
      )
      setApproveModalOpen(false)
      await fetchRequests(dekanFaculty)
      setSelectedReq(null)
    } catch (err) {
      console.error(err)
      toast.error('Tasdiqlashda xatolik yuz berdi')
    } finally {
      setProcessing(false)
    }
  }

  const handleCancel = async () => {
    if (!selectedReq) return
    setProcessing(true)
    try {
      await cancelPermitApproval(selectedReq.id)
      toast.success(`${selectedReq.full_name}ning tasdig‘i bekor qilindi — ariza "Kutilmoqda"ga qaytdi`)
      setCancelModalOpen(false)
      await fetchRequests(dekanFaculty)
      setSelectedReq(null)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Bekor qilishda xatolik yuz berdi')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedReq) return
    if (!rejectReason.trim()) {
      toast.error('Rad etish sababini yozing!')
      return
    }
    setProcessing(true)
    try {
      await rejectPermitRequest(selectedReq.id, rejectReason)
      toast.success('Ariza rad etildi')
      setRejectModalOpen(false)
      setRejectReason('')
      await fetchRequests(dekanFaculty)
      setSelectedReq(null)
    } catch (err) {
      console.error(err)
      toast.error('Rad etishda xatolik yuz berdi')
    } finally {
      setProcessing(false)
    }
  }

  const handleUnblock = async () => {
    if (!selectedReq) return
    setProcessing(true)
    try {
      await unblockPermitRequest(selectedReq.id)
      toast.success(`${selectedReq.full_name}ning bloki yechildi — endi qaytadan ariza yubora oladi`)
      setUnblockModalOpen(false)
      await fetchRequests(dekanFaculty)
      setSelectedReq(null)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Blokni yechishda xatolik yuz berdi')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 1. Executive Hero Banner */}
      <div className="no-shelf relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-800 p-5 sm:p-7 text-white shadow-xl shadow-indigo-950/15 border border-white/20">
        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white border border-white/25 shadow-xs">
                <Sparkles size={12} className="text-amber-300" />
                {isGlobal ? 'Superadmin boshqaruvi' : 'Dekan Paneli'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-900/40 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-indigo-100 border border-white/10">
                {stats.pending > 0 ? `${stats.pending} ta yangi ariza kutilmoqda` : 'Barcha arizalar ko‘rib chiqilgan'}
              </span>
            </div>

            <h1 className="mt-2.5 text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white drop-shadow-sm">
              Yo‘llanmalar va Arizalar Nazorati
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-indigo-100/90 max-w-2xl leading-relaxed">
              {isGlobal
                ? 'Barcha fakultetlar bo‘yicha talabalar arizalari — markaziy tekshiruv va navbat'
                : effectiveFaculty
                  ? `${permitFacultyLabel(effectiveFaculty)} fakulteti bo‘yicha kelib tushgan ruxsatnomalar`
                  : 'Kelib tushgan ruxsatnomalarni tekshirish, tasdiqlash va xonalarga joylashtirish navbati'}
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-2">
            {/* Export Button */}
            <button
              type="button"
              onClick={() => exportToExcel(filteredRequests)}
              disabled={filteredRequests.length === 0}
              className="no-shelf cursor-pointer inline-flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 px-4 py-2.5 text-xs font-bold text-white transition-all active:scale-95 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={14} />
              <span>Excel yuklab olish</span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => void fetchRequests(dekanFaculty, true)}
              disabled={refreshing}
              className="no-shelf cursor-pointer inline-flex items-center justify-center h-10 w-10 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white transition-all active:scale-95 shadow-xs disabled:opacity-50"
              title="Ma’lumotlarni yangilash"
            >
              <RotateCcw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Multi-Dorm Tabs if faculty owns multiple buildings */}
        {!dormScope.global && dormScope.dorms.length > 0 && (
          <div className="relative z-10 mt-5 pt-4 border-t border-white/15">
            <DormTabs
              scope={dormScope}
              isLight={isLight}
              onChange={() => {
                setSelectedReq(null)
                setApproveModalOpen(false)
                setRejectModalOpen(false)
                setCancelModalOpen(false)
                setUnblockModalOpen(false)
                setSearchTerm('')
              }}
            />
          </div>
        )}
      </div>

      {/* 2. 4 Interactive KPI Metric Cards (Compact Height) */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {/* Card 1: Pending Requests */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('pending')
            setSelectedReq(null)
          }}
          className={`no-shelf cursor-pointer text-left rounded-2xl border px-3 py-2.5 sm:px-3.5 sm:py-2.5 shadow-2xs transition-all active:scale-[0.98] ${
            statusFilter === 'pending'
              ? 'ring-2 ring-amber-500 bg-amber-50/40 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700'
              : ui.card
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Kutilmoqda</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800">
              <Clock size={12} />
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black leading-tight text-amber-600 dark:text-amber-400">
              {stats.pending}
            </span>
            <span className={`text-[11px] font-semibold ${ui.faint}`}>ta ariza</span>
          </div>
          <p className={`mt-0.5 text-[10px] font-medium ${ui.faint} truncate`}>
            Ko‘rib chiqish navbatida
          </p>
        </button>

        {/* Card 2: Approved Requests */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('approved')
            setSelectedReq(null)
          }}
          className={`no-shelf cursor-pointer text-left rounded-2xl border px-3 py-2.5 sm:px-3.5 sm:py-2.5 shadow-2xs transition-all active:scale-[0.98] ${
            statusFilter === 'approved'
              ? 'ring-2 ring-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700'
              : ui.card
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Tasdiqlangan</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800">
              <CheckCircle2 size={12} />
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black leading-tight text-emerald-600 dark:text-emerald-400">
              {stats.approved}
            </span>
            <span className={`text-[11px] font-semibold ${ui.faint}`}>ta ariza</span>
          </div>
          <p className={`mt-0.5 text-[10px] font-medium ${ui.faint} truncate`}>
            Xona biriktirishga tayyor
          </p>
        </button>

        {/* Card 3: Rejected Requests */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('rejected')
            setSelectedReq(null)
          }}
          className={`no-shelf cursor-pointer text-left rounded-2xl border px-3 py-2.5 sm:px-3.5 sm:py-2.5 shadow-2xs transition-all active:scale-[0.98] ${
            statusFilter === 'rejected'
              ? 'ring-2 ring-rose-500 bg-rose-50/40 dark:bg-rose-950/30 border-rose-300 dark:border-rose-700'
              : ui.card
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Rad etilgan</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 ring-1 ring-rose-200 dark:ring-rose-800">
              <XCircle size={12} />
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black leading-tight text-rose-600 dark:text-rose-400">
              {stats.rejected}
            </span>
            <span className={`text-[11px] font-semibold ${ui.faint}`}>ta ariza</span>
          </div>
          <p className={`mt-0.5 text-[10px] font-medium ${ui.faint} truncate`}>
            Kamchiliklar bilan qaytarilgan
          </p>
        </button>

        {/* Card 4: Registered Residents */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter('registered')
            setSelectedReq(null)
          }}
          className={`no-shelf cursor-pointer text-left rounded-2xl border px-3 py-2.5 sm:px-3.5 sm:py-2.5 shadow-2xs transition-all active:scale-[0.98] ${
            statusFilter === 'registered'
              ? 'ring-2 ring-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700'
              : ui.card
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Ro‘yxatdan o‘tgan</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-800">
              <GraduationCap size={12} />
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black leading-tight text-indigo-600 dark:text-indigo-400">
              {stats.registered}
            </span>
            <span className={`text-[11px] font-semibold ${ui.faint}`}>talaba</span>
          </div>
          <p className={`mt-0.5 text-[10px] font-medium ${ui.faint} truncate`}>
            Akkauntini faollashtirgan
          </p>
        </button>
      </div>

      {facultyResolved && !effectiveFaculty && !isGlobal && (
        <div
          className={`flex items-start gap-2 rounded-2xl border p-4 text-xs font-medium ${
            isLight
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-amber-500/25 bg-amber-500/10 text-amber-200'
          }`}
        >
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            Hisobingizga fakultet biriktirilmagan, shuning uchun hech qanday ariza ko‘rsatilmayapti.
            Administratorga murojaat qilib, profilingizga fakultet qo‘shishini so‘rang.
          </span>
        </div>
      )}

      {/* 3. Combined Filtering Toolbar (Spacious Multi-tier Layout) */}
      <div className={`no-shelf rounded-2xl border p-3.5 shadow-2xs space-y-3 ${ui.card}`}>
        {/* Row 1: Search + Global Faculty Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${ui.faint}`} />
            <input
              type="text"
              placeholder="Ism, pasport seriya, JShSHIR yoki yo‘nalish bo‘yicha qidirish..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`no-shelf w-full rounded-xl border py-2.5 pl-10 pr-9 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                isLight
                  ? 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400'
                  : 'border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500'
              }`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className={`no-shelf absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md ${ui.btnGhost}`}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Global Superadmin Faculty Filter */}
          {isGlobal && facultiesInQueue.length > 0 && (
            <div className="sm:w-64">
              <CustomSelect
                value={facultyFilter}
                onChange={(value) => {
                  setFacultyFilter(value)
                  setSelectedReq(null)
                }}
                className={`w-full text-xs py-2 px-3 rounded-xl border ${ui.input}`}
                options={[
                  { value: '', label: `Barcha fakultetlar (${requests.length})` },
                  ...facultiesInQueue.map((f) => ({
                    value: f,
                    label: `${permitFacultyLabel(f)} (${requests.filter((r) => r.faculty === f).length})`,
                  })),
                ]}
              />
            </div>
          )}
        </div>

        {/* Row 2: Status Filter Tabs (Dedicated spacious row) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          {(Object.keys(STATUS_META) as PermitRequest['status'][]).map((status) => {
            const count = requests.filter(
              (r) => r.status === status && (!facultyFilter || r.faculty === facultyFilter),
            ).length
            const meta = STATUS_META[status]
            const isActive = statusFilter === status
            return (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setStatusFilter(status)
                  setSelectedReq(null)
                }}
                className={`no-shelf cursor-pointer px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs shadow-blue-500/20'
                    : isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-300'
                }`}
              >
                <span>{meta.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                    isActive ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Row 3: Secondary Filters: Kurs & Ariza Turi (Separate spacious row) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Kurs Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider mr-1 ${ui.faint}`}>Kurs:</span>
            {(['all', '1', '2', '3', '4'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCourseFilter(c)}
                className={`no-shelf cursor-pointer h-7 px-2.5 rounded-lg text-[11px] font-bold transition-all ${
                  courseFilter === c
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {c === 'all' ? 'Barchasi' : `${c}-kurs`}
              </button>
            ))}
          </div>

          {/* Application Type Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider mr-1 ${ui.faint}`}>Ariza turi:</span>
            {(
              [
                { id: 'all', label: 'Barchasi' },
                { id: 'yollanma', label: 'Yo‘llanma' },
                { id: 'imtiyozli', label: 'Ariza/Tilxat' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeFilter(t.id)}
                className={`no-shelf cursor-pointer h-7 px-2.5 rounded-lg text-[11px] font-bold transition-all ${
                  typeFilter === t.id
                    ? 'bg-purple-600 text-white shadow-xs'
                    : isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Gender Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider mr-1 ${ui.faint}`}>Jins:</span>
            {(
              [
                { id: 'all', label: 'Barchasi' },
                { id: 'male', label: 'O‘g‘il bolalar' },
                { id: 'female', label: 'Qizlar' },
              ] as const
            ).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGenderFilter(g.id)}
                className={`no-shelf cursor-pointer h-7 px-2.5 rounded-lg text-[11px] font-bold transition-all ${
                  genderFilter === g.id
                    ? 'bg-teal-600 text-white shadow-xs'
                    : isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Two-Column Layout (List on Left, Sticky Details on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Requests List */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3">
          {loading ? (
            <SkelList count={6} />
          ) : filteredRequests.length === 0 ? (
            <div className={`rounded-3xl border p-12 text-center ${ui.card}`}>
              <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl ${ui.accentTileSoft}`}>
                <FileText size={24} />
              </div>
              <h3 className={`text-base font-bold ${ui.strong}`}>Arizalar topilmadi</h3>
              <p className={`mt-1 text-xs max-w-sm mx-auto ${ui.muted}`}>
                {searchTerm || courseFilter !== 'all' || typeFilter !== 'all' || genderFilter !== 'all'
                  ? 'Kiritilgan qidiruv yoki filtr mezonlariga mos keluvchi arizalar mavjud emas.'
                  : 'Ushbu statusda ko‘rib chiqilishi kerak bo‘lgan arizalar yo‘q.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredRequests.map((req, idx) => {
                const isSelected = selectedReq?.id === req.id
                const isFemale = req.gender === 'female'

                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => setSelectedReq(req)}
                    className={`no-shelf cursor-pointer w-full text-left rounded-2xl border p-3.5 sm:p-4 transition-all active:scale-[0.99] select-none ${
                      isSelected
                        ? isLight
                          ? 'border-indigo-600 bg-indigo-50/60 shadow-md ring-2 ring-indigo-500/20'
                          : 'border-indigo-500 bg-indigo-950/40 shadow-md ring-2 ring-indigo-500/30'
                        : `${ui.card} hover:border-indigo-300 dark:hover:border-indigo-800`
                    }`}
                  >
                    <div className="flex items-start sm:items-center justify-between gap-3">
                      {/* Left: Avatar + Details */}
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Initials Avatar */}
                        <div
                          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-black shadow-xs ${
                            isFemale
                              ? 'bg-gradient-to-br from-pink-500 to-rose-600 text-white'
                              : 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                          }`}
                        >
                          {getInitials(req.full_name)}
                          {/* FIFO Queue Order Badge for pending status */}
                          {statusFilter === 'pending' && (
                            <span className="absolute -top-1.5 -left-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 text-[9px] font-black text-white px-1 shadow-xs border border-white/20">
                              #{idx + 1}
                            </span>
                          )}
                        </div>

                        {/* Text details */}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className={`text-xs sm:text-sm font-black tracking-tight truncate ${ui.strong}`}>
                              {req.full_name}
                            </h3>

                            {/* Application Type Chip */}
                            {req.application_type === 'imtiyozli' ? (
                              <span className="rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-1.5 py-0.5 text-[9px] font-black uppercase">
                                Ariza/Tilxat
                              </span>
                            ) : (
                              <span className="rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 px-1.5 py-0.5 text-[9px] font-black uppercase">
                                Yo‘llanma
                              </span>
                            )}

                            {/* Alerts / Badges */}
                            {req.blacklisted && (
                              <span className="rounded-md bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                                Qora ro‘yxat
                              </span>
                            )}
                            {req.blocked && (
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                                <Ban size={9} /> Bloklangan
                              </span>
                            )}
                            {req.warning_count && req.warning_count > 0 ? (
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 px-1.5 py-0.5 text-[9px] font-bold">
                                <AlertTriangle size={9} /> {req.warning_count} ogohlantirish
                              </span>
                            ) : null}
                            {req.ai_review === 'manual' && (
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 px-1.5 py-0.5 text-[9px] font-bold">
                                <AlertTriangle size={9} /> AI tekshirmagan
                              </span>
                            )}
                          </div>

                          {/* Faculty, Direction, Course */}
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className={`font-semibold ${ui.muted}`}>
                              {directionLabel(req.direction) || permitFacultyLabel(req.faculty)}
                            </span>
                            <span className={ui.faint}>•</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              {req.course}-kurs
                            </span>
                            {req.study_type && (
                              <>
                                <span className={ui.faint}>•</span>
                                <span className={`text-[11px] font-medium ${ui.faint}`}>
                                  {req.study_type === 'grant' ? 'Davlat granti' : 'Kontrakt'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Room status & Submission time */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          {req.room_number ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-0.5 text-[10px] font-bold">
                              <DoorClosed size={10} /> № {req.room_number}
                            </span>
                          ) : (
                            <span className={`text-[10px] font-medium ${ui.faint}`}>
                              Xona kutmoqda
                            </span>
                          )}
                          <p className={`mt-1 text-[10px] font-medium tabular-nums ${ui.faint}`}>
                            {submittedDateTime(req.created_at)}
                          </p>
                        </div>

                        <ChevronRight
                          size={16}
                          className={`transition-transform duration-150 ${
                            isSelected ? 'translate-x-0.5 text-indigo-600 dark:text-indigo-400' : ui.faint
                          }`}
                        />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Sticky Detail Panel */}
        <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-20 lg:self-start">
          <AnimatePresence mode="wait">
            {selectedReq ? (
              <motion.div
                key={selectedReq.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className={`no-shelf rounded-3xl border p-4 sm:p-5 space-y-4 lg:max-h-[calc(100dvh-6.5rem)] lg:overflow-y-auto shadow-sm ${ui.card}`}
              >
                {/* Panel Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${ui.accentTileSoft}`}>
                      <FileText size={14} />
                    </span>
                    <h3 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
                      Ariza Tafsilotlari
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedReq(null)}
                    className={`no-shelf p-1.5 rounded-xl ${ui.btnGhost}`}
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Applicant Header Profile */}
                <div className={`p-3 rounded-2xl border flex items-center gap-3 ${ui.inset}`}>
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white shadow-xs ${
                      selectedReq.gender === 'female'
                        ? 'bg-gradient-to-br from-pink-500 to-rose-600'
                        : 'bg-gradient-to-br from-blue-600 to-indigo-600'
                    }`}
                  >
                    {getInitials(selectedReq.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className={`text-sm font-black truncate leading-tight ${ui.strong}`}>
                      {selectedReq.full_name}
                    </h4>
                    <p className={`text-[11px] font-medium truncate ${ui.muted}`}>
                      {selectedReq.email}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                          statusChip(STATUS_META[selectedReq.status].tone, isLight).chip
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            statusChip(STATUS_META[selectedReq.status].tone, isLight).dot
                          }`}
                        />
                        {STATUS_META[selectedReq.status].label}
                      </span>
                      {selectedReq.room_number ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          Xona: № {selectedReq.room_number}
                        </span>
                      ) : (
                        <span className={`text-[9px] font-medium ${ui.faint}`}>Xona biriktirilmagan</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Warnings / Alerts */}
                {selectedReq.blacklisted && (
                  <div className={`flex items-start gap-2 rounded-xl border p-2.5 text-xs font-medium ${ui.dangerSoft}`}>
                    <AlertTriangle size={14} className="shrink-0 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-black uppercase text-[10px] text-red-700 dark:text-red-300">
                        Qora Ro‘yxat
                      </p>
                      <p className="text-[10px] leading-tight">
                        Ichki tartib buzilganligi sababli qora ro‘yxatga kiritilgan.
                      </p>
                    </div>
                  </div>
                )}

                {selectedReq.warning_count && selectedReq.warning_count > 0 ? (
                  <div className="flex items-start gap-2 rounded-xl border p-2.5 text-xs font-medium bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
                    <ShieldAlert size={14} className="shrink-0 text-amber-600 mt-0.5" />
                    <p className="text-[10px] font-bold">
                      {selectedReq.warning_count} ta faol ogohlantirish qayd etilgan.
                    </p>
                  </div>
                ) : null}

                {selectedReq.ai_review === 'manual' && (
                  <div className="flex items-start gap-2 rounded-xl border p-2.5 text-xs font-medium bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
                    <AlertTriangle size={14} className="shrink-0 text-amber-600 mt-0.5" />
                    <p className="text-[10px] leading-tight">
                      AI tekshiruvi amalga oshmagan. Hujjatlarni qo‘lda tekshiring.
                    </p>
                  </div>
                )}

                {/* 1. Academic Direction & Badges */}
                <div className={`p-3 rounded-2xl border space-y-2 ${ui.inset}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      <GraduationCap size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold leading-tight text-xs ${ui.strong}`}>
                        {directionLabel(selectedReq.direction) || selectedReq.direction}
                      </p>
                      <p className={`text-[10px] font-medium leading-tight text-slate-500 mt-0.5`}>
                        {permitFacultyLabel(selectedReq.faculty)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-200/50 dark:border-slate-800/60">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                      {selectedReq.course}-kurs
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/40 dark:border-slate-700/50">
                      {selectedReq.study_type === 'grant' ? 'Davlat granti' : selectedReq.study_type === 'kontrakt' ? 'To‘lov-shartnoma' : 'Oddiy'}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/40 dark:border-slate-700/50">
                      {genderLabel(selectedReq.gender)}
                    </span>
                  </div>
                </div>

                {/* 2. Passport & JSHSHIR (2 Clean Tiles with label top, value bottom) */}
                <div className="grid grid-cols-2 gap-2">
                  <div className={`p-2.5 rounded-xl border ${ui.inset}`}>
                    <span className={`block text-[9px] font-black uppercase tracking-wider ${ui.faint}`}>
                      Pasport
                    </span>
                    <span className={`block mt-0.5 font-mono text-xs font-black tracking-wide ${ui.strong}`}>
                      {selectedReq.passport_series}
                    </span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${ui.inset}`}>
                    <span className={`block text-[9px] font-black uppercase tracking-wider ${ui.faint}`}>
                      JShShIR
                    </span>
                    <span className={`block mt-0.5 font-mono text-xs font-black tracking-wide ${ui.strong}`}>
                      {selectedReq.jshshir ?? '—'}
                    </span>
                  </div>
                </div>

                {/* 3. Location / Hudud (Full Width - no truncated text) */}
                <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${ui.inset}`}>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
                    <MapPin size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className={`block text-[9px] font-black uppercase tracking-wider ${ui.faint}`}>
                      Doimiy yashash manzili
                    </span>
                    <span className={`block text-[11px] font-bold leading-tight ${ui.strong}`}>
                      {[selectedReq.origin_country, selectedReq.origin_region].filter(Boolean).join(', ') || 'Ma’lumot kiritilmagan'}
                    </span>
                  </div>
                </div>

                {/* 4. Contact Phone Numbers */}
                <div className={`p-2.5 rounded-xl border space-y-2 ${ui.inset}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className={`block text-[9px] font-black uppercase tracking-wider ${ui.faint}`}>
                        Talaba telefoni
                      </span>
                      <span className={`font-mono text-xs font-black tracking-wide ${ui.strong}`}>
                        {selectedReq.phone}
                      </span>
                    </div>
                    <a
                      href={`tel:${selectedReq.phone.replace(/[^\d+]/g, '')}`}
                      className="no-shelf inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold transition-colors"
                      title="Qo‘ng‘iroq qilish"
                    >
                      <PhoneCall size={11} />
                      <span>Qo‘ng‘iroq</span>
                    </a>
                  </div>

                  {selectedReq.relative_phone && (
                    <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className={`block text-[9px] font-black uppercase tracking-wider ${ui.faint}`}>
                          Yaqin qarindoshi
                        </span>
                        <span className={`font-mono text-xs font-black tracking-wide ${ui.strong}`}>
                          {selectedReq.relative_phone}
                        </span>
                      </div>
                      <a
                        href={`tel:${selectedReq.relative_phone.replace(/[^\d+]/g, '')}`}
                        className="no-shelf inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold transition-colors"
                        title="Qo‘ng‘iroq qilish"
                      >
                        <PhoneCall size={11} />
                        <span>Qo‘ng‘iroq</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* 5. Timestamp */}
                <div className="flex items-center justify-between text-[10px] px-1 text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={11} /> Ariza topshirilgan:
                  </span>
                  <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                    {submittedDateTime(selectedReq.created_at)}
                  </span>
                </div>

                {/* Reject Reason Notice if rejected */}
                {selectedReq.reject_reason && (
                  <div className={`p-2.5 rounded-xl border ${ui.dangerSoft}`}>
                    <p className="text-[10px] font-black uppercase text-red-700 dark:text-red-300">
                      Rad etish sababi:
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-red-900 dark:text-red-200">
                      {selectedReq.reject_reason}
                    </p>
                  </div>
                )}

                {/* Documents Row */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleViewDocument}
                    className={`no-shelf cursor-pointer flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 ${ui.btnGhost}`}
                  >
                    <FileText size={13} />
                    <span className="truncate">Ruxsatnoma</span>
                    <ExternalLink size={10} />
                  </button>

                  {(selectedReq.application_type === 'imtiyozli' || selectedReq.study_type || selectedReq.origin_region) && (
                    <button
                      type="button"
                      onClick={() =>
                        window.open(`/dekan/hujjat?id=${selectedReq.id}`, '_blank', 'noopener,noreferrer')
                      }
                      className="no-shelf cursor-pointer flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-2.5 text-[11px] font-black uppercase tracking-wider text-white shadow-xs transition-all active:scale-95"
                    >
                      <BookOpen size={13} />
                      <span className="truncate">Tilxat / Ariza</span>
                      <ExternalLink size={10} />
                    </button>
                  )}
                </div>

                {/* Decision Actions */}
                {selectedReq.status === 'pending' && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setRejectModalOpen(true)}
                      className="no-shelf cursor-pointer flex items-center justify-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 py-2.5 text-xs font-black uppercase tracking-wider transition-all active:scale-95"
                    >
                      <XCircle size={14} />
                      <span>Rad etish</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setApproveModalOpen(true)}
                      className="no-shelf cursor-pointer flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-2.5 text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                    >
                      <CheckCircle2 size={14} />
                      <span>Tasdiqlash</span>
                    </button>
                  </div>
                )}

                {selectedReq.status === 'approved' && (
                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setCancelModalOpen(true)}
                      className="no-shelf cursor-pointer flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 py-2 text-xs font-black uppercase tracking-wider transition-all active:scale-95"
                    >
                      <Undo2 size={13} />
                      <span>Tasdiqni bekor qilish</span>
                    </button>
                    <p className={`text-center text-[9px] leading-tight ${ui.faint}`}>
                      Ariza qayta &laquo;Kutilmoqda&raquo; holatiga qaytariladi.
                    </p>
                  </div>
                )}

                {selectedReq.status === 'rejected' && selectedReq.blocked && (
                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setUnblockModalOpen(true)}
                      className="no-shelf cursor-pointer flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-blue-500/20"
                    >
                      <ShieldOff size={13} />
                      <span>Blokni yechish</span>
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              /* Empty State Widget */
              <div className={`no-shelf rounded-3xl border p-8 flex flex-col items-center justify-center text-center shadow-xs ${ui.card}`}>
                <div className={`mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl ${ui.accentTileSoft}`}>
                  <FileText size={24} />
                </div>
                <h4 className={`text-sm font-black tracking-tight ${ui.strong}`}>
                  Ariza Tafsilotlari
                </h4>
                <p className={`mt-1 text-xs max-w-xs leading-relaxed ${ui.muted}`}>
                  Batafsil ma’lumotlarni ko‘rish, hujjatlarni tekshirish va tasdiqlash uchun chap tarafdagi ro‘yxatdan arizani tanlang.
                </p>

                {/* Quick Helper Button if pending items exist */}
                {firstPendingRequest && (
                  <button
                    type="button"
                    onClick={() => setSelectedReq(firstPendingRequest)}
                    className="no-shelf cursor-pointer mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 text-xs font-black uppercase tracking-wider shadow-md shadow-blue-500/20 transition-all active:scale-95"
                  >
                    <span>Navbatdagi arizani ko‘rish</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Confirmation Modals */}
      {/* 1. Approve Modal */}
      <ConfirmModal
        isOpen={approveModalOpen && !!selectedReq}
        title="Arizani tasdiqlash"
        description={selectedReq ? `${selectedReq.full_name} (${genderLabel(selectedReq.gender)})` : undefined}
        onClose={() => setApproveModalOpen(false)}
        onConfirm={handleApprove}
        confirmText="Tasdiqlash"
        isLoading={processing}
      >
        <p>
          Ariza tasdiqlanadi va talaba ro‘yxatdan o‘ta oladi. Xona keyinroq, talaba ro‘yxatdan o‘tgach,
          <strong> Xonalar</strong> sahifasidagi xonasiz talabalar navbatida biriktiriladi.
        </p>
      </ConfirmModal>

      {/* 2. Cancel Approval Modal */}
      <ConfirmModal
        isOpen={cancelModalOpen && !!selectedReq}
        title="Tasdiqni bekor qilish"
        description={selectedReq ? `${selectedReq.full_name} (${genderLabel(selectedReq.gender)})` : undefined}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancel}
        confirmText="Bekor qilish"
        confirmVariant="danger"
        isLoading={processing}
      >
        <p>
          Ariza qayta <strong>&laquo;Kutilmoqda&raquo;</strong> holatiga qaytadi va talaba ro‘yxatdan
          o‘ta olmaydi. Bu arizaga biriktirilgan xona (agar bo‘lsa) bo‘shatiladi.
        </p>
      </ConfirmModal>

      {/* 3. Reject Modal */}
      <ConfirmModal
        isOpen={rejectModalOpen && !!selectedReq}
        title="Arizani rad etish"
        onClose={() => setRejectModalOpen(false)}
        onConfirm={handleReject}
        confirmText="Rad etish"
        confirmVariant="danger"
        isLoading={processing}
      >
        <div className="space-y-2 text-left">
          <label className={`block text-[11px] font-bold uppercase tracking-wider ${ui.muted}`}>
            Rad etish sababi <span className="text-red-500">*</span>
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Talaba ma’lumotlari mos kelmadi / ruxsatnoma muddati o‘tgan / hujjat sifatsiz..."
            rows={4}
            className={`no-shelf w-full text-xs p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-red-500/20 ${ui.input}`}
            required
          />
        </div>
      </ConfirmModal>

      {/* 4. Unblock Modal */}
      <ConfirmModal
        isOpen={unblockModalOpen && !!selectedReq}
        title="Blokni yechish"
        description={selectedReq ? `${selectedReq.full_name} (${selectedReq.passport_series})` : undefined}
        onClose={() => setUnblockModalOpen(false)}
        onConfirm={handleUnblock}
        confirmText="Blokni yechish"
        isLoading={processing}
      >
        <p>
          Ariza bloki yechiladi va rad etishlar hisobi <strong>0</strong> ga qaytadi. Talaba yana bir marta
          ariza yuborish imkoniyatiga ega bo‘ladi.
        </p>
      </ConfirmModal>
    </div>
  )
}

export default function DekanArizalarPage() {
  return (
    <Suspense fallback={<SkelList count={6} />}>
      <ArizalarContent />
    </Suspense>
  )
}
