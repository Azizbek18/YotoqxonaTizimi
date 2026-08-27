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

  // Capacity calculations
  const totalBedsCapacity = 600 // 150 rooms * 4 beds
  const freeBeds = Math.max(0, totalBedsCapacity - stats.totalOccupiedBeds)
  const occupancyRate = totalBedsCapacity > 0 ? Math.round((stats.totalOccupiedBeds / totalBedsCapacity) * 100) : 0

  const occupancyPieData = [
    { name: 'Band joylar', value: stats.totalOccupiedBeds, color: dekanChart.primary },
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
      title: 'Joylashtirilganlar',
      value: stats.totalOccupiedBeds,
      icon: Home,
      description: `${occupancyRate}% bandlik darajasi`,
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${ui.strong}`}>
            Umumiy hisobot
          </h1>
          <p className={`text-xs sm:text-sm mt-1 ${ui.muted}`}>
            {dekanFaculty
              ? `${dekanFaculty.toUpperCase()} fakulteti bo'yicha yo'llanmalar va joylashtirish holati`
              : "Talabalar oqimi, yo'llanmalar va xonalar taqsimoti"}
          </p>
        </div>
        <button
          onClick={() => loadData(dekanFaculty)}
          className={`shrink-0 inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${ui.btnGhost}`}
        >
          <RefreshCw size={14} /> Yangilash
        </button>
      </div>

      {facultyResolved && !dekanFaculty && (
        <div className={`flex items-start gap-2 rounded-xl border p-4 text-xs font-medium ${
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04, duration: 0.2 }}
            className={`group rounded-xl border p-5 transition-colors ${ui.card} hover:border-indigo-400/50`}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${ui.muted}`}>{card.title}</p>
                <h3 className={`text-2xl sm:text-3xl font-bold mt-2 leading-none ${ui.strong}`}>{card.value}</h3>
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ui.accentSoft}`}>
                <card.icon size={20} strokeWidth={2.1} />
              </div>
            </div>
            <p className={`text-[10px] font-medium mt-4 ${ui.faint}`}>{card.description}</p>
            <Link
              href={card.link}
              className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${ui.accentText} opacity-0 group-hover:opacity-100 transition-opacity`}
            >
              Ko&apos;rish <ArrowRight size={10} />
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Occupancy pie */}
        <div className={`rounded-xl border p-5 lg:col-span-1 flex flex-col justify-between ${ui.card}`}>
          <div>
            <h3 className={`text-sm font-bold ${ui.strong}`}>Yotoqxona bandligi</h3>
            <p className={`text-[10px] font-medium mt-0.5 ${ui.muted}`}>Jami o‘rinlar sig‘imi: {totalBedsCapacity} ta</p>
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
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {occupancyPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={dekanChart.tooltip(isLight)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${ui.strong}`}>{occupancyRate}%</span>
              <span className={`text-[8px] font-semibold uppercase tracking-wider ${ui.muted}`}>Band</span>
            </div>
          </div>
          <div className="space-y-2 mt-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-indigo-600" />
                <span className={ui.muted}>Joylashtirilgan talabalar</span>
              </div>
              <span className={ui.strong}>{stats.totalOccupiedBeds} ta</span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-sm ${isLight ? 'bg-slate-200' : 'bg-slate-700'}`} />
                <span className={ui.muted}>Bo&apos;sh o&apos;rinlar</span>
              </div>
              <span className={ui.strong}>{freeBeds} ta</span>
            </div>
          </div>
        </div>

        {/* Course bar chart */}
        <div className={`rounded-xl border p-5 lg:col-span-2 flex flex-col justify-between ${ui.card}`}>
          <div>
            <h3 className={`text-sm font-bold ${ui.strong}`}>Kurslar kesimida</h3>
            <p className={`text-[10px] font-medium mt-0.5 ${ui.muted}`}>Talabalar kurslar bo‘yicha taqsimoti</p>
          </div>
          <div className="h-60 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={courseDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={dekanChart.grid(isLight)} />
                <XAxis dataKey="course" stroke={dekanChart.axis(isLight)} fontSize={11} tickLine={false} />
                <YAxis stroke={dekanChart.axis(isLight)} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: isLight ? 'rgba(79,70,229,0.05)' : 'rgba(79,70,229,0.12)' }} contentStyle={dekanChart.tooltip(isLight)} />
                <Bar dataKey="talabalar" fill={dekanChart.primary} radius={[6, 6, 0, 0]} maxBarSize={40} />
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
        <div className={`rounded-xl border p-5 lg:col-span-2 flex flex-col justify-between ${ui.card}`}>
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
                  <div className={`p-3 rounded-full mb-2 ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-slate-800 text-slate-500'}`}>
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
              className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${ui.btnGhost}`}
            >
              Arizalar ro&apos;yxatiga o&apos;tish <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Faculty distribution */}
        <div className={`rounded-xl border p-5 lg:col-span-1 flex flex-col justify-between ${ui.card}`}>
          <div>
            <h3 className={`text-sm font-bold ${ui.strong}`}>Fakultetlar bo‘yicha</h3>
            <p className={`text-[10px] font-medium mt-0.5 ${ui.muted}`}>Joylashtirilgan talabalar soni</p>

            <div className="mt-4 space-y-3">
              {facultyDistribution.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className={`p-3 rounded-full mb-2 ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-slate-800 text-slate-500'}`}>
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
                        <div className="h-full rounded-full bg-indigo-600" style={{ width: `${percent}%` }} />
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
