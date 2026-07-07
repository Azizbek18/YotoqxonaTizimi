'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
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
import { AlertTriangle, Loader, Copy, X, Activity, Cpu } from 'lucide-react'
import StatCard from '@/components/admin/StatCard'
import { useThemeStore } from '@/lib/stores/theme-store'
import toast from 'react-hot-toast'

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

  // Taklif yaratish holatlari
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [generatedInviteCode, setGeneratedInviteCode] = useState('')
  const [creatingInvite, setCreatingInvite] = useState(false)

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

  const loadStats = async (silent = false) => {
    if (!silent) {
      setStats((prev) => ({ ...prev, loading: true }))
    }
    try {
      const { count: studentCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'talaba')

      const { count: educatorCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'tarbiyachi')

      const { count: requestCount } = await supabase
        .from('arizalar')
        .select('*', { count: 'exact', head: true })

      const { count: approvedCount } = await supabase
        .from('arizalar')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')

      const { count: pendingCount } = await supabase
        .from('arizalar')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      const { count: rejectedCount } = await supabase
        .from('arizalar')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'rejected')

      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      const { count: waitingCount } = await supabase
        .from('tolovlar')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'waiting')

      setWaitingPaymentsCount(waitingCount || 0)

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
      const { data: studentsData, error: studentsError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'talaba')

      if (!studentsError && studentsData) {
        setAllStudents(studentsData)
      }

      // Arizalar ma'lumotlarini olish
      const { data: arizalarData, error: arizalarError } = await supabase
        .from('arizalar')
        .select('created_at, status')

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
      if (!arizalarError && arizalarData) {
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
      const { error } = await supabase
        .from('users')
        .select('id')
        .limit(1)
      
      if (!error) {
        dbStatus = 'online'
        dbPing = Math.round(performance.now() - dbStart)
      }
    } catch {
      dbStatus = 'offline'
    }

    const apiStart = performance.now()
    try {
      const res = await fetch('/api/admin/invites', { method: 'GET' })
      if (res.ok) {
        apiStatus = 'online'
        apiPing = Math.round(performance.now() - apiStart)
      }
    } catch {
      apiStatus = 'offline'
    }

    setSystemStatus({
      dbStatus,
      dbPing: dbPing || Math.round(Math.random() * 30 + 10),
      apiStatus,
      apiPing: apiPing || Math.round(Math.random() * 40 + 15),
      time: new Date().toLocaleTimeString('uz-UZ'),
    })
    setIsCheckingStatus(false)
    setStatusModalOpen(true)
  }

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalizedEmail = inviteEmail.trim().toLowerCase()

    if (!normalizedEmail) {
      toast.error('Email manzilini kiriting')
      return
    }

    setCreatingInvite(true)
    try {
      const response = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail }),
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Taklif kodi yaratilmadi')
      }

      setGeneratedInviteCode(result.inviteCode)
      setInviteEmail('')
      toast.success('Taklif kodi muvaffaqiyatli yaratildi! 🎉')
      await loadStats(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Xatolik yuz berdi')
    } finally {
      setCreatingInvite(false)
    }
  }

  const handleCopyLink = () => {
    if (!generatedInviteCode) return
    const inviteLink = `${window.location.origin}/register?code=${generatedInviteCode}`
    navigator.clipboard.writeText(inviteLink)
    toast.success('Taklif havolasi buferga nusxalandi! 📋')
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
      filtered = filtered.filter(s => {
        if (!s.room_number) return false
        const roomInt = parseInt(s.room_number)
        if (Number.isNaN(roomInt)) return false
        const floorOfRoom = Math.floor((roomInt - 1) / 30) + 1
        return floorOfRoom === targetFloor
      })
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
  }, [allStudents, reportFilters])

  const handleExportExcel = async () => {
    if (filteredStudents.length === 0) {
      toast.error('Tanlangan filterlar bo\'yicha hech qanday talaba topilmadi')
      return
    }

    setExporting(true)
    try {
      const excelData = filteredStudents.map((s, idx) => ({
        'T/r': idx + 1,
        'F.I.Sh.': s.full_name || '-',
        'Sharifi': s.middle_name || '-',
        'Jinsi': s.gender === 'male' ? 'Erkak' : (s.gender === 'female' ? 'Ayol' : '-'),
        'Millati': s.nationality || '-',
        'Telefon': s.phone_number || s.phone || '-',
        'Fakultet': s.faculty || '-',
        'Yo\'nalish': s.direction || '-',
        'Kurs': s.course || '-',
        'Xona': s.room_number || '-',
        'Viloyat': s.region || '-',
        'Tuman': s.district || '-',
        'Mahalla': s.mahalla || '-',
        'Ta\'lim turi': s.study_type || '-',
        'Kirgan sana': s.entry_date || '-'
      }))

      const worksheet = XLSX.utils.json_to_sheet(excelData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Talabalar')

      const max_widths = Object.keys(excelData[0] || {}).map(key => {
        return Math.max(
          key.length,
          ...excelData.map(row => String(row[key as keyof typeof row] || '').length)
        ) + 3
      })
      worksheet['!cols'] = max_widths.map(w => ({ wch: w }))

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

      XLSX.writeFile(workbook, fileName)
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
      trend: 12,
      trendLabel: 'bu oyda',
    },
    {
      title: 'Jami Arizalar',
      value: stats.totalRequests,
      imageSrc: '/3d-icons/document_3d_v4.png',
      color: 'from-purple-500 to-pink-600',
      glowColor: 'rgba(168, 85, 247, 0.15)',
      trend: 8,
      trendLabel: 'bu oyda',
    },
    {
      title: 'Tasdiqlangan',
      value: stats.approvedRequests,
      imageSrc: '/3d-icons/check_3d_v4.png',
      color: 'from-emerald-500 to-green-600',
      glowColor: 'rgba(16, 185, 129, 0.15)',
      trend: 15,
      trendLabel: 'bu oyda',
    },
    {
      title: 'Kutish Holati',
      value: stats.pendingRequests,
      imageSrc: '/3d-icons/clock_3d_v4.png',
      color: 'from-orange-500 to-amber-600',
      glowColor: 'rgba(245, 158, 11, 0.15)',
      trend: -5,
      trendLabel: 'bu oyda',
    },
    {
      title: 'Tarbiyachilar',
      value: stats.totalEducators,
      imageSrc: '/3d-icons/educator_3d_v4.png',
      color: 'from-cyan-500 to-blue-600',
      glowColor: 'rgba(6, 182, 212, 0.15)',
      trend: 3,
      trendLabel: 'bu oyda',
    },
    {
      title: 'Jami Foydalanuvchilar',
      value: stats.totalUsers,
      imageSrc: '/3d-icons/user_3d_v4.png',
      color: 'from-rose-500 to-red-600',
      glowColor: 'rgba(244, 63, 94, 0.15)',
      trend: 10,
      trendLabel: 'bu oyda',
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
      <div className={`inline-flex max-w-full overflow-x-auto no-scrollbar flex-nowrap p-1 rounded-2xl gap-1 border backdrop-blur-xl transition-all ${
        isLight 
          ? 'bg-slate-100/80 border-slate-200/80' 
          : 'bg-[#0f172a]/60 border-white/5'
      }`}>
        {['overview', 'analytics', 'reports'].map((tab) => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative z-10 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-300 shrink-0 whitespace-nowrap ${
                isActive
                  ? isLight ? 'text-purple-700' : 'text-white'
                  : isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className={`absolute inset-0 rounded-xl -z-10 shadow-sm border ${
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
                  trend={card.trend}
                  trendLabel={card.trendLabel}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                
                {/* 1. Ma'lumotlarni Yangilash */}
                <button 
                  onClick={handleRefreshStats}
                  disabled={isRefreshing}
                  className={`relative overflow-hidden p-4 sm:p-5 text-left transition-all duration-300 group border rounded-2xl backdrop-blur-xl flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 ${
                    isRefreshing ? 'opacity-80 cursor-not-allowed' : ''
                  } ${
                    isLight 
                      ? 'bg-slate-50/50 border-slate-200/80 hover:bg-white hover:border-purple-300 hover:shadow-lg hover:shadow-purple-500/5' 
                      : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_0_35px_rgba(168,85,247,0.08)]'
                  }`}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-500 to-indigo-500" />
                  <div className="pl-2 flex-1">
                    <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${textMuted} group-hover:text-purple-500 flex items-center gap-1.5`}>
                      {isRefreshing && <Loader className="animate-spin" size={12} />}
                      Ma&apos;lumotlarni Yangilash
                    </p>
                    <p className={`text-sm sm:text-base md:text-lg font-black mt-1.5 transition-transform duration-300 group-hover:translate-x-1 ${textStrong}`}>
                      Barcha Statistikalarni Yangilash &rarr;
                    </p>
                  </div>
                  <div className="relative w-12 h-12 sm:w-14 sm:h-14 self-end sm:self-auto shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12">
                    <Image
                      src="https://img.icons8.com/3d-fluency/94/synchronize.png"
                      alt="Yangilash"
                      fill
                      unoptimized
                      className="object-contain"
                    />
                  </div>
                </button>

                {/* 2. Tizim holati */}
                <button 
                  onClick={handleCheckStatus}
                  disabled={isCheckingStatus}
                  className={`relative overflow-hidden p-4 sm:p-5 text-left transition-all duration-300 group border rounded-2xl backdrop-blur-xl flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 ${
                    isCheckingStatus ? 'opacity-80 cursor-not-allowed' : ''
                  } ${
                    isLight 
                      ? 'bg-slate-50/50 border-slate-200/80 hover:bg-white hover:border-purple-300 hover:shadow-lg hover:shadow-purple-500/5' 
                      : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_0_35px_rgba(168,85,247,0.08)]'
                  }`}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-purple-500 to-pink-500" />
                  <div className="pl-2 flex-1">
                    <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${textMuted} group-hover:text-purple-500 flex items-center gap-1.5`}>
                      {isCheckingStatus && <Loader className="animate-spin" size={12} />}
                      Tizim holati
                    </p>
                    <p className={`text-sm sm:text-base md:text-lg font-black mt-1.5 transition-transform duration-300 group-hover:translate-x-1 ${textStrong}`}>
                      Server Holatini Tekshirish &rarr;
                    </p>
                  </div>
                  <div className="relative w-12 h-12 sm:w-14 sm:h-14 self-end sm:self-auto shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12">
                    <Image
                      src="https://img.icons8.com/3d-fluency/94/server.png"
                      alt="Server holati"
                      fill
                      unoptimized
                      className="object-contain"
                    />
                  </div>
                </button>

                {/* 3. Yangi Talaba */}
                <button 
                  onClick={() => setInviteModalOpen(true)}
                  className={`relative overflow-hidden p-4 sm:p-5 text-left transition-all duration-300 group border rounded-2xl backdrop-blur-xl flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 ${
                    isLight 
                      ? 'bg-slate-50/50 border-slate-200/80 hover:bg-white hover:border-purple-300 hover:shadow-lg hover:shadow-purple-500/5' 
                      : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_0_35px_rgba(168,85,247,0.08)]'
                  }`}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-500 to-green-500" />
                  <div className="pl-2 flex-1">
                    <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${textMuted} group-hover:text-purple-500`}>
                      Yangi Talaba
                    </p>
                    <p className={`text-sm sm:text-base md:text-lg font-black mt-1.5 transition-transform duration-300 group-hover:translate-x-1 ${textStrong}`}>
                      Foydalanuvchi Qo&apos;shish &rarr;
                    </p>
                  </div>
                  <div className="relative w-12 h-12 sm:w-14 sm:h-14 self-end sm:self-auto shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12">
                    <Image
                      src="https://img.icons8.com/3d-fluency/94/student-male.png"
                      alt="Talaba"
                      fill
                      unoptimized
                      className="object-contain"
                    />
                  </div>
                </button>

              </div>
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
              className={`backdrop-blur-xl border rounded-3xl p-6 ${surfaceBg}`}
            >
              <h3 className={`text-lg font-black mb-6 ${textStrong}`}>Oylik Statistika</h3>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={monthlyData}>
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
                  <XAxis dataKey="month" stroke={isLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)"} style={{ fontSize: '11px', fontWeight: '600' }} />
                  <YAxis stroke={isLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)"} style={{ fontSize: '11px', fontWeight: '600' }} />
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
                className={`backdrop-blur-xl border rounded-3xl p-6 ${surfaceBg}`}
              >
                <h3 className={`text-lg font-black mb-6 ${textStrong}`}>Qabul va Rad etishlar</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={monthlyData}>
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
                    <XAxis dataKey="month" stroke={isLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)"} style={{ fontSize: '11px', fontWeight: '600' }} />
                    <YAxis stroke={isLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)"} style={{ fontSize: '11px', fontWeight: '600' }} />
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
                className={`backdrop-blur-xl border rounded-3xl p-6 ${surfaceBg}`}
              >
                <h3 className={`text-lg font-black mb-6 ${textStrong}`}>Ariza Holatlari</h3>
                <div className="relative flex items-center justify-center h-[320px]">
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
                <select
                  value={reportFilters.gender}
                  onChange={(e) => setReportFilters(prev => ({ ...prev, gender: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-xl border outline-none text-sm transition-all ${
                    isLight 
                      ? 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-purple-500' 
                      : 'bg-[#0f172a]/80 border-white/5 text-white focus:bg-[#0f172a] focus:border-purple-500'
                  }`}
                >
                  <option value="all" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>Barcha jinslar</option>
                  <option value="male" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>Faqat o&apos;g&apos;il bolalar (Erkak)</option>
                  <option value="female" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>Faqat qiz bolalar (Ayol)</option>
                </select>
              </div>

              {/* 2. Millati */}
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>
                  Millati bo&apos;yicha
                </label>
                <select
                  value={reportFilters.nationality}
                  onChange={(e) => setReportFilters(prev => ({ ...prev, nationality: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-xl border outline-none text-sm transition-all ${
                    isLight 
                      ? 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-purple-500' 
                      : 'bg-[#0f172a]/80 border-white/5 text-white focus:bg-[#0f172a] focus:border-purple-500'
                  }`}
                >
                  <option value="all" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>Barcha millatlar</option>
                  <option value="O'zbek" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>O&apos;zbek</option>
                  <option value="Tojik" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>Tojik</option>
                  <option value="Qozoq" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>Qozoq</option>
                  <option value="Qirg'iz" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>Qirg&apos;iz</option>
                  <option value="Turkman" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>Turkman</option>
                  <option value="Rus" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>Rus</option>
                  <option value="Qoraqalpoq" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>Qoraqalpoq</option>
                  <option value="Boshqa" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>Boshqa</option>
                </select>
              </div>

              {/* 3. Qavati */}
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>
                  Qavati bo&apos;yicha
                </label>
                <select
                  value={reportFilters.floor}
                  onChange={(e) => setReportFilters(prev => ({ ...prev, floor: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-xl border outline-none text-sm transition-all ${
                    isLight 
                      ? 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-purple-500' 
                      : 'bg-[#0f172a]/80 border-white/5 text-white focus:bg-[#0f172a] focus:border-purple-500'
                  }`}
                >
                  <option value="all" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>Barcha qavatlar</option>
                  <option value="1" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>1-qavat</option>
                  <option value="2" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>2-qavat</option>
                  <option value="3" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>3-qavat</option>
                  <option value="4" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>4-qavat</option>
                  <option value="5" className={isLight ? 'text-slate-800' : 'bg-slate-900 text-white'}>5-qavat</option>
                </select>
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
                          placeholder={String((parseInt(reportFilters.floor) - 1) * 30 + 1)}
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
                          placeholder={String(parseInt(reportFilters.floor) * 30)}
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
            <div className={`p-5 rounded-3xl border backdrop-blur-xl transition-all duration-300 flex items-center gap-5 mb-6 ${
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
              <div>
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
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-lg shadow-purple-500/20 active:scale-95 flex items-center justify-center gap-2"
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
                      <p className="text-xs font-bold text-emerald-400/80 mt-1">{systemStatus.dbPing} ms</p>
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
                      <p className="text-xs font-bold text-purple-400/80 mt-1">{systemStatus.apiPing} ms</p>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStatusModalOpen(false)}
                className="w-full mt-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-black text-sm transition-all duration-300 shadow-lg shadow-purple-500/20 active:scale-95"
              >
                Yopish
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invite Student Modal */}
      <AnimatePresence>
        {inviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setInviteModalOpen(false)
                setGeneratedInviteCode('')
              }}
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
                onClick={() => {
                  setInviteModalOpen(false)
                  setGeneratedInviteCode('')
                }}
                className={`absolute right-4 top-4 p-2 rounded-xl border transition-colors ${
                  isLight ? 'hover:bg-slate-100 border-slate-200' : 'hover:bg-white/10 border-white/5'
                }`}
              >
                <X size={16} />
              </button>

              <div className="flex flex-col items-center text-center mt-2 mb-6">
                <div className="relative w-24 h-24 mb-4">
                  <Image src="https://img.icons8.com/3d-fluency/94/student-male.png" alt="Student 3D" fill unoptimized className="object-contain" />
                </div>
                <h3 className="text-xl font-black tracking-tight">Yangi Talaba Taklif Yaratish</h3>
                <p className={`text-xs mt-1 ${textMuted}`}>
                  Talabani ro&apos;yxatdan o&apos;tkazish uchun uning emailiga taklif kodi va havola yarating.
                </p>
              </div>

              {!generatedInviteCode ? (
                <form onSubmit={handleCreateInvite} className="space-y-4">
                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${textMuted}`}>
                      Talaba Emaili
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="student@example.com"
                      required
                      className={`w-full px-4 py-3 rounded-xl border outline-none text-sm transition-all ${
                        isLight 
                          ? 'bg-slate-50 border-slate-200 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10' 
                          : 'bg-white/5 border-white/10 focus:bg-[#0f172a] focus:border-purple-500 focus:ring-2 focus:ring-purple-500/15'
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={creatingInvite}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-black text-sm transition-all duration-300 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                  >
                    {creatingInvite ? (
                      <>
                        <Loader className="animate-spin" size={16} />
                        Yaratilmoqda...
                      </>
                    ) : (
                      'Taklif Kodini Yaratish'
                    )}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className={`p-4 rounded-2xl border text-center ${
                    isLight ? 'bg-emerald-50/50 border-emerald-100' : 'bg-emerald-500/5 border-emerald-500/20'
                  }`}>
                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1">Taklif kodi yaratildi!</p>
                    <p className={`text-xs ${textMuted} mb-3`}>Quyidagi havola orqali ro&apos;yxatdan o&apos;tishi mumkin:</p>
                    
                    <div className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-mono select-all ${
                      isLight ? 'bg-white border-slate-200' : 'bg-black/25 border-white/5'
                    }`}>
                      <span className="truncate flex-1 text-left">
                        {`${window.location.origin}/register?code=${generatedInviteCode}`}
                      </span>
                      <button
                        onClick={handleCopyLink}
                        className={`p-1.5 rounded-lg border transition-all shrink-0 ${
                          isLight ? 'hover:bg-slate-100 border-slate-200' : 'hover:bg-white/10 border-white/5'
                        }`}
                        title="Havolani nusxalash"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setInviteModalOpen(false)
                      setGeneratedInviteCode('')
                    }}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-black text-sm transition-all duration-300 shadow-lg shadow-purple-500/20"
                  >
                    Tayyor
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
