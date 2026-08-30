'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
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
  ResponsiveContainer
} from 'recharts'
import Link from 'next/link'
import {
  FileText,
  Users,
  CheckCircle,
  Home,
  ArrowRight,
  Layers,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useDekanScope } from '@/lib/hooks/useDekanScope'
import { fetchDekanOverview } from '@/features/permits/client/admin-api'
import { permitFacultyLabel } from '@/lib/faculties'
import { directionLabel } from '@/lib/directions'
import { dekanUI, dekanChart, statusChip } from '@/lib/dekan-ui'

interface DashboardStats {
  pendingCount: number
  approvedCount: number
  rejectedCount: number
  registeredCount: number
  activeStudentsCount: number
  totalOccupiedBeds: number
  availableBeds: number
  freeBeds: number
  frozenRoomCount: number
  loading: boolean
}

interface RecentRequest {
  id: string
  full_name: string
  passport_series: string
  jshshir: string | null
  faculty: string
  direction: string
  course: number
  created_at: string
}

export default function DekanDashboard() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const ui = dekanUI(isLight)

  const [stats, setStats] = useState<DashboardStats>({
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    registeredCount: 0,
    activeStudentsCount: 0,
    totalOccupiedBeds: 0,
    availableBeds: 0,
    freeBeds: 0,
    frozenRoomCount: 0,
    loading: true,
  })

  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([])
  const [courseDistribution, setCourseDistribution] = useState<{ course: string; talabalar: number }[]>([])
  const [facultyDistribution, setFacultyDistribution] = useState<{ name: string; talabalar: number }[]>([])
  const { faculty: dekanFaculty, resolved: facultyResolved } = useDekanScope()

  const loadData = async (faculty: string | null) => {
    try {
      if (!faculty) throw new Error('Fakultet biriktirilmagan')
      const { dashboard } = await fetchDekanOverview()
      setCourseDistribution(dashboard.courseDistribution)
      setFacultyDistribution(dashboard.facultyDistribution)
      setRecentRequests(dashboard.recentRequests)
      setStats({
        pendingCount: dashboard.pendingCount,
        approvedCount: dashboard.approvedCount,
        rejectedCount: dashboard.rejectedCount,
        registeredCount: dashboard.registeredCount,
        activeStudentsCount: dashboard.activeStudentsCount,
        totalOccupiedBeds: dashboard.totalOccupiedBeds,
        availableBeds: dashboard.availableBeds,
        freeBeds: dashboard.freeBeds,
        frozenRoomCount: dashboard.frozenRoomCount,
        loading: false,
      })
    } catch (err) {
      console.error('Error fetching dashboard statistics:', err)
      setStats((prev) => ({ ...prev, loading: false }))
    }
  }

  useEffect(() => {
    if (!facultyResolved) return
    loadData(dekanFaculty)
    const interval = setInterval(() => loadData(dekanFaculty), 30000)
    return () => clearInterval(interval)
  }, [facultyResolved, dekanFaculty])

  // Real capacity for this dekan's scope: their own floors, per-room
  // capacity overrides, frozen (ta'mirlash) rooms excluded.
  const totalBedsCapacity = stats.availableBeds
  const freeBeds = stats.freeBeds
  const occupiedInAvailable = Math.max(0, totalBedsCapacity - freeBeds)
  const occupancyRate = totalBedsCapacity > 0 ? Math.round((occupiedInAvailable / totalBedsCapacity) * 100) : 0

  const occupancyPieData = [
    { name: 'Band joylar', value: occupiedInAvailable, color: dekanChart.primary },
    { name: "Bo'sh joylar", value: freeBeds, color: dekanChart.track(isLight) },
  ]

  const statCards = [
    {
      title: 'Kutilayotgan arizalar',
      value: stats.pendingCount,
      icon: FileText,
      description: "Ko'rib chiqilishi kerak bo'lgan yo'llanmalar",
      link: '/dekan/arizalar',
    },
    {
      title: 'Faol talabalar',
      value: stats.activeStudentsCount,
      icon: Users,
      description: "Tizimda ro'yxatdan o'tganlar",
      link: '/dekan/xonalar',
    },
    {
      title: 'Bo‘sh o‘rinlar',
      value: stats.freeBeds,
      icon: Home,
      description: `${occupancyRate}% bandlik · ${occupiedInAvailable}/${totalBedsCapacity} band${stats.frozenRoomCount > 0 ? ` · ${stats.frozenRoomCount} muzlatilgan` : ''}`,
      link: '/dekan/xonalar',
    },
    {
      title: 'Tasdiqlangan yo‘llanmalar',
      value: stats.approvedCount + stats.registeredCount,
      icon: CheckCircle,
      description: 'Tasdiqlangan jami arizalar',
      link: '/dekan/arizalar',
    },
  ]

  if (stats.loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700" />
      </div>
    )
  }

  const pending = statusChip('warning', isLight)

  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(255,255,255,0.12),transparent_45%)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-sm">
              Umumiy hisobot
            </span>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {dekanFaculty ? `${dekanFaculty.toUpperCase()} fakulteti` : 'Yotoqxona boshqaruvi'}
            </h1>
            <p className="mt-1.5 max-w-xl text-xs sm:text-sm leading-relaxed text-indigo-100">
              Yo&apos;llanmalar ko&apos;rib chiqilishi, talabalar oqimi va xonalar taqsimotini shu yerdan boshqaring.
            </p>
          </div>
          <button
            onClick={() => loadData(dekanFaculty)}
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white/95 px-4 py-2.5 text-xs font-bold text-indigo-700 shadow-lg shadow-black/10 transition-transform hover:bg-white active:scale-95"
          >
            <RefreshCw size={14} /> Yangilash
          </button>
        </div>
      </motion.div>

      {facultyResolved && !dekanFaculty && (
        <div className={`flex items-start gap-2 rounded-2xl border p-4 text-xs font-medium ${
          isLight ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-amber-500/25 bg-amber-500/10 text-amber-200'
        }`}>
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            Hisobingizga fakultet biriktirilmagan, shuning uchun sizga tegishli yo&apos;llanmalar soni ko&apos;rsatilmayapti. Administratorga murojaat qiling.
          </span>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.25 }}
          >
            <Link
              href={card.link}
              className={`group relative block overflow-hidden rounded-2xl border p-5 ${ui.card} ${ui.hoverLift}`}
            >
              <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${ui.muted}`}>{card.title}</p>
                  <h3 className={`mt-2 text-3xl font-bold leading-none tracking-tight ${ui.strong}`}>{card.value}</h3>
                </div>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ui.accentTile}`}>
                  <card.icon size={20} strokeWidth={2.2} />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className={`text-[10px] font-medium ${ui.faint}`}>{card.description}</p>
                <ArrowRight size={13} className={`shrink-0 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 ${ui.accentText}`} />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Occupancy pie */}
        <div className={`rounded-2xl border p-5 lg:col-span-1 flex flex-col justify-between ${ui.card}`}>
          <div>
            <h3 className={`text-sm font-bold ${ui.strong}`}>Yotoqxona bandligi</h3>
            <p className={`text-[10px] font-medium mt-0.5 ${ui.muted}`}>
              Foydalanish mumkin: {totalBedsCapacity} o‘rin
              {stats.frozenRoomCount > 0 ? ` · ${stats.frozenRoomCount} ta xona muzlatilgan` : ''}
            </p>
          </div>
          <div className="h-56 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <linearGradient id="dekanPieFill" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={dekanChart.gradientFrom} />
                    <stop offset="100%" stopColor={dekanChart.gradientTo} />
                  </linearGradient>
                </defs>
                <Pie
                  data={occupancyPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={82}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {occupancyPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? 'url(#dekanPieFill)' : entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={dekanChart.tooltip(isLight)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold tracking-tight ${ui.strong}`}>{occupancyRate}%</span>
              <span className={`text-[8px] font-semibold uppercase tracking-wider ${ui.muted}`}>Band</span>
            </div>
          </div>
          <div className="space-y-2 mt-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-br from-indigo-500 to-violet-600" />
                <span className={ui.muted}>Band o&apos;rinlar</span>
              </div>
              <span className={ui.strong}>{occupiedInAvailable} ta</span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-sm ${isLight ? 'bg-slate-200' : 'bg-slate-700'}`} />
                <span className={ui.muted}>Bo&apos;sh o&apos;rinlar</span>
              </div>
              <span className={`font-bold ${freeBeds > 0 ? ui.accentText : ui.strong}`}>{freeBeds} ta</span>
            </div>
          </div>
        </div>

        {/* Course bar chart */}
        <div className={`rounded-2xl border p-5 lg:col-span-2 flex flex-col justify-between ${ui.card}`}>
          <div>
            <h3 className={`text-sm font-bold ${ui.strong}`}>Kurslar kesimida</h3>
            <p className={`text-[10px] font-medium mt-0.5 ${ui.muted}`}>Talabalar kurslar bo‘yicha taqsimoti</p>
          </div>
          <div className="h-60 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={courseDistribution}>
                <defs>
                  <linearGradient id="dekanBarFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={dekanChart.gradientFrom} />
                    <stop offset="100%" stopColor={dekanChart.gradientTo} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={dekanChart.grid(isLight)} />
                <XAxis dataKey="course" stroke={dekanChart.axis(isLight)} fontSize={11} tickLine={false} />
                <YAxis stroke={dekanChart.axis(isLight)} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: isLight ? 'rgba(79,70,229,0.06)' : 'rgba(79,70,229,0.12)' }} contentStyle={dekanChart.tooltip(isLight)} />
                <Bar dataKey="talabalar" fill="url(#dekanBarFill)" radius={[8, 8, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-end mt-2">
            <Link href="/dekan/xonalar" className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${ui.accentText}`}>
              Barcha talabalarni ko&apos;rish <ArrowRight size={10} />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent pending */}
        <div className={`rounded-2xl border p-5 lg:col-span-2 flex flex-col justify-between ${ui.card}`}>
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className={`text-sm font-bold ${ui.strong}`}>Oxirgi arizalar</h3>
                <p className={`text-[10px] font-medium mt-0.5 ${ui.muted}`}>Kutish holatidagi yangi yo‘llanmalar</p>
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${pending.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${pending.dot}`} />
                {stats.pendingCount} ta kutilmoqda
              </span>
            </div>

            <div className={`mt-4 divide-y ${ui.divide}`}>
              {recentRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className={`p-3 rounded-full mb-2 ${ui.accentTileSoft}`}>
                    <CheckCircle size={22} />
                  </div>
                  <p className={`text-xs font-medium ${ui.muted}`}>Kutilayotgan yangi yo‘llanma arizalari mavjud emas</p>
                </div>
              ) : (
                recentRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <h4 className={`text-xs font-semibold truncate ${ui.strong}`}>{req.full_name}</h4>
                      <p className={`text-[10px] mt-0.5 truncate ${ui.muted}`}>
                        {permitFacultyLabel(req.faculty)} • {directionLabel(req.direction)} • {req.course}-kurs
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`hidden sm:inline text-[9px] font-medium px-2 py-0.5 rounded ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'}`}>
                        {new Date(req.created_at).toLocaleDateString('uz-UZ')}
                      </span>
                      <Link
                        href={`/dekan/arizalar?id=${req.id}`}
                        className={`rounded-lg p-1.5 transition-colors ${ui.accentSoft}`}
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
              href="/dekan/arizalar"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[10px] font-bold uppercase tracking-wider ${ui.btnGhost}`}
            >
              Arizalar ro&apos;yxatiga o&apos;tish <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Faculty distribution */}
        <div className={`rounded-2xl border p-5 lg:col-span-1 flex flex-col justify-between ${ui.card}`}>
          <div>
            <h3 className={`text-sm font-bold ${ui.strong}`}>Fakultetlar bo‘yicha</h3>
            <p className={`text-[10px] font-medium mt-0.5 ${ui.muted}`}>Joylashtirilgan talabalar soni</p>

            <div className="mt-4 space-y-3">
              {facultyDistribution.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className={`p-3 rounded-full mb-2 ${ui.accentTileSoft}`}>
                    <Layers size={20} />
                  </div>
                  <p className={`text-xs font-medium ${ui.muted}`}>Ma&apos;lumotlar mavjud emas</p>
                </div>
              ) : (
                facultyDistribution.map((fac, idx) => {
                  const percent = stats.totalOccupiedBeds > 0
                    ? Math.round((fac.talabalar / stats.totalOccupiedBeds) * 100)
                    : 0
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className={`truncate max-w-[70%] ${ui.strong}`}>{permitFacultyLabel(fac.name)}</span>
                        <span className={ui.muted}>{fac.talabalar} ta ({percent}%)</span>
                      </div>
                      <div className={`h-1.5 w-full rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`}>
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-600" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
          <div className={`mt-4 pt-4 border-t flex items-center justify-between text-[10px] font-semibold ${ui.border} ${ui.muted}`}>
            <span className="flex items-center gap-1"><Layers size={12} /> Jami fakultetlar:</span>
            <span>{facultyDistribution.length} ta</span>
          </div>
        </div>
      </div>
    </div>
  )
}
