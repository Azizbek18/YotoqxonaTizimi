'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { Download, BarChart3, TrendingUp, Users, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const mockMonthlyData = [
    { month: 'Yanvar', students: 45, applications: 24, approved: 18 },
    { month: 'Fevral', students: 52, applications: 28, approved: 22 },
    { month: 'Mart', students: 48, applications: 32, approved: 26 },
    { month: 'Aprel', students: 61, applications: 35, approved: 28 },
    { month: 'May', students: 55, applications: 38, approved: 30 },
    { month: 'Iyun', students: 67, applications: 42, approved: 35 },
]

export default function AdminReportsPage() {
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalApplications: 0,
        totalStudents: 0,
        approvedApps: 0,
    })
    const [roleData, setRoleData] = useState([
        { name: 'Talabalar', value: 0, color: '#3b82f6' },
        { name: 'Tarbiyachilar', value: 0, color: '#10b981' },
        { name: 'Adminlar', value: 0, color: '#ef4444' },
    ])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadStats = async () => {
            try {
                const [users, apps, students, approved, educators, admins] = await Promise.all([
                    supabase.from('users').select('*', { count: 'exact', head: true }),
                    supabase.from('arizalar').select('*', { count: 'exact', head: true }),
                    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'talaba'),
                    supabase.from('arizalar').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
                    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'tarbiyachi'),
                    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
                ])

                setStats({
                    totalUsers: users.count || 0,
                    totalApplications: apps.count || 0,
                    totalStudents: students.count || 0,
                    approvedApps: approved.count || 0,
                })

                setRoleData([
                    { name: 'Talabalar', value: students.count || 0, color: '#3b82f6' },
                    { name: 'Tarbiyachilar', value: educators.count || 0, color: '#10b981' },
                    { name: 'Adminlar', value: admins.count || 0, color: '#ef4444' },
                ])
            } finally {
                setLoading(false)
            }
        }

        loadStats()
    }, [])

    const exportToPDF = () => {
        toast.error("PDF eksport funksiyasi ko'p yaqinda mavjud bo'ladi")
    }

    const exportToExcel = () => {
        toast.error("Excel eksport funksiyasi ko'p yaqinda mavjud bo'ladi")
    }

    const exportToCSV = () => {
        toast.error("CSV eksport funksiyasi ko'p yaqinda mavjud bo'ladi")
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter flex items-center gap-2">
                        <BarChart3 size={32} />
                        Hisobotlar va Tahlil
                    </h1>
                    <p className="text-slate-400 mt-2">Tizim statistikasi va analitikasi</p>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[
                    {
                        label: 'Jami Foydalanuvchilar',
                        value: stats.totalUsers,
                        icon: Users,
                        color: 'from-blue-500 to-indigo-600',
                    },
                    {
                        label: 'Jami Arizalar',
                        value: stats.totalApplications,
                        icon: FileText,
                        color: 'from-purple-500 to-pink-600',
                    },
                    {
                        label: 'Talabalar',
                        value: stats.totalStudents,
                        icon: TrendingUp,
                        color: 'from-green-500 to-emerald-600',
                    },
                    {
                        label: 'Tasdiqlangan',
                        value: stats.approvedApps,
                        icon: FileText,
                        color: 'from-orange-500 to-amber-600',
                    },
                ].map((item, idx) => {
                    const Icon = item.icon
                    return (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-slate-400 text-sm font-medium mb-2">{item.label}</p>
                                    <p className="text-4xl font-black text-white">{loading ? '...' : item.value}</p>
                                </div>
                                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center text-white`}>
                                    <Icon size={24} />
                                </div>
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Line Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
                >
                    <h3 className="text-lg font-black text-white mb-4">Oylik Dinamika</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={mockMonthlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
                            <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#0b1120',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                }}
                            />
                            <Line type="monotone" dataKey="students" stroke="#3b82f6" strokeWidth={2} name="Talabalar" />
                            <Line type="monotone" dataKey="applications" stroke="#a855f7" strokeWidth={2} name="Arizalar" />
                            <Line type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={2} name="Tasdiqlangan" />
                        </LineChart>
                    </ResponsiveContainer>
                </motion.div>

                {/* Role Distribution */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
                >
                    <h3 className="text-lg font-black text-white mb-4">Rol bo&apos;yicha Taqsimot</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={roleData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, value }) => `${name}: ${value}`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {roleData.map((entry, index) => (
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

            {/* Bar Chart */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8"
            >
                <h3 className="text-lg font-black text-white mb-4">Qabul va Rad etishlar</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={mockMonthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
                        <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#0b1120',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                            }}
                        />
                        <Bar dataKey="applications" fill="#a855f7" />
                        <Bar dataKey="approved" fill="#10b981" />
                    </BarChart>
                </ResponsiveContainer>
            </motion.div>

            {/* Export Options */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
            >
                <h3 className="text-lg font-black text-white mb-4">Eksport Qilish</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                        onClick={exportToPDF}
                        className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all group flex items-center gap-2"
                    >
                        <Download size={20} className="text-blue-400" />
                        <div className="text-left">
                            <p className="text-sm font-semibold text-white">PDF Eksport</p>
                            <p className="text-xs text-slate-400">Tizim hisoboti</p>
                        </div>
                    </button>
                    <button
                        onClick={exportToExcel}
                        className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all group flex items-center gap-2"
                    >
                        <Download size={20} className="text-green-400" />
                        <div className="text-left">
                            <p className="text-sm font-semibold text-white">Excel Eksport</p>
                            <p className="text-xs text-slate-400">Batafsil ma&apos;lumot</p>
                        </div>
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all group flex items-center gap-2"
                    >
                        <Download size={20} className="text-purple-400" />
                        <div className="text-left">
                            <p className="text-sm font-semibold text-white">CSV Eksport</p>
                            <p className="text-xs text-slate-400">Ma&apos;lumotlar tabli</p>
                        </div>
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
