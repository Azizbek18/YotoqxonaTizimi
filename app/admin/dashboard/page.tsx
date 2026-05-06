'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, FileText, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'

interface DashboardStats {
  totalStudents: number
  totalRequests: number
  totalUsers: number
  loading: boolean
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalRequests: 0,
    totalUsers: 0,
    loading: true,
  })

  useEffect(() => {
    async function loadStats() {
      try {
        // Talabalar soni
        const { count: studentCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'talaba')

        // Arizalar soni
        const { count: requestCount } = await supabase
          .from('arizalar')
          .select('*', { count: 'exact', head: true })

        // Jami foydalanuvchilar
        const { count: userCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })

        setStats({
          totalStudents: studentCount || 0,
          totalRequests: requestCount || 0,
          totalUsers: userCount || 0,
          loading: false,
        })
      } catch (error) {
        console.error('Statistika yuklashda xato:', error)
        setStats(prev => ({ ...prev, loading: false }))
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
    },
    {
      title: 'Arizalar',
      value: stats.totalRequests,
      icon: FileText,
      color: 'from-purple-500 to-pink-600',
    },
    {
      title: 'Jami Foydalanuvchilar',
      value: stats.totalUsers,
      icon: Users,
      color: 'from-green-500 to-emerald-600',
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter">
          Admin Dashboard
        </h1>
        <p className="text-slate-400 mt-2">Yotoqxona boshqaruv tizimiga xush kelibsiz</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {statCards.map((card, index) => {
          const Icon = card.icon
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-slate-400 text-sm font-medium mb-2">{card.title}</p>
                  <p className="text-3xl sm:text-4xl font-black text-white">
                    {stats.loading ? '...' : card.value}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center text-white`}>
                  <Icon size={24} />
                </div>
              </div>
              <div className="flex items-center text-xs text-emerald-400">
                <TrendingUp size={14} />
                <span className="ml-1">+0% bu oyda</span>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-black text-white mb-4">Tezkor Amallar</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-all group">
            <p className="text-sm text-slate-400 group-hover:text-white transition-colors">Ma&apos;lumotlarni Yangilash</p>
            <p className="text-lg font-black text-white mt-2">Barcha Statistikalarni Yangilash &rarr;</p>
          </button>
          <button className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-all group">
            <p className="text-sm text-slate-400 group-hover:text-white transition-colors">Tizim holati</p>
            <p className="text-lg font-black text-white mt-2">Server Holatini Tekshirish &rarr;</p>
          </button>
        </div>
      </div>
    </div>
  )
}

