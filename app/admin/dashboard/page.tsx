'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { downloadXlsx } from '@/lib/spreadsheet-export'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import Link from 'next/link'
import { AlertTriangle, Loader, X, Activity, Cpu, RefreshCw, ServerCog, ArrowRight } from 'lucide-react'
import StatCard from '@/components/admin/StatCard'
import CustomSelect from '@/components/ui/CustomSelect'
import { StaggerList, StaggerItem } from '@/components/motion/StaggerList'
import { useRoomFloors } from '@/lib/hooks/useRoomFloors'
import { useThemeStore } from '@/lib/stores/theme-store'
import toast from 'react-hot-toast'
import { fetchAdminPaymentSummary } from '@/features/payments/client/api'
import { fetchAdminDashboard } from '@/features/admin-dashboard/client/api'
import { fetchAppSettings } from '@/features/app-settings/client/api'

interface DashboardStats {
  totalStudents: number
  totalRequests: number
  totalUsers: number
  totalEducators: number
  approvedRequests: number
  pendingRequests: number
  rejectedRequests: number
  loading: boolean
}

type MonthlyStat = {
  month: string
  monthIdx: number
  year: number
  students: number
  applications: number
  approved: number
  rejected: number
}

type StudentReportRow = {
  id?: string
  full_name?: string | null
  middle_name?: string | null
  email?: string | null
  phone?: string | null
  phone_number?: string | null
  faculty?: string | null
  direction?: string | null
  course?: number | string | null
  group?: number | string | null
  room_number?: string | null
  gender?: string | null
  nationality?: string | null
  region?: string | null
  district?: string | null
  mahalla?: string | null
  study_type?: string | null
  entry_date?: string | null
  status?: string | null
  created_at?: string | null
  passport_series?: string | null
  jshshir?: string | null
  passport_date?: string | null
  birth_date?: string | null
  father_full_name?: string | null
  father_workplace?: string | null
  father_phone?: string | null
  mother_full_name?: string | null
  mother_workplace?: string | null
  mother_phone?: string | null
}

type ArizaStatRow = {
  created_at?: string | null
  status?: string | null
}

export default function AdminDashboard() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const [waitingPaymentsCount, setWaitingPaymentsCount] = useState(0)

  const surfaceBg = isLight ? 'bg-white/80 border-slate-200/80 shadow-lg shadow-slate-100/40' : 'bg-[#0f172a]/30 border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.3)]'
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'

  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalRequests: 0,
    totalUsers: 0,
    totalEducators: 0,
    approvedRequests: 0,
    pendingRequests: 0,
    rejectedRequests: 0,
    loading: true,
  })
  const [activeTab, setActiveTab] = useState('overview')
  const [applicationStatusData, setApplicationStatusData] = useState([
    { name: 'Tasdiqlangan', value: 0, color: '#10b981' },
    { name: 'Kutish', value: 0, color: '#f59e0b' },
    { name: 'Rad etilgan', value: 0, color: '#ef4444' },
  ])
  const [monthlyData, setMonthlyData] = useState<MonthlyStat[]>(() => {
    const monthsUz = [
      'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 
      'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
    ]
    const result: MonthlyStat[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      result.push({
        month: monthsUz[d.getMonth()],
        monthIdx: d.getMonth(),
        year: d.getFullYear(),
        students: 0,
        applications: 0,
        approved: 0,
        rejected: 0
      })
    }
    return result
  })

  // Tezkor amallar uchun holatlar
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [systemStatus, setSystemStatus] = useState<{
    dbStatus: 'online' | 'offline'
    dbPing: number
    apiStatus: 'online' | 'offline'
    apiPing: number
    time: string
  } | null>(null)

  // Hisobotlar uchun filterlar va eksport
  const [exporting, setExporting] = useState(false)
  const [allStudents, setAllStudents] = useState<StudentReportRow[]>([])
  const [reportFilters, setReportFilters] = useState({
    gender: 'all',
    nationality: 'all',
    floor: 'all',
    roomStart: '',
    roomEnd: ''
  })
  // null (not a guessed default) while settings are loading or unavailable —
  // a wrong guess would silently hide real floors above it from the filter.
  const [floorCount, setFloorCount] = useState<number | null>(null)

  // Room -> floor as entered in the Qavat tarxi quruvchisi. floorCount stays
  // the fallback for floors that exist in settings but have no rooms drawn yet.
  const { rooms: layoutRooms, floors: layoutFloors, floorOf } = useRoomFloors()

  useEffect(() => {
    fetchAppSettings()
      .then((settings) => setFloorCount(settings.floorCount))
      .catch(() => toast.error("Qavatlar sozlamasini yuklab bo'lmadi"))
  }, [])

  const floorOptions = useMemo(
    () => (layoutFloors.length > 0 ? layoutFloors : Array.from({ length: floorCount ?? 0 }, (_, i) => i + 1)),
    [layoutFloors, floorCount],
  )

  // Placeholder hints for the room-range inputs: the real first/last room of
  // the selected floor, instead of assuming 30 rooms per floor.
  const selectedFloorRoomRange = useMemo(() => {
    if (reportFilters.floor === 'all') return null
    const target = parseInt(reportFilters.floor)
    const numbers = layoutRooms
      .filter((room) => room.floor === target)
      .map((room) => Number(room.roomNumber.match(/\d+/)?.[0]))
      .filter((value) => Number.isFinite(value))
    if (numbers.length === 0) return null
    return { start: Math.min(...numbers), end: Math.max(...numbers) }
  }, [layoutRooms, reportFilters.floor])

  const loadStats = async (silent = false) => {
    if (!silent) {
      setStats((prev) => ({ ...prev, loading: true }))
    }
    try {
      const dashboard = await fetchAdminDashboard()
      const { students: studentsData, applications: arizalarData } = dashboard
      const {
        totalStudents: studentCount,
        totalEducators: educatorCount,
        totalRequests: requestCount,
        approvedRequests: approvedCount,
        pendingRequests: pendingCount,
        rejectedRequests: rejectedCount,
        totalUsers: userCount,
      } = dashboard.stats

      const paymentSummary = await fetchAdminPaymentSummary()
      setWaitingPaymentsCount(paymentSummary.waitingCount)

      setStats({
        totalStudents: studentCount || 0,
        totalRequests: requestCount || 0,
        totalUsers: userCount || 0,
        totalEducators: educatorCount || 0,
        approvedRequests: approvedCount || 0,
        pendingRequests: pendingCount || 0,
        rejectedRequests: rejectedCount || 0,
        loading: false,
      })

      setApplicationStatusData([
        { name: 'Tasdiqlangan', value: approvedCount || 0, color: '#10b981' },
        { name: 'Kutish', value: pendingCount || 0, color: '#f59e0b' },
        { name: 'Rad etilgan', value: rejectedCount || 0, color: '#ef4444' },
      ])

      // Talabalarni to'liq ma'lumotlarini hisobot uchun olish
      setAllStudents(studentsData)

      // 6 oylik statistika massivini tayyorlash
      const monthsUz = [
        'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 
        'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
      ]
      const currentMonths: MonthlyStat[] = []
      const now = new Date()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        currentMonths.push({
          month: monthsUz[d.getMonth()],
          monthIdx: d.getMonth(),
          year: d.getFullYear(),
          students: 0,
          applications: 0,
          approved: 0,
          rejected: 0
        })
      }

      // Talabalarni joriy oylar bo'yicha guruhlash
      if (studentsData) {
        ;(studentsData as StudentReportRow[]).forEach((student) => {
          if (!student.created_at) return
          const date = new Date(student.created_at)
          const m = date.getMonth()
          const y = date.getFullYear()
          const match = currentMonths.find(item => item.monthIdx === m && item.year === y)
          if (match) {
            match.students++
          }
        })
      }

      // Arizalarni joriy oylar bo'yicha guruhlash
      if (arizalarData) {
        ;(arizalarData as ArizaStatRow[]).forEach((ariza) => {
          if (!ariza.created_at) return
          const date = new Date(ariza.created_at)
          const m = date.getMonth()
          const y = date.getFullYear()
          const match = currentMonths.find(item => item.monthIdx === m && item.year === y)
          if (match) {
            match.applications++
            const status = String(ariza.status).toLowerCase()
            if (status === 'approved' || status === 'tasdiqlangan') {
              match.approved++
            } else if (status === 'rejected' || status === 'rad etilgan') {
              match.rejected++
            }
          }
        })
      }

      setMonthlyData(currentMonths)

    } catch (error) {
      console.error('Statistika yuklashda xato:', error)
      setStats((prev) => ({ ...prev, loading: false }))
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  const handleRefreshStats = async () => {
    setIsRefreshing(true)
    await loadStats(true)
    setIsRefreshing(false)
    toast.success('Barcha statistika ma\'lumotlari yangilandi! 🔄')
  }

  const handleCheckStatus = async () => {
    setIsCheckingStatus(true)
    const dbStart = performance.now()
    let dbStatus: 'online' | 'offline' = 'offline'
    let dbPing = 0
    let apiStatus: 'online' | 'offline' = 'offline'
    let apiPing = 0

    try {
      await fetchAdminDashboard()
      dbStatus = 'online'
      dbPing = Math.round(performance.now() - dbStart)
    } catch {
      dbStatus = 'offline'
    }

    const apiStart = performance.now()
    try {
      const res = await fetch('/api/admin/users', { method: 'GET' })
      if (res.ok) {
        apiStatus = 'online'
        apiPing = Math.round(performance.now() - apiStart)
      }
    } catch {
      apiStatus = 'offline'
    }

    setSystemStatus({
      dbStatus,
      dbPing,
      apiStatus,
      apiPing,
      time: new Date().toLocaleTimeString('uz-UZ'),
    })
    setIsCheckingStatus(false)
    setStatusModalOpen(true)
  }

  // Real vaqt rejimida filtrlangan talabalar ro'yxati va ularning soni
  const filteredStudents = React.useMemo(() => {
    let filtered = allStudents
    
    // Jins bo'yicha filter (Erkak/Ayol va male/female variantlari uchun moslashuvchan)
    if (reportFilters.gender !== 'all') {
      if (reportFilters.gender === 'male') {
        filtered = filtered.filter(s => {
          const g = String(s.gender || '').toLowerCase()
          return g === 'male' || g === 'erkak'
        })
      } else if (reportFilters.gender === 'female') {
        filtered = filtered.filter(s => {
          const g = String(s.gender || '').toLowerCase()
          return g === 'female' || g === 'ayol'
        })
      }
    }

    // Millat bo'yicha filter
    if (reportFilters.nationality !== 'all') {
      filtered = filtered.filter(s => s.nationality === reportFilters.nationality)
    }

    // Qavat bo'yicha filter
    if (reportFilters.floor !== 'all') {
      const targetFloor = parseInt(reportFilters.floor)
      filtered = filtered.filter(s => floorOf(s.room_number) === targetFloor)
    }

    // Xona oralig'i bo'yicha filter (faqat qavat tanlangan bo'lsa)
    if (reportFilters.floor !== 'all') {
      const start = parseInt(reportFilters.roomStart)
      const end = parseInt(reportFilters.roomEnd)
      
      if (!Number.isNaN(start)) {
        filtered = filtered.filter(s => s.room_number && parseInt(s.room_number) >= start)
      }
      if (!Number.isNaN(end)) {
        filtered = filtered.filter(s => s.room_number && parseInt(s.room_number) <= end)
      }
    }

    return filtered
  }, [allStudents, reportFilters, floorOf])

  const handleExportExcel = async () => {
    if (filteredStudents.length === 0) {
      toast.error('Tanlangan filterlar bo\'yicha hech qanday talaba topilmadi')
      return
    }

    setExporting(true)
    try {
      // Xona raqami bo'yicha tabiiy saralash — shu bilan birga qavat
      // (xonadan hisoblanadi) ham o'sish tartibida guruhlanadi
      const sortedStudents = [...filteredStudents].sort((a, b) => {
        const roomA = a.room_number || ''
        const roomB = b.room_number || ''
        return roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' })
      })

      // "YYYY-MM-DD" ni "DD.MM.YYYY" ko'rinishiga o'tkazish
      const formatDate = (val?: string | null) => {
        if (!val) return '-'
        const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (!match) return val
        return `${match[3]}.${match[2]}.${match[1]}`
      }

      const headers = [
        '№',
        'Qavati',
        'Xona raqami',
        'F.I.Sh.',
        'Viloyati',
        'Tumani',
        'MFY',
        'Shartnoma raqami',
        'Pasport seriya raqami',
        'JSHSHIR',
        'Pasport berilgan vaqti',
        "Tug'ilgan kun, oy, yil",
        'Fakulteti',
        "Yo'nalish",
        'Kursi',
        'Millati',
        'Moliya turi',
        'Jinsi',
        'Telefon raqami',
        'Ijtimoiy holati',
        'Ish joyi',
        'Ish vaqti',
        'TTJga joylashgan oyi',
        "TTJdan chiqib ketgan sanasi",
        'Tyutor',
        'Telefon raqami',
        'Otasining ismi va familiyasi',
        'Ish joyi',
        'Telefon nomeri',
        'Onasining ismi va familiyasi',
        'Onasining ish joyi',
        'Telefon nomeri',
      ]

      // Har bir xonada 4 ta o'rin bor — talaba ma'lumotlaridan tashqari
      // qolgan ustunlarni to'ldiruvchi yordamchi funksiya
      const buildFields = (s: typeof sortedStudents[number]) => {
        const gender = s.gender === 'male' ? 'Erkak' : (s.gender === 'female' ? 'Ayol' : (s.gender || '-'))
        const phone = s.phone_number || s.phone || '-'
        return [
          s.full_name || '-',
          s.region || '-',
          s.district || '-',
          s.mahalla || '-',
          '-', // Shartnoma raqami — tizimda saqlanmaydi
          s.passport_series || '-',
          s.jshshir || '-',
          formatDate(s.passport_date),
          formatDate(s.birth_date),
          s.faculty || '-',
          s.direction || '-',
          String(s.course ?? '-'),
          s.nationality || '-',
          s.study_type || '-',
          gender,
          phone,
          '-', // Ijtimoiy holati — tizimda saqlanmaydi
          '-', // Ish joyi (talabaning o'zi) — tizimda saqlanmaydi
          '-', // Ish vaqti — tizimda saqlanmaydi
          formatDate(s.entry_date),
          '-', // TTJdan chiqib ketgan sanasi — tizimda saqlanmaydi
          '-', // Tyutor — tizimda saqlanmaydi
          '-', // Tyutor telefon raqami — tizimda saqlanmaydi
          s.father_full_name || '-',
          s.father_workplace || '-',
          s.father_phone || '-',
          s.mother_full_name || '-',
          s.mother_workplace || '-',
          s.mother_phone || '-',
        ]
      }
      const emptyFields = () => Array(29).fill('')
      const ROOM_CAPACITY = 4

      // Ketma-ket bir xil xonadagi talabalarni guruhlash
      type RoomGroup = { room: string | null; floor: number | null; students: typeof sortedStudents }
      const roomGroups: RoomGroup[] = []
      sortedStudents.forEach((s) => {
        const room = s.room_number || null
        const last = roomGroups[roomGroups.length - 1]
        if (room && last && last.room === room) {
          last.students.push(s)
        } else {
          roomGroups.push({ room, floor: floorOf(s.room_number), students: [s] })
        }
      })

      // Ma'lumotlarni shakllantirish — xona to'liq bo'lmasa ham qolgan
      // 4 tagacha o'rin bo'sh qator sifatida qoldiriladi
      const rawRows: string[][] = []
      let seq = 1
      roomGroups.forEach((group) => {
        const qavatValue = group.floor ? String(group.floor) : '-'
        const xonaValue = group.room ? `№-${group.room}` : '-'

        group.students.forEach((s) => {
          rawRows.push([String(seq), qavatValue, xonaValue, ...buildFields(s)])
          seq++
        })

        if (group.room) {
          const emptySlots = Math.max(0, ROOM_CAPACITY - group.students.length)
          for (let k = 0; k < emptySlots; k++) {
            rawRows.push(['', qavatValue, xonaValue, ...emptyFields()])
          }
        }
      })

      // Bir xil qavat va xonalarni guruhlash (vizual birlashtirish)
      const displayRows = JSON.parse(JSON.stringify(rawRows))
      const excelMerges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []

      const mergeColumn = (col: number) => {
        let i = 0
        while (i < displayRows.length) {
          const value = displayRows[i][col]
          if (value === '-' || !value) {
            i++
            continue
          }

          let j = i + 1
          while (j < displayRows.length && rawRows[j][col] === value) {
            displayRows[j][col] = ''
            j++
          }

          if (j - i > 1) {
            excelMerges.push({
              s: { r: i + 1, c: col },
              e: { r: j, c: col },
            })
          }
          i = j
        }
      }

      if (displayRows.length > 0) {
        mergeColumn(1) // Qavati
        mergeColumn(2) // Xona raqami
      }

      let fileName = 'Talabalar_Hisoboti'
      if (reportFilters.gender !== 'all') fileName += `_${reportFilters.gender === 'male' ? 'Erkak' : 'Ayol'}`
      if (reportFilters.nationality !== 'all') fileName += `_${reportFilters.nationality}`
      if (reportFilters.floor !== 'all') {
        fileName += `_${reportFilters.floor}-qavat`
        if (reportFilters.roomStart || reportFilters.roomEnd) {
          fileName += `_xona-${reportFilters.roomStart || 'boshlanishi'}-${reportFilters.roomEnd || 'oxiri'}`
        }
      }
      fileName += `_${new Date().toISOString().slice(0, 10)}.xlsx`

      downloadXlsx({
        filename: fileName,
        sheetName: 'Talabalar',
        headers,
        rows: displayRows,
        merges: excelMerges,
      })

      toast.success('Excel hisoboti muvaffaqiyatli yuklab olindi! 📊')

    } catch (err) {
      console.error('Export error:', err)
      toast.error('Hisobot yaratishda xato yuz berdi')
    } finally {
      setExporting(false)
    }
  }

  const statCards = [
    {
      title: 'Jami Talabalar',
      value: stats.totalStudents,
      imageSrc: '/3d-icons/student_3d_v4.png',
      color: 'from-blue-500 to-indigo-600',
      glowColor: 'rgba(59, 130, 246, 0.15)',
    },
    {
      title: 'Jami Arizalar',
      value: stats.totalRequests,
      imageSrc: '/3d-icons/document_3d_v4.png',
      color: 'from-purple-500 to-pink-600',
      glowColor: 'rgba(168, 85, 247, 0.15)',
    },
    {
      title: 'Tasdiqlangan',
      value: stats.approvedRequests,
      imageSrc: '/3d-icons/check_3d_v4.png',
      color: 'from-emerald-500 to-green-600',
      glowColor: 'rgba(16, 185, 129, 0.15)',
    },
    {
      title: 'Kutish Holati',
      value: stats.pendingRequests,
      imageSrc: '/3d-icons/clock_3d_v4.png',
      color: 'from-orange-500 to-amber-600',
      glowColor: 'rgba(245, 158, 11, 0.15)',
    },
    {
      title: 'Tarbiyachilar',
      value: stats.totalEducators,
      imageSrc: '/3d-icons/educator_3d_v4.png',
      color: 'from-cyan-500 to-blue-600',
      glowColor: 'rgba(6, 182, 212, 0.15)',
    },
    {
      title: 'Jami Foydalanuvchilar',
      value: stats.totalUsers,
      imageSrc: '/3d-icons/user_3d_v4.png',
      color: 'from-rose-500 to-red-600',
      glowColor: 'rgba(244, 63, 94, 0.15)',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className={`text-3xl sm:text-4xl font-black tracking-tight ${textStrong}`}>
            Dashboard <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">Analitika</span>
          </h1>
          <p className={`mt-2 text-sm sm:text-base ${textMuted}`}>
            Yotoqxona boshqaruv tizimining umumiy holati va tahlili
          </p>
        </div>
      </div>

      {/* Alert Banner for Waiting Payments */}
      {waitingPaymentsCount > 0 && (
        <div className={`p-4 rounded-3xl border backdrop-blur-xl transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isLight 
            ? 'bg-amber-50/50 border-amber-200 text-amber-900 shadow-lg shadow-amber-100/40' 
            : 'bg-amber-500/5 border-amber-500/20 text-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.05)]'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl shrink-0 ${
              isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/10 text-amber-400'
            }`}>
              <AlertTriangle className="animate-pulse" size={20} />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight">Kutilayotgan to&apos;lovlar bor! 💳</p>
              <p className={`text-xs mt-0.5 opacity-80`}>
                Talabalar tomonidan yuborilgan {waitingPaymentsCount} ta to&apos;lov kvitansiyasi tekshirilishi kutilmoqda.
              </p>
            </div>
          </div>
          <Link
            href="/admin/tolovlar"
            className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 text-center shrink-0 border ${
              isLight 
                ? 'bg-amber-600 border-amber-700 text-white hover:bg-amber-700' 
                : 'bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/25'
            }`}
          >
            Kvitansiyalarni ko&apos;rish &rarr;
          </Link>
        </div>
      )}

      {/* Pill Styled Glassmorphic Tabs */}
      <div className={`inline-flex max-w-full overflow-x-auto no-scrollbar flex-nowrap p-1 rounded-full gap-1 border backdrop-blur-xl transition-all ${
        isLight
          ? 'bg-slate-100/80 border-slate-200/80'
          : 'bg-[#0f172a]/60 border-white/5'
      }`}>
        {['overview', 'analytics', 'reports'].map((tab) => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={(e) => {
                setActiveTab(tab)
                e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
              }}
              className={`relative z-10 px-5 py-2.5 rounded-full text-xs sm:text-sm font-black transition-all duration-300 shrink-0 whitespace-nowrap ${
                isActive
                  ? isLight ? 'text-purple-700' : 'text-white'
                  : isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className={`absolute inset-0 rounded-full -z-10 shadow-sm border ${
                    isLight
                      ? 'bg-white border-slate-200'
                      : 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-purple-500/30 shadow-purple-500/10'
                  }`}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {tab === 'overview' && 'Umumiy ko\'rinish'}
              {tab === 'analytics' && 'Tahlil'}
              {tab === 'reports' && 'Hisobotlar'}
            </button>
          )
        })}
      </div>

      {/* Tab Contents */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-8"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {statCards.map((card, index) => (
                <StatCard
                  key={index}
                  title={card.title}
                  value={card.value}
                  imageSrc={card.imageSrc}
                  color={card.color}
                  glowColor={card.glowColor}
                  isLoading={stats.loading}
                />
              ))}
            </div>

            {/* Quick Actions section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`backdrop-blur-xl border rounded-3xl p-6 ${surfaceBg}`}
            >
              <h2 className={`text-xl font-black mb-6 ${textStrong}`}>Tezkor Amallar</h2>
              <StaggerList className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* 1. Ma'lumotlarni Yangilash */}
                <StaggerItem>
                <button
                  onClick={handleRefreshStats}
                  disabled={isRefreshing}
                  className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-300 ${
                    isRefreshing ? 'opacity-70 cursor-not-allowed' : ''
                  } ${
                    isLight
                      ? 'bg-slate-50/50 border-slate-200/80 hover:bg-white hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/5'
                      : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-blue-500/30 hover:shadow-[0_0_35px_rgba(59,130,246,0.08)]'
                  }`}
                >
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                    isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {isRefreshing ? <Loader className="animate-spin" size={20} /> : <RefreshCw size={20} className="transition-transform duration-500 group-hover:rotate-180" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-black ${textStrong}`}>Ma&apos;lumotlarni yangilash</p>
                    <p className={`truncate text-xs mt-0.5 ${textMuted}`}>Barcha statistikalarni qayta yuklash</p>
                  </div>
                  <ArrowRight size={16} className={`shrink-0 transition-transform duration-300 group-hover:translate-x-1 ${textMuted}`} />
                </button>
                </StaggerItem>

                {/* 2. Tizim holati */}
                <StaggerItem>
                <button
                  onClick={handleCheckStatus}
                  disabled={isCheckingStatus}
                  className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-300 ${
                    isCheckingStatus ? 'opacity-70 cursor-not-allowed' : ''
                  } ${
                    isLight
                      ? 'bg-slate-50/50 border-slate-200/80 hover:bg-white hover:border-purple-300 hover:shadow-lg hover:shadow-purple-500/5'
                      : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_0_35px_rgba(168,85,247,0.08)]'
                  }`}
                >
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                    isLight ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/10 text-purple-400'
                  }`}>
                    {isCheckingStatus ? <Loader className="animate-spin" size={20} /> : <ServerCog size={20} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-black ${textStrong}`}>Tizim holati</p>
                    <p className={`truncate text-xs mt-0.5 ${textMuted}`}>Server va bazaning holatini tekshirish</p>
                  </div>
                  <ArrowRight size={16} className={`shrink-0 transition-transform duration-300 group-hover:translate-x-1 ${textMuted}`} />
                </button>
                </StaggerItem>

              </StaggerList>
            </motion.div>
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Area Chart block */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`backdrop-blur-xl border rounded-3xl p-4 sm:p-6 ${surfaceBg}`}
            >
              <h3 className={`text-lg font-black mb-6 ${textStrong}`}>Oylik Statistika</h3>
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={monthlyData} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)"} />
                  <XAxis dataKey="month" stroke={isLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)"} style={{ fontSize: '11px', fontWeight: '600' }} padding={{ left: 12, right: 12 }} />
                  <YAxis stroke={isLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)"} style={{ fontSize: '11px', fontWeight: '600' }} width={44} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(15, 23, 42, 0.85)',
                      border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '16px',
                      backdropFilter: 'blur(12px)',
                      color: isLight ? '#0f172a' : '#ffffff',
                      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Area type="monotone" dataKey="students" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorStudents)" name="Talabalar" />
                  <Area type="monotone" dataKey="applications" stroke="#a855f7" strokeWidth={3} fillOpacity={1} fill="url(#colorApplications)" name="Arizalar" />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Bottom charts grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`backdrop-blur-xl border rounded-3xl p-4 sm:p-6 ${surfaceBg}`}
              >
                <h3 className={`text-lg font-black mb-6 ${textStrong}`}>Qabul va Rad etishlar</h3>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={monthlyData} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barApproved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#047857" stopOpacity={0.6}/>
                      </linearGradient>
                      <linearGradient id="barRejected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#b91c1c" stopOpacity={0.6}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)"} />
                    <XAxis dataKey="month" stroke={isLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)"} style={{ fontSize: '11px', fontWeight: '600' }} padding={{ left: 12, right: 12 }} />
                    <YAxis stroke={isLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)"} style={{ fontSize: '11px', fontWeight: '600' }} width={44} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(15, 23, 42, 0.85)',
                        border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '16px',
                        backdropFilter: 'blur(12px)',
                        color: isLight ? '#0f172a' : '#ffffff',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                      }}
                    />
                    <Bar dataKey="approved" fill="url(#barApproved)" radius={[6, 6, 0, 0]} name="Tasdiqlangan" />
                    <Bar dataKey="rejected" fill="url(#barRejected)" radius={[6, 6, 0, 0]} name="Rad etilgan" />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Pie/Donut Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`backdrop-blur-xl border rounded-3xl p-4 sm:p-6 ${surfaceBg}`}
              >
                <h3 className={`text-lg font-black mb-6 ${textStrong}`}>Ariza Holatlari</h3>
                <div className="relative flex items-center justify-center h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={applicationStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={75}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {applicationStatusData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color} 
                            stroke={isLight ? '#ffffff' : '#0f172a'}
                            strokeWidth={2}
                            style={{
                              filter: `drop-shadow(0 8px 12px ${entry.color}25)`
                            }}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(15, 23, 42, 0.85)',
                          border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '16px',
                          backdropFilter: 'blur(12px)',
                          color: isLight ? '#0f172a' : '#ffffff',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Centered Stats Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className={`text-3xl font-black ${textStrong}`}>
                      {stats.totalRequests}
                    </p>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted} mt-1`}>
                      Jami Arizalar
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {activeTab === 'reports' && (
          <motion.div
            key="reports"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className={`backdrop-blur-xl border rounded-3xl p-6 ${surfaceBg}`}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h3 className={`text-lg font-black ${textStrong}`}>Excel Hisobotlarni Generatsiya Qilish</h3>
                <p className={`text-xs mt-1 ${textMuted}`}>Talabalar ma&apos;lumotlarini turli filtrlar asosida filtrlash va Excel (xlsx) formatida yuklab olish</p>
              </div>
            </div>

            {/* Filter Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
              {/* 1. Jinsi */}
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>
                  Jinsi bo&apos;yicha
                </label>
                <CustomSelect
                  value={reportFilters.gender}
                  onChange={(val) => setReportFilters(prev => ({ ...prev, gender: val }))}
                  options={[
                    { value: 'all', label: 'Barcha jinslar' },
                    { value: 'male', label: "Faqat o'g'il bolalar (Erkak)" },
                    { value: 'female', label: 'Faqat qiz bolalar (Ayol)' },
                  ]}
                  className={`px-4 py-3 rounded-xl border text-sm ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-800'
                      : 'bg-[#0f172a]/80 border-white/5 text-white'
                  }`}
                />
              </div>

              {/* 2. Millati */}
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>
                  Millati bo&apos;yicha
                </label>
                <CustomSelect
                  value={reportFilters.nationality}
                  onChange={(val) => setReportFilters(prev => ({ ...prev, nationality: val }))}
                  options={[
                    { value: 'all', label: 'Barcha millatlar' },
                    { value: "O'zbek", label: "O'zbek" },
                    { value: 'Tojik', label: 'Tojik' },
                    { value: 'Qozoq', label: 'Qozoq' },
                    { value: "Qirg'iz", label: "Qirg'iz" },
                    { value: 'Turkman', label: 'Turkman' },
                    { value: 'Rus', label: 'Rus' },
                    { value: 'Qoraqalpoq', label: 'Qoraqalpoq' },
                    { value: 'Boshqa', label: 'Boshqa' },
                  ]}
                  className={`px-4 py-3 rounded-xl border text-sm ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-800'
                      : 'bg-[#0f172a]/80 border-white/5 text-white'
                  }`}
                />
              </div>

              {/* 3. Qavati */}
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>
                  Qavati bo&apos;yicha
                </label>
                <CustomSelect
                  value={reportFilters.floor}
                  onChange={(val) => setReportFilters(prev => ({ ...prev, floor: val }))}
                  options={[
                    { value: 'all', label: 'Barcha qavatlar' },
                    ...floorOptions.map((floor) => ({
                      value: String(floor),
                      label: `${floor}-qavat`,
                    })),
                  ]}
                  className={`px-4 py-3 rounded-xl border text-sm ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-800'
                      : 'bg-[#0f172a]/80 border-white/5 text-white'
                  }`}
                />
              </div>
            </div>

            {/* Room Ranges (Conditional display based on Floor selection) */}
            <AnimatePresence>
              {reportFilters.floor !== 'all' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mb-6"
                >
                  <div className={`p-5 rounded-2xl border ${
                    isLight ? 'bg-slate-50/50 border-slate-200/80' : 'bg-white/5 border-white/5'
                  }`}>
                    <h4 className={`text-xs font-black uppercase tracking-wider mb-4 ${textStrong}`}>
                      Xonalar oralig&apos;ini tanlang ({reportFilters.floor}-qavat)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>
                          Xonadan (Boshlanishi)
                        </label>
                        <input
                          type="number"
                          value={reportFilters.roomStart}
                          onChange={(e) => setReportFilters(prev => ({ ...prev, roomStart: e.target.value }))}
                          placeholder={selectedFloorRoomRange ? String(selectedFloorRoomRange.start) : ""}
                          className={`w-full px-4 py-3 rounded-xl border outline-none text-sm transition-all ${
                            isLight 
                              ? 'bg-white border-slate-200 text-slate-800 focus:border-purple-500' 
                              : 'bg-white/5 border-white/10 text-white focus:bg-[#0f172a] focus:border-purple-500'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>
                          Xonagacha (Yakunlanishi)
                        </label>
                        <input
                          type="number"
                          value={reportFilters.roomEnd}
                          onChange={(e) => setReportFilters(prev => ({ ...prev, roomEnd: e.target.value }))}
                          placeholder={selectedFloorRoomRange ? String(selectedFloorRoomRange.end) : ""}
                          className={`w-full px-4 py-3 rounded-xl border outline-none text-sm transition-all ${
                            isLight 
                              ? 'bg-white border-slate-200 text-slate-800 focus:border-purple-500' 
                              : 'bg-white/5 border-white/10 text-white focus:bg-[#0f172a] focus:border-purple-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Filtered Students Count Premium Card */}
            <div className={`p-5 rounded-3xl border backdrop-blur-xl transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 mb-6 ${
              filteredStudents.length > 0
                ? isLight
                  ? 'bg-purple-50/50 border-purple-200/80 shadow-lg shadow-purple-100/40 text-purple-900'
                  : 'bg-purple-500/5 border-purple-500/20 text-purple-200 shadow-[0_0_30px_rgba(168,85,247,0.05)]'
                : isLight
                  ? 'bg-amber-50/50 border-amber-200 text-amber-900 shadow-lg shadow-amber-100/40'
                  : 'bg-amber-500/5 border-amber-500/20 text-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.05)]'
            }`}>
              <div className="relative w-16 h-16 shrink-0 transition-transform duration-500 hover:scale-110 hover:rotate-6">
                <Image
                  src="https://img.icons8.com/3d-fluency/94/conference-call.png"
                  alt="Talabalar soni"
                  fill
                  unoptimized
                  className="object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="text-3xl font-black tracking-tight flex items-baseline gap-1.5">
                  {filteredStudents.length}
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">ta talaba</span>
                </p>
                <p className={`text-xs mt-1 ${textMuted}`}>
                  {filteredStudents.length > 0
                    ? 'Tanlangan filtrlarga mos keluvchi yuklab olinadigan talabalar soni'
                    : 'Filtrlarga mos talabalar topilmadi. Iltimos, boshqa filtrlarni tanlang.'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-end">
              <button
                onClick={() => setReportFilters({ gender: 'all', nationality: 'all', floor: 'all', roomStart: '', roomEnd: '' })}
                className={`px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 border ${
                  isLight 
                    ? 'border-slate-200 hover:bg-slate-100 text-slate-700' 
                    : 'border-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                Filtrlarni Tozalash
              </button>

              <button
                onClick={handleExportExcel}
                disabled={exporting}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs font-black uppercase tracking-wider transition-all duration-300 active:scale-95 flex items-center justify-center gap-2"
              >
                {exporting ? (
                  <>
                    <Loader className="animate-spin" size={16} />
                    Tayyorlanmoqda...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    Excel (xlsx) Yuklash
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* System Status Modal */}
      <AnimatePresence>
        {statusModalOpen && systemStatus && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setStatusModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative z-10 w-full max-w-md overflow-hidden rounded-3xl border p-6 shadow-2xl backdrop-blur-xl ${
                isLight ? 'bg-white text-slate-800 border-slate-200' : 'bg-[#0f172a]/95 text-white border-white/10'
              }`}
            >
              <button
                onClick={() => setStatusModalOpen(false)}
                className={`absolute right-4 top-4 p-2 rounded-xl border transition-colors ${
                  isLight ? 'hover:bg-slate-100 border-slate-200' : 'hover:bg-white/10 border-white/5'
                }`}
              >
                <X size={16} />
              </button>

              <div className="flex flex-col items-center text-center mt-2 mb-6">
                <div className="relative w-24 h-24 mb-4 animate-pulse">
                  <Image src="https://img.icons8.com/3d-fluency/94/server.png" alt="Server 3D" fill unoptimized className="object-contain" />
                </div>
                <h3 className="text-xl font-black tracking-tight">Tizim Ishlash Holati</h3>
                <p className={`text-xs mt-1 ${textMuted}`}>Oxirgi tekshiruv: {systemStatus.time}</p>
              </div>

              <div className="space-y-4">
                <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${
                      systemStatus.dbStatus === 'online' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      <Activity size={18} className={systemStatus.dbStatus === 'online' ? 'animate-pulse' : ''} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Supabase Database</p>
                      <p className={`text-xs ${textMuted}`}>Ma&apos;lumotlar ombori ulanishi</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      systemStatus.dbStatus === 'online' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {systemStatus.dbStatus === 'online' ? 'Faol' : 'Oflayn'}
                    </span>
                    {systemStatus.dbStatus === 'online' && (
                      <p className="text-xs font-bold text-emerald-400/80 mt-1">{systemStatus.dbPing > 0 ? `${systemStatus.dbPing} ms` : '<1 ms'}</p>
                    )}
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                      <Cpu size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Server API Gateway</p>
                      <p className={`text-xs ${textMuted}`}>Next.js Route Handlers</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      systemStatus.apiStatus === 'online' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {systemStatus.apiStatus === 'online' ? 'Faol' : 'Kutilmoqda'}
                    </span>
                    {systemStatus.apiStatus === 'online' && (
                      <p className="text-xs font-bold text-purple-400/80 mt-1">{systemStatus.apiPing > 0 ? `${systemStatus.apiPing} ms` : '<1 ms'}</p>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStatusModalOpen(false)}
                className="w-full mt-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-black text-sm transition-all duration-300 active:scale-95"
              >
                Yopish
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
