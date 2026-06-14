'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { Download, BarChart3, TrendingUp, Users, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import XLSX from 'xlsx-js-style'

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

    const downloadUsersData = async (format: 'excel' | 'csv') => {
        const toastId = toast.loading("Ma'lumotlar tayyorlanmoqda...")
        try {
            // Barcha foydalanuvchilarni xona raqami bo'yicha saralab olish
            const { data: users, error } = await supabase
                .from('users')
                .select('full_name, email, role, room_number, phone_number, faculty, direction, course, status')

            if (error) throw error

            if (!users || users.length === 0) {
                toast.error("Ma'lumot topilmadi", { id: toastId })
                return
            }

            // Xona raqami bo'yicha tabiiy (1, 2, 10...) saralash
            const sortedUsers = [...users].sort((a, b) => {
                const roomA = a.room_number || '';
                const roomB = b.room_number || '';
                return roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
            });

            // Matnni tozalash funksiyasi (apostroflar va ortiqcha bo'shliqlar uchun)
            const cleanText = (val: unknown) => String(val ?? '')
                .replace(/[ʻʼ‘’`‘]/g, "'")
                .replace(/\s+/g, ' ')
                .trim();

            // CSV/Excel formati uchun sarlavhalar
            const headers = ["Xona", "F.I.Sh.", "Email", "Rol", "Telefon", "Fakultet", "Yo'nalish", "Kurs", "Holat"]

            // Ma'lumotlarni shakllantirish
            const rawRows = sortedUsers.map(u => [
                cleanText(u.room_number || '-'),
                cleanText(u.full_name),
                cleanText(u.email),
                cleanText(u.role),
                cleanText(u.phone_number || '-'),
                cleanText(u.faculty || '-'),
                cleanText(u.direction || '-'),
                cleanText(u.course || '-'),
                cleanText(u.status || '-')
            ])

            // Bir xil xonalarni guruhlash (vizual birlashtirish)
            const displayRows = JSON.parse(JSON.stringify(rawRows));
            const excelMerges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

            if (displayRows.length > 0) {
                let i = 0;
                while (i < displayRows.length) {
                    const roomValue = displayRows[i][0];
                    if (roomValue === '-' || !roomValue) {
                        i++;
                        continue;
                    }

                    let j = i + 1;
                    while (j < displayRows.length && rawRows[j][0] === roomValue) {
                        displayRows[j][0] = ""; // Takrorlanmasligi uchun bo'shatish
                        j++;
                    }

                    if (j - i > 1) {
                        excelMerges.push({
                            s: { r: i + 1, c: 0 }, // s: start (header dan keyin)
                            e: { r: j, c: 0 }      // e: end
                        });
                    }
                    i = j;
                }
            }

            if (format === 'excel') {
                // Excel (.xlsx) yaratish
                const worksheet = XLSX.utils.aoa_to_sheet([headers, ...displayRows]);
                worksheet['!merges'] = excelMerges;

                // Sarlavhalarni (birinchi qator) formatlash
                const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const address = XLSX.utils.encode_cell({ r: 0, c: C });
                    if (!worksheet[address]) continue;

                    worksheet[address].s = {
                        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
                        fill: { fgColor: { rgb: "4F46E5" } }, // Indigo fon rangi
                        alignment: { horizontal: "center", vertical: "center" },
                        border: {
                            top: { style: "thin" }, bottom: { style: "thin" },
                            left: { style: "thin" }, right: { style: "thin" }
                        }
                    };
                }

                // Ma'lumotlar kataklarini formatlash (Xona ustunini markazlash)
                for (let R = range.s.r + 1; R <= range.e.r; R++) {
                    const cellAddress = XLSX.utils.encode_cell({ r: R, c: 0 });
                    if (worksheet[cellAddress]) {
                        worksheet[cellAddress].s = {
                            alignment: { vertical: "center", horizontal: "center" },
                            border: {
                                bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                                right: { style: "thin", color: { rgb: "E2E8F0" } }
                            }
                        };
                    }
                }

                // Ustun kengliklarini avtomatik hisoblash
                const colWidths = headers.map((h, i) => {
                    const column = [h, ...rawRows.map(row => String(row[i]))];
                    const maxLen = Math.max(...column.map(v => v.length));
                    return { wch: maxLen + 5 }; // +5 bo'sh joy qo'shish uchun
                });
                worksheet['!cols'] = colWidths;

                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Hisobot");

                // Faylni yuklab olish
                XLSX.writeFile(workbook, `foydalanuvchilar_${new Date().toISOString().slice(0, 10)}.xlsx`);
                toast.success("Excel fayl yuklab olindi", { id: toastId });
                return;
            }

            // CSV formati (oldingidek qoladi)
            const content = [
                'sep=,',
                headers.join(','),
                ...displayRows.map((row: string[]) => row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n')

            const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `foydalanuvchilar_xonalar_boyicha_${new Date().toISOString().slice(0, 10)}.csv`)
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            toast.success("Fayl yuklab olindi", { id: toastId })
        } catch (error) {
            console.error('Export error full object:', JSON.parse(JSON.stringify(error)))
            const supabaseError = error as { message?: string; details?: string }
            const errorMessage = supabaseError?.message || supabaseError?.details || (error instanceof Error ? error.message : "Noma'lum xatolik")
            toast.error(`Eksportda xatolik: ${errorMessage}`, { id: toastId, duration: 5000 })
        }
    }

    const exportToExcel = () => downloadUsersData('excel')
    const exportToCSV = () => downloadUsersData('csv')

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
