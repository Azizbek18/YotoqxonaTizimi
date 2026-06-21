'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import Link from 'next/link'
import {
  FileText,
  Users,
  CheckCircle,
  AlertCircle,
  Home,
  ArrowRight,
  TrendingUp,
  GraduationCap,
  Calendar,
  Layers
} from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'

interface DashboardStats {
  pendingCount: number
  approvedCount: number
  rejectedCount: number
  registeredCount: number
  activeStudentsCount: number
  totalOccupiedBeds: number
  loading: boolean
}

interface RecentRequest {
  id: string
  full_name: string
  passport_series: string
  jshshir: string
  faculty: string
  direction: string
  course: number
  created_at: string
}

export default function ZamdekanDashboard() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const surfaceBg = isLight
    ? 'bg-white/80 border-slate-200 shadow-lg shadow-slate-100/40'
    : 'bg-[#0f172a]/30 border-white/5 shadow-2xl'
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'

  const [stats, setStats] = useState<DashboardStats>({
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    registeredCount: 0,
    activeStudentsCount: 0,
    totalOccupiedBeds: 0,
    loading: true,
  })

  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([])
  const [courseDistribution, setCourseDistribution] = useState<any[]>([])
  const [facultyDistribution, setFacultyDistribution] = useState<any[]>([])

  const loadData = async () => {
    try {
      // 1. Get permit_requests counts
      const { data: permits, error: permitsError } = await supabase
        .from('permit_requests')
        .select('status, room_number, course, faculty')

      if (permitsError) throw permitsError

      let pending = 0
      let approved = 0
      let rejected = 0
      let registered = 0

      const coursesMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
      const facultiesMap: Record<string, number> = {}

      permits?.forEach((p) => {
        if (p.status === 'pending') pending++
        else if (p.status === 'approved') approved++
        else if (p.status === 'rejected') rejected++
        else if (p.status === 'registered') registered++

        // Aggregate course & faculty details (for approved or registered students)
        if (p.status === 'approved' || p.status === 'registered') {
          if (p.course && coursesMap[p.course] !== undefined) {
            coursesMap[p.course]++
          }
          if (p.faculty) {
            facultiesMap[p.faculty] = (facultiesMap[p.faculty] || 0) + 1
          }
        }
      })

      // 2. Get registered students
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('room_number, course, faculty')
        .eq('role', 'talaba')

      if (usersError) throw usersError

      // Aggregate course & faculty for registered users who might not have permit records
      // (Older system flow students)
      users?.forEach((u) => {
        if (u.room_number) {
          if (u.course && coursesMap[u.course] !== undefined) {
            coursesMap[u.course]++
          }
          if (u.faculty) {
            facultiesMap[u.faculty] = (facultiesMap[u.faculty] || 0) + 1
          }
        }
      })

      // Calculate total occupied beds:
      // - Active students in users table with assigned room
      const activeBedsInUsers = users?.filter((u) => u.room_number).length || 0
      // - Approved but not yet registered permits
      const activeBedsInPermits = permits?.filter((p) => p.status === 'approved' && p.room_number).length || 0
      const totalOccupiedBeds = activeBedsInUsers + activeBedsInPermits

      // 3. Get recent pending requests
      const { data: recent, error: recentError } = await supabase
        .from('permit_requests')
        .select('id, full_name, passport_series, jshshir, faculty, direction, course, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentError) throw recentError

      // Format distributions for Recharts
      const courseChartData = Object.keys(coursesMap).map((key) => ({
        course: `${key}-kurs`,
        talabalar: coursesMap[Number(key)],
      }))

      const facultyChartData = Object.keys(facultiesMap).map((key) => ({
        name: key,
        talabalar: facultiesMap[key],
      }))

      setCourseDistribution(courseChartData)
      setFacultyDistribution(facultyChartData)
      setRecentRequests(recent || [])
      setStats({
        pendingCount: pending,
        approvedCount: approved,
        rejectedCount: rejected,
        registeredCount: registered,
        activeStudentsCount: users?.length || 0,
        totalOccupiedBeds,
        loading: false,
      })
    } catch (err) {
      console.error('Error fetching dashboard statistics:', err)
      setStats((prev) => ({ ...prev, loading: false }))
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  // Capacity calculations
  const totalBedsCapacity = 600 // 150 rooms * 4 beds
  const freeBeds = Math.max(0, totalBedsCapacity - stats.totalOccupiedBeds)
  const occupancyRate = totalBedsCapacity > 0 ? Math.round((stats.totalOccupiedBeds / totalBedsCapacity) * 100) : 0

  const occupancyPieData = [
    { name: "Band joylar", value: stats.totalOccupiedBeds, color: '#6366f1' },
    { name: "Bo'sh joylar", value: freeBeds, color: isLight ? '#e2e8f0' : '#1e293b' },
  ]

  const statCards = [
    {
      title: 'Kutilayotgan arizalar',
      value: stats.pendingCount,
      icon: FileText,
      color: 'from-amber-500 to-orange-500',
      description: "Ko'rib chiqilishi kerak bo'lgan yo'llanmalar",
      link: '/zamdekan/arizalar',
    },
    {
      title: 'Faol talabalar',
      value: stats.activeStudentsCount,
      icon: Users,
      color: 'from-sky-500 to-blue-600',
      description: "Tizimda ro'yxatdan o'tganlar",
      link: '/zamdekan/xonalar',
    },
    {
      title: 'Joylashtirilganlar',
      value: stats.totalOccupiedBeds,
      icon: Home,
      color: 'from-indigo-500 to-purple-600',
      description: `${occupancyRate}% bandlik darajasi`,
      link: '/zamdekan/xonalar',
    },
    {
      title: 'Tasdiqlangan yo‘llanmalar',
      value: stats.approvedCount + stats.registeredCount,
      icon: CheckCircle,
      color: 'from-emerald-500 to-teal-600',
      description: 'Tasdiqlangan jami arizalar',
      link: '/zamdekan/arizalar',
    }
  ]

  if (stats.loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className={`animate-spin rounded-full h-8 w-8 border-t-2 ${isLight ? 'border-sky-600' : 'border-cyan-500'}`} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-3xl border ${surfaceBg} p-6 sm:p-8`}
      >
        <div className={`absolute inset-0 opacity-10 ${isLight ? 'bg-gradient-to-br from-sky-400 via-blue-500 to-transparent' : 'bg-gradient-to-br from-indigo-500 via-blue-600 to-transparent'}`} />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center justify-center p-1.5 rounded-lg text-xs font-black ${isLight ? 'bg-sky-100 text-sky-700' : 'bg-white/10 text-cyan-300'}`}>
                <TrendingUp size={14} className="mr-1" />
                Live Statlar
              </span>
            </div>
            <h1 className={`text-2xl sm:text-3xl font-black mt-2 tracking-tight ${textStrong}`}>
              Xush kelibsiz, Zamdekan!
            </h1>
            <p className={`text-xs sm:text-sm mt-1 max-w-xl ${textMuted}`}>
              Yotoqxona tizimidagi talabalar oqimi, yo&apos;llanmalar (arizalar) ko&apos;rib chiqilishi va xonalar taqsimotini real vaqt rejimida boshqaring.
            </p>
          </div>
          <button
            onClick={loadData}
            className={`shrink-0 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border shadow-sm ${
              isLight
                ? 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
                : 'bg-white/5 border-white/15 text-white hover:bg-white/10'
            }`}
          >
            Ma&apos;lumotlarni yangilash
          </button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`rounded-3xl border ${surfaceBg} p-5 relative overflow-hidden group hover:scale-[1.02] transition-all`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-wider ${textMuted}`}>{card.title}</p>
                <h3 className={`text-2xl sm:text-3xl font-black mt-1 leading-none ${textStrong}`}>{card.value}</h3>
              </div>
              <div className={`h-11 w-11 rounded-2xl bg-gradient-to-tr ${card.color} flex items-center justify-center text-white shadow-md shadow-indigo-500/10`}>
                <card.icon size={20} strokeWidth={2.2} />
              </div>
            </div>
            <p className={`text-[10px] font-medium mt-4 ${textMuted}`}>{card.description}</p>
            <Link
              href={card.link}
              className={`absolute bottom-3 right-4 opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-indigo-500 transition-opacity`}
            >
              Ko'rish <ArrowRight size={10} />
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Occupied Capacity Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl border ${surfaceBg} p-5 lg:col-span-1 flex flex-col justify-between`}
        >
          <div>
            <h3 className={`text-sm font-black uppercase tracking-wider ${textStrong}`}>Yotoqxona Bandligi</h3>
            <p className={`text-[10px] font-medium ${textMuted}`}>Jami o‘rinlar sig‘imi: {totalBedsCapacity} ta</p>
          </div>
          <div className="h-56 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={occupancyPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {occupancyPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: isLight ? '#ffffff' : '#0f172a',
                    borderColor: isLight ? '#e2e8f0' : '#334155',
                    color: isLight ? '#0f172a' : '#ffffff',
                    fontSize: '11px',
                    borderRadius: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center">
              <span className={`text-2xl font-black ${textStrong}`}>{occupancyRate}%</span>
              <span className={`text-[8px] font-black uppercase tracking-wider ${textMuted}`}>Band</span>
            </div>
          </div>
          <div className="space-y-2 mt-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-indigo-500" />
                <span className={textMuted}>Joylashtirilgan talabalar</span>
              </div>
              <span className={textStrong}>{stats.totalOccupiedBeds} ta</span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
                <span className={textMuted}>Bo'sh o'rinlar</span>
              </div>
              <span className={textStrong}>{freeBeds} ta</span>
            </div>
          </div>
        </motion.div>

        {/* Courses Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl border ${surfaceBg} p-5 lg:col-span-2 flex flex-col justify-between`}
        >
          <div>
            <h3 className={`text-sm font-black uppercase tracking-wider ${textStrong}`}>Kurslar kesimida</h3>
            <p className={`text-[10px] font-medium ${textMuted}`}>Talabalar kurslar bo‘yicha taqsimoti</p>
          </div>
          <div className="h-60 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={courseDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isLight ? '#f1f5f9' : '#1e293b'} />
                <XAxis
                  dataKey="course"
                  stroke={isLight ? '#64748b' : '#94a3b8'}
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke={isLight ? '#64748b' : '#94a3b8'}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                  contentStyle={{
                    background: isLight ? '#ffffff' : '#0f172a',
                    borderColor: isLight ? '#e2e8f0' : '#334155',
                    color: isLight ? '#0f172a' : '#ffffff',
                    fontSize: '11px',
                    borderRadius: '12px'
                  }}
                />
                <Bar dataKey="talabalar" fill="#6366f1" radius={[8, 8, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-end mt-2 text-[10px] font-black uppercase tracking-widest text-indigo-500">
            <Link href="/zamdekan/xonalar" className="flex items-center gap-1">
              Barcha talabalarni ko'rish <ArrowRight size={10} />
            </Link>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Pending Permit Requests */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl border ${surfaceBg} p-5 lg:col-span-2 flex flex-col justify-between`}
        >
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-sm font-black uppercase tracking-wider ${textStrong}`}>Oxirgi arizalar</h3>
                <p className={`text-[10px] font-medium ${textMuted}`}>Kutish holatidagi yangi yo‘llanmalar</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase">
                {stats.pendingCount} ta ariza kutilmoqda
              </span>
            </div>

            <div className="mt-4 divide-y divide-slate-100 dark:divide-white/5 space-y-1">
              {recentRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="p-3 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-600 mb-2">
                    <CheckCircle size={24} />
                  </div>
                  <p className="text-xs font-bold text-slate-500">Kutilayotgan yangi yo‘llanma arizalari mavjud emas</p>
                </div>
              ) : (
                recentRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <h4 className={`text-xs font-bold truncate ${textStrong}`}>{req.full_name}</h4>
                      <p className={`text-[9px] mt-0.5 truncate ${textMuted}`}>
                        {req.faculty} • {req.direction} • {req.course}-kurs
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`hidden sm:inline text-[9px] font-bold px-2 py-0.5 rounded-md ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/5 text-slate-400'}`}>
                        {new Date(req.created_at).toLocaleDateString('uz-UZ')}
                      </span>
                      <Link
                        href={`/zamdekan/arizalar?id=${req.id}`}
                        className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500 text-indigo-500 hover:text-white transition-all"
                      >
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Link
              href="/zamdekan/arizalar"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 transition-all"
            >
              Arizalar ro'yxatiga o'tish <ArrowRight size={12} />
            </Link>
          </div>
        </motion.div>

        {/* Faculties occupancy distribution list */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl border ${surfaceBg} p-5 lg:col-span-1 flex flex-col justify-between`}
        >
          <div>
            <h3 className={`text-sm font-black uppercase tracking-wider ${textStrong}`}>Fakultetlar bo‘yicha</h3>
            <p className={`text-[10px] font-medium ${textMuted}`}>Joylashtirilgan talabalar soni</p>

            <div className="mt-4 space-y-3">
              {facultyDistribution.length === 0 ? (
                <div className="text-center py-8 text-xs font-bold text-slate-500">Ma'lumotlar mavjud emas</div>
              ) : (
                facultyDistribution.map((fac, idx) => {
                  const percent = stats.totalOccupiedBeds > 0
                    ? Math.round((fac.talabalar / stats.totalOccupiedBeds) * 100)
                    : 0
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className={`truncate max-w-[70%] ${textStrong}`}>{fac.name}</span>
                        <span className={textMuted}>{fac.talabalar} ta ({percent}%)</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] font-bold text-slate-500">
            <span className="flex items-center gap-1"><Layers size={12} /> Jami Fakultetlar:</span>
            <span>{facultyDistribution.length} ta</span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
