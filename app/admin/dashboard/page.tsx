'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
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
import StatCard from '@/components/admin/StatCard'
import { useThemeStore } from '@/lib/stores/theme-store'

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

const mockMonthlyData = [
  { month: 'Yanvar', students: 45, applications: 24 },
  { month: 'Fevral', students: 52, applications: 28 },
  { month: 'Mart', students: 48, applications: 32 },
  { month: 'Aprel', students: 61, applications: 35 },
  { month: 'May', students: 55, applications: 38 },
  { month: 'Iyun', students: 67, applications: 42 },
]

export default function AdminDashboard() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

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

  useEffect(() => {
    async function loadStats() {
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

      } catch (error) {
        console.error('Statistika yuklashda xato:', error)
        setStats((prev) => ({ ...prev, loading: false }))
      }
    }

    loadStats()
  }, [])

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

      {/* Pill Styled Glassmorphic Tabs */}
      <div className={`inline-flex p-1 rounded-2xl gap-1 border backdrop-blur-xl transition-all ${
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
              className={`relative z-10 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-300 ${
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
                
                <button className={`relative overflow-hidden p-6 text-left transition-all duration-300 group border rounded-2xl backdrop-blur-xl ${
                  isLight 
                    ? 'bg-slate-50/50 border-slate-200/80 hover:bg-white hover:border-purple-300 hover:shadow-lg hover:shadow-purple-500/5' 
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_0_35px_rgba(168,85,247,0.08)]'
                }`}>
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-500 to-indigo-500" />
                  <div className="pl-2">
                    <p className={`text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${textMuted} group-hover:text-purple-500`}>
                      Ma&apos;lumotlarni Yangilash
                    </p>
                    <p className={`text-base sm:text-lg font-black mt-2 transition-transform duration-300 group-hover:translate-x-1 ${textStrong}`}>
                      Barcha Statistikalarni Yangilash &rarr;
                    </p>
                  </div>
                </button>

                <button className={`relative overflow-hidden p-6 text-left transition-all duration-300 group border rounded-2xl backdrop-blur-xl ${
                  isLight 
                    ? 'bg-slate-50/50 border-slate-200/80 hover:bg-white hover:border-purple-300 hover:shadow-lg hover:shadow-purple-500/5' 
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_0_35px_rgba(168,85,247,0.08)]'
                }`}>
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-purple-500 to-pink-500" />
                  <div className="pl-2">
                    <p className={`text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${textMuted} group-hover:text-purple-500`}>
                      Tizim holati
                    </p>
                    <p className={`text-base sm:text-lg font-black mt-2 transition-transform duration-300 group-hover:translate-x-1 ${textStrong}`}>
                      Server Holatini Tekshirish &rarr;
                    </p>
                  </div>
                </button>

                <button className={`relative overflow-hidden p-6 text-left transition-all duration-300 group border rounded-2xl backdrop-blur-xl ${
                  isLight 
                    ? 'bg-slate-50/50 border-slate-200/80 hover:bg-white hover:border-purple-300 hover:shadow-lg hover:shadow-purple-500/5' 
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_0_35px_rgba(168,85,247,0.08)]'
                }`}>
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-500 to-green-500" />
                  <div className="pl-2">
                    <p className={`text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${textMuted} group-hover:text-purple-500`}>
                      Yangi Talaba
                    </p>
                    <p className={`text-base sm:text-lg font-black mt-2 transition-transform duration-300 group-hover:translate-x-1 ${textStrong}`}>
                      Foydalanuvchi Qo&apos;shish &rarr;
                    </p>
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
                <AreaChart data={mockMonthlyData}>
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
                  <BarChart data={mockMonthlyData}>
                    <defs>
                      <linearGradient id="barStudents" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.6}/>
                      </linearGradient>
                      <linearGradient id="barApplications" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#7e22ce" stopOpacity={0.6}/>
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
                    <Bar dataKey="students" fill="url(#barStudents)" radius={[6, 6, 0, 0]} name="Talabalar" />
                    <Bar dataKey="applications" fill="url(#barApplications)" radius={[6, 6, 0, 0]} name="Arizalar" />
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
            <h3 className={`text-lg font-black mb-6 ${textStrong}`}>Hisobotlar</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              
              <button className={`relative overflow-hidden p-6 text-left transition-all duration-300 group border rounded-2xl backdrop-blur-xl ${
                isLight 
                  ? 'bg-slate-50/50 border-slate-200/80 hover:bg-white hover:border-purple-300 hover:shadow-lg hover:shadow-purple-500/5' 
                  : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_0_35px_rgba(168,85,247,0.08)]'
              }`}>
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-500 to-indigo-500" />
                <div className="pl-2">
                  <p className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>Talabalar hisoboti</p>
                  <p className={`text-base font-black mt-2 transition-transform duration-300 group-hover:translate-x-1 ${textStrong}`}>
                    PDF sifatida Eksport &rarr;
                  </p>
                </div>
              </button>

              <button className={`relative overflow-hidden p-6 text-left transition-all duration-300 group border rounded-2xl backdrop-blur-xl ${
                isLight 
                  ? 'bg-slate-50/50 border-slate-200/80 hover:bg-white hover:border-purple-300 hover:shadow-lg hover:shadow-purple-500/5' 
                  : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_0_35px_rgba(168,85,247,0.08)]'
              }`}>
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-purple-500 to-pink-500" />
                <div className="pl-2">
                  <p className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>Arizalar hisoboti</p>
                  <p className={`text-base font-black mt-2 transition-transform duration-300 group-hover:translate-x-1 ${textStrong}`}>
                    Excel sifatida Eksport &rarr;
                  </p>
                </div>
              </button>

              <button className={`relative overflow-hidden p-6 text-left transition-all duration-300 group border rounded-2xl backdrop-blur-xl ${
                isLight 
                  ? 'bg-slate-50/50 border-slate-200/80 hover:bg-white hover:border-purple-300 hover:shadow-lg hover:shadow-purple-500/5' 
                  : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_0_35px_rgba(168,85,247,0.08)]'
              }`}>
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-500 to-green-500" />
                <div className="pl-2">
                  <p className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>Tizim statistikasi</p>
                  <p className={`text-base font-black mt-2 transition-transform duration-300 group-hover:translate-x-1 ${textStrong}`}>
                    CSV sifatida Eksport &rarr;
                  </p>
                </div>
              </button>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
