'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, FileText, Activity, Clock, CheckCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
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
      icon: Users,
      color: 'from-blue-500 to-indigo-600',
      trend: 12,
      trendLabel: 'bu oyda',
    },
    {
      title: 'Jami Arizalar',
      value: stats.totalRequests,
      icon: FileText,
      color: 'from-purple-500 to-pink-600',
      trend: 8,
      trendLabel: 'bu oyda',
    },
    {
      title: 'Tasdiqlangan',
      value: stats.approvedRequests,
      icon: CheckCircle,
      color: 'from-green-500 to-emerald-600',
      trend: 15,
      trendLabel: 'bu oyda',
    },
    {
      title: 'Kutish Holati',
      value: stats.pendingRequests,
      icon: Clock,
      color: 'from-orange-500 to-amber-600',
      trend: -5,
      trendLabel: 'bu oyda',
    },
    {
      title: 'Tarbiyachilar',
      value: stats.totalEducators,
      icon: Users,
      color: 'from-cyan-500 to-blue-600',
      trend: 3,
      trendLabel: 'bu oyda',
    },
    {
      title: 'Jami Foydalanuvchilar',
      value: stats.totalUsers,
      icon: Activity,
      color: 'from-rose-500 to-red-600',
      trend: 10,
      trendLabel: 'bu oyda',
    },
  ]

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter">
            Admin Dashboard
          </h1>
          <p className="text-slate-400 mt-2">Yotoqxona boshqaruv tizimiga xush kelibsiz</p>
        </div>
      </div>

      <div className="flex gap-2 mb-8 border-b border-white/10 overflow-x-auto">
        {['overview', 'analytics', 'reports'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab === 'overview' && 'Umumiy ko\'rinish'}
            {tab === 'analytics' && 'Tahlil'}
            {tab === 'reports' && 'Hisobotlar'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {statCards.map((card, index) => (
              <StatCard
                key={index}
                title={card.title}
                value={card.value}
                icon={card.icon}
                color={card.color}
                trend={card.trend}
                trendLabel={card.trendLabel}
                isLoading={stats.loading}
              />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
          >
            <h2 className="text-xl font-black text-white mb-4">Tezkor Amallar</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <button className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-all group">
                <p className="text-sm text-slate-400 group-hover:text-white transition-colors">
                  Ma&apos;lumotlarni Yangilash
                </p>
                <p className="text-lg font-black text-white mt-2">
                  Barcha Statistikalarni Yangilash -&gt;
                </p>
              </button>
              <button className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-all group">
                <p className="text-sm text-slate-400 group-hover:text-white transition-colors">
                  Tizim holati
                </p>
                <p className="text-lg font-black text-white mt-2">
                  Server Holatini Tekshirish -&gt;
                </p>
              </button>
              <button className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-all group">
                <p className="text-sm text-slate-400 group-hover:text-white transition-colors">
                  Yangi Talaba
                </p>
                <p className="text-lg font-black text-white mt-2">
                  Foydalanuvchi Qo&apos;shish -&gt;
                </p>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
          >
            <h3 className="text-lg font-black text-white mb-4">Oylik Statistika</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
                <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0b1120',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                />
                <Line type="monotone" dataKey="students" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="applications" stroke="#a855f7" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
            >
              <h3 className="text-lg font-black text-white mb-4">Qabul va Rad etishlar</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mockMonthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
                  <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0b1120',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="students" fill="#3b82f6" />
                  <Bar dataKey="applications" fill="#a855f7" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
            >
              <h3 className="text-lg font-black text-white mb-4">Ariza Holatlari</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={applicationStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {applicationStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0b1120',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
        >
          <h3 className="text-lg font-black text-white mb-4">Hisobotlar</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <button className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-all">
              <p className="text-sm text-slate-400">Talabalar hisoboti</p>
              <p className="text-base font-bold text-white mt-2">PDF sifatida Eksport -&gt;</p>
            </button>
            <button className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-all">
              <p className="text-sm text-slate-400">Arizalar hisoboti</p>
              <p className="text-base font-bold text-white mt-2">Excel sifatida Eksport -&gt;</p>
            </button>
            <button className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-all">
              <p className="text-sm text-slate-400">Tizim statistikasi</p>
              <p className="text-base font-bold text-white mt-2">CSV sifatida Eksport -&gt;</p>
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
