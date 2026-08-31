'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Download, BarChart3, TrendingUp, Users, FileText } from 'lucide-react'
import { SkelPage } from '@/components/ui/skeletons'
import toast from 'react-hot-toast'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { downloadXlsx } from '@/lib/spreadsheet-export'
import { useThemeStore } from '@/lib/stores/theme-store'
import { adminUI, adminChart } from '@/lib/admin-ui'
import { fetchAdminDashboard } from '@/features/admin-dashboard/client/api'
import { useRoomFloors } from '@/lib/hooks/useRoomFloors'
import {
  buildStudentReportCsv,
  buildStudentReportTable,
  cleanReportText,
  downloadTextFile,
  reportGenderLabel,
} from '@/lib/student-report-table'

type MonthlyReportRow = {
    year: number
    monthIndex: number
    monthName: string
    studentsCount: number
    applications: number
    approved: number
}

type MonthlyChartRow = {
    month: string
    students: number
    applications: number
    approved: number
}

export default function AdminReportsPage() {
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'
    const { floorOf } = useRoomFloors()
    const [mounted, setMounted] = useState(false)
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalApplications: 0,
        totalStudents: 0,
        approvedApps: 0,
    })
    const [roleData, setRoleData] = useState([
        { name: 'Talabalar', value: 0, color: adminChart.series[0] },
        { name: 'Tarbiyachilar', value: 0, color: adminChart.series[1] },
        { name: 'Adminlar', value: 0, color: adminChart.series[3] },
    ])
    const [monthlyData, setMonthlyData] = useState<MonthlyChartRow[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const mountId = window.setTimeout(() => setMounted(true), 0)
        return () => window.clearTimeout(mountId)
    }, [])

    useEffect(() => {
        if (!mounted) return

        const loadStats = async () => {
            try {
                const dashboard = await fetchAdminDashboard()

                setStats({
                    totalUsers: dashboard.stats.totalUsers,
                    totalApplications: dashboard.stats.totalRequests,
                    totalStudents: dashboard.stats.totalStudents,
                    approvedApps: dashboard.stats.approvedRequests,
                })

                setRoleData([
                    { name: 'Talabalar', value: dashboard.roleCounts.students, color: adminChart.series[0] },
                    { name: 'Tarbiyachilar', value: dashboard.roleCounts.educators, color: adminChart.series[1] },
                    { name: 'Adminlar', value: dashboard.roleCounts.admins, color: adminChart.series[3] },
                ])

                // Fetch real monthly statistics
                const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']
                const d = new Date()
                
                // Get the start of the 6-month window
                const oldestMonthDate = new Date(d.getFullYear(), d.getMonth() - 5, 1)
                const oldestTime = oldestMonthDate.getTime()
                const recentStudents = dashboard.students.filter((user) => new Date(user.created_at).getTime() >= oldestTime)
                const recentApplications = dashboard.applications.filter((application) => (
                    application.type !== 'chat' && new Date(application.created_at).getTime() >= oldestTime
                ))
                const priorStudents = dashboard.students.length - recentStudents.length

                // Initialize the 6-month array
                const monthsList: MonthlyReportRow[] = []
                for (let i = 5; i >= 0; i--) {
                    const tempDate = new Date(d.getFullYear(), d.getMonth() - i, 1)
                    monthsList.push({
                        year: tempDate.getFullYear(),
                        monthIndex: tempDate.getMonth(),
                        monthName: monthNames[tempDate.getMonth()],
                        studentsCount: 0,
                        applications: 0,
                        approved: 0
                    })
                }

                // Group users by month
                if (recentStudents) {
                    recentStudents.forEach(u => {
                        const date = new Date(u.created_at)
                        const y = date.getFullYear()
                        const m = date.getMonth()
                        const match = monthsList.find(item => item.year === y && item.monthIndex === m)
                        if (match) {
                            match.studentsCount++
                        }
                    })
                }

                // Group arizalar by month
                if (recentApplications) {
                    recentApplications.forEach(a => {
                        const date = new Date(a.created_at)
                        const y = date.getFullYear()
                        const m = date.getMonth()
                        const match = monthsList.find(item => item.year === y && item.monthIndex === m)
                        if (match) {
                            match.applications++
                            if (a.status === 'approved') {
                                match.approved++
                            }
                        }
                    })
                }

                // Map to cumulative student numbers + format for chart
                let cumulativeStudents = priorStudents
                const finalMonthlyData = monthsList.map(month => {
                    cumulativeStudents += month.studentsCount
                    return {
                        month: month.monthName,
                        students: cumulativeStudents,
                        applications: month.applications,
                        approved: month.approved
                    }
                })

                setMonthlyData(finalMonthlyData)
            } catch (err) {
                console.error('Error loading stats:', err)
                toast.error("Ma'lumotlarni yuklashda xatolik yuz berdi")
            } finally {
                setLoading(false)
            }
        }

        loadStats()
    }, [mounted])

    const downloadUsersData = async (format: 'excel' | 'csv' | 'pdf') => {
        const toastId = toast.loading("Ma'lumotlar tayyorlanmoqda...")
        try {
            // Faqat talabalarni (xodim/admin emas) xona raqami bo'yicha saralab olish
            const { students } = await fetchAdminDashboard()

            if (!students || students.length === 0) {
                toast.error("Ma'lumot topilmadi", { id: toastId })
                return
            }

            // Ustunlar, xona bo'yicha guruhlash va bo'sh o'rinlar bilan
            // to'ldirish — dekan paneli bilan bir xil jadval chiqishi
            // uchun umumiy modulda (lib/student-report-table.ts)
            const { headers, rawRows, displayRows, merges: excelMerges } = buildStudentReportTable(students, floorOf)

            // PDF o'z qisqa jadvalini quradi (xonalar bo'yicha guruhlanmagan,
            // bo'sh o'rinlarsiz) — unga faqat bir xil tartibdagi ro'yxat kerak
            const sortedUsers = [...students].sort((a, b) => {
                const roomA = a.room_number || '';
                const roomB = b.room_number || '';
                return roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
            });

            if (format === 'excel') {
                downloadXlsx({
                    filename: `foydalanuvchilar_${new Date().toISOString().slice(0, 10)}.xlsx`,
                    sheetName: 'Hisobot',
                    headers,
                    rows: displayRows,
                    merges: excelMerges,
                })

                toast.success("Excel fayl yuklab olindi", { id: toastId });
                return;
            }

            if (format === 'pdf') {
                const { jsPDF } = await import('jspdf')
                const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

                doc.setFontSize(14)
                doc.text("Talabalar Yotoqxonasi - Foydalanuvchilar Hisoboti", 14, 15)
                doc.setFontSize(9)
                doc.text(`Sana: ${new Date().toLocaleDateString('uz-UZ')}`, 14, 22)

                // Excel/CSV barcha 31 ta ustunni to'liq ma'lumot uchun beradi;
                // ularni bitta PDF sahifasiga sig'dirishning iloji yo'q — 4
                // belgigacha kesib tashlash hamma narsani o'qib bo'lmaydigan
                // qilib qo'yardi. Shuning uchun PDF chop etish/ko'rish uchun
                // eng muhim ustunlar bilan, HECH NARSA KESILMASDAN (uzun matn
                // ko'p qatorga o'raladi) qisqa hisobot beradi.
                const pdfHeaders = ['#', 'Qavat', 'Xona', 'F.I.Sh.', 'Fakulteti', 'Kursi', 'Jinsi', 'Telefon']
                const colWidths = [10, 18, 22, 70, 70, 15, 20, 52]
                const marginX = 10
                const lineHeight = 4.5
                const cellPaddingY = 1.5
                const headerRowHeight = 8

                doc.setFontSize(8)

                const pdfRows = sortedUsers.map((u, idx) => {
                    const floor = floorOf(u.room_number)
                    return [
                        String(idx + 1),
                        floor ? String(floor) : '-',
                        // jsPDF'ning o'rnatilgan shrifti "№" belgisini
                        // qo'llab-quvvatlamaydi (o'rniga "!" chiqadi) — ASCII
                        // "#" ishlatiladi (faqat PDF uchun; Excel/CSV o'zgarmaydi)
                        u.room_number ? `#${u.room_number}` : '-',
                        cleanReportText(u.full_name || '-'),
                        cleanReportText(u.faculty || '-'),
                        cleanReportText(u.course || '-'),
                        cleanReportText(reportGenderLabel(u.gender)),
                        cleanReportText(u.phone_number || u.phone || '-'),
                    ]
                })

                let startY = 28

                const drawHeaderRow = () => {
                    // jsPDF faqat sikl ichida rect('F'/'FD') va text() birga
                    // chaqirilganda BIRINCHI katakchanigina to'ldiradi (haqiqiy
                    // render xatosi) — shuning uchun avval BARCHA to'rtburchak,
                    // keyin BARCHA matn alohida sikllarda chiziladi
                    let x = marginX
                    doc.setFillColor(79, 70, 229)
                    pdfHeaders.forEach((_, i) => {
                        doc.rect(x, startY, colWidths[i], headerRowHeight, 'FD')
                        x += colWidths[i]
                    })

                    x = marginX
                    doc.setTextColor(255, 255, 255)
                    doc.setFont('helvetica', 'bold')
                    pdfHeaders.forEach((h, i) => {
                        doc.text(h, x + 1.5, startY + 5.5)
                        x += colWidths[i]
                    })

                    startY += headerRowHeight
                    doc.setTextColor(0, 0, 0)
                    doc.setFont('helvetica', 'normal')
                }

                drawHeaderRow()

                pdfRows.forEach((row) => {
                    const wrapped = row.map((cell, i) => doc.splitTextToSize(String(cell), colWidths[i] - 3))
                    const rowLines = Math.max(...wrapped.map((w) => w.length), 1)
                    const rowHeight = rowLines * lineHeight + cellPaddingY * 2

                    if (startY + rowHeight > 200) {
                        doc.addPage()
                        startY = 15
                        drawHeaderRow()
                    }

                    let rx = marginX
                    wrapped.forEach((lines, i) => {
                        doc.rect(rx, startY, colWidths[i], rowHeight)
                        doc.text(lines, rx + 1.5, startY + cellPaddingY + lineHeight - 1)
                        rx += colWidths[i]
                    })
                    startY += rowHeight
                })

                // doc.save() ishlatilmaydi — jsPDF'ning Node build'ida bu metod
                // require('fs') orqali faylni diskka yozadi, brauzerda esa xato
                // beradi/hech narsa yuklamaydi. Excel/CSV kabi Blob + vaqtinchalik
                // <a> havolasi orqali qo'lda yuklab olish ishonchli ishlaydi.
                const pdfBlob = doc.output('blob')
                const pdfUrl = URL.createObjectURL(pdfBlob)
                const pdfLink = document.createElement('a')
                pdfLink.href = pdfUrl
                pdfLink.setAttribute('download', `foydalanuvchilar_${new Date().toISOString().slice(0, 10)}.pdf`)
                document.body.appendChild(pdfLink)
                pdfLink.click()
                document.body.removeChild(pdfLink)
                URL.revokeObjectURL(pdfUrl)

                toast.success("PDF fayl yuklab olindi", { id: toastId })
                return
            }

            // CSV formati — merged-cell birlashtirish faqat Excelda ma'no
            // beradi, CSVda esa bo'sh katak "ma'lumot yo'q" deb o'qilib
            // qolishi mumkin, shuning uchun to'liq (blanklanmagan) qiymatlar
            // ishlatiladi
            downloadTextFile(
                `foydalanuvchilar_xonalar_boyicha_${new Date().toISOString().slice(0, 10)}.csv`,
                buildStudentReportCsv(headers, rawRows),
                'text/csv;charset=utf-8;',
            )

            toast.success("CSV fayl yuklab olindi", { id: toastId })
        } catch (error) {
            console.error('Export error full object:', JSON.parse(JSON.stringify(error)))
            const supabaseError = error as { message?: string; details?: string }
            const errorMessage = supabaseError?.message || supabaseError?.details || (error instanceof Error ? error.message : "Noma'lum xatolik")
            toast.error(`Eksportda xatolik: ${errorMessage}`, { id: toastId, duration: 5000 })
        }
    }

    const exportToPDF = () => downloadUsersData('pdf')
    const exportToExcel = () => downloadUsersData('excel')
    const exportToCSV = () => downloadUsersData('csv')

    if (!mounted) {
        return <SkelPage />
    }

    const ui = adminUI(isLight)

    return (
        <div>
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3 ${ui.strong}`}>
                        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${ui.accentTile}`}>
                            <BarChart3 size={24} strokeWidth={2.4} />
                        </span>
                        Hisobotlar va Tahlil
                    </h1>
                    <p className={`${ui.muted} mt-2`}>Tizim statistikasi va analitikasi</p>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[
                    { label: 'Jami Foydalanuvchilar', value: stats.totalUsers, icon: Users },
                    { label: 'Jami Arizalar', value: stats.totalApplications, icon: FileText },
                    { label: 'Talabalar', value: stats.totalStudents, icon: TrendingUp },
                    { label: 'Tasdiqlangan', value: stats.approvedApps, icon: FileText },
                ].map((item, idx) => {
                    const Icon = item.icon
                    return (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.08 }}
                            className={`rounded-2xl border p-6 ${ui.card} ${ui.hoverLift}`}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${ui.muted}`}>{item.label}</p>
                                    <p className={`text-3xl sm:text-4xl font-extrabold ${ui.strong}`}>{loading ? '—' : item.value}</p>
                                </div>
                                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${ui.accentTile}`}>
                                    <Icon size={24} strokeWidth={2.4} />
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
                    className={`border rounded-2xl p-6 ${ui.card}`}
                >
                    <h3 className={`text-lg font-bold mb-4 ${ui.strong}`}>Oylik Dinamika</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#f1f5f9' : 'rgba(255,255,255,0.1)'} />
                            <XAxis stroke={isLight ? '#64748b' : 'rgba(255,255,255,0.5)'} dataKey="month" style={{ fontSize: '12px' }} />
                            <YAxis stroke={isLight ? '#64748b' : 'rgba(255,255,255,0.5)'} style={{ fontSize: '12px' }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: isLight ? '#ffffff' : '#0b1120',
                                    border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    color: isLight ? '#0f172a' : '#ffffff'
                                }}
                            />
                            <Line type="monotone" dataKey="students" stroke={adminChart.primary} strokeWidth={2} name="Talabalar" />
                            <Line type="monotone" dataKey="applications" stroke={adminChart.primarySoft} strokeWidth={2} name="Arizalar" />
                            <Line type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={2} name="Tasdiqlangan" />
                        </LineChart>
                    </ResponsiveContainer>
                </motion.div>

                {/* Role Distribution */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className={`border rounded-2xl p-6 ${ui.card}`}
                >
                    <h3 className={`text-lg font-bold mb-4 ${ui.strong}`}>Rol bo&apos;yicha Taqsimot</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={roleData}
                                cx="50%"
                                cy="45%"
                                labelLine={false}
                                outerRadius={75}
                                innerRadius={45}
                                paddingAngle={4}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {roleData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: isLight ? '#ffffff' : '#0b1120',
                                    border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    color: isLight ? '#0f172a' : '#ffffff'
                                }}
                            />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                formatter={(value) => {
                                    const item = roleData.find(d => d.name === value);
                                    return (
                                        <span className={`text-xs font-bold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                                            {value}: {item ? item.value : 0}
                                        </span>
                                    )
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
                className={`border rounded-2xl p-6 mb-8 ${ui.card}`}
            >
                <h3 className={`text-lg font-bold mb-4 ${ui.strong}`}>Qabul va Rad etishlar</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#f1f5f9' : 'rgba(255,255,255,0.1)'} />
                        <XAxis stroke={isLight ? '#64748b' : 'rgba(255,255,255,0.5)'} dataKey="month" style={{ fontSize: '12px' }} />
                        <YAxis stroke={isLight ? '#64748b' : 'rgba(255,255,255,0.5)'} style={{ fontSize: '12px' }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isLight ? '#ffffff' : '#0b1120',
                                border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: isLight ? '#0f172a' : '#ffffff'
                            }}
                        />
                        <Bar dataKey="applications" fill={adminChart.primary} name="Arizalar" />
                        <Bar dataKey="approved" fill="#10b981" name="Tasdiqlangan" />
                    </BarChart>
                </ResponsiveContainer>
            </motion.div>

            {/* Export Options */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={`border rounded-2xl p-6 ${ui.card}`}
            >
                <h3 className={`text-lg font-bold mb-4 ${ui.strong}`}>Eksport Qilish</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                        onClick={exportToPDF}
                        className={`p-4 border rounded-lg transition-all group flex items-center gap-2 ${
                            isLight
                                ? 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                                : 'bg-white/5 hover:bg-white/10 border-white/10'
                        }`}
                    >
                        <Download size={20} className="text-indigo-500" />
                        <div className="text-left">
                            <p className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>PDF Eksport</p>
                            <p className="text-xs text-slate-400">Chop etish yoki ko&apos;rsatish uchun jadval</p>
                        </div>
                    </button>
                    <button
                        onClick={exportToExcel}
                        className={`p-4 border rounded-lg transition-all group flex items-center gap-2 ${
                            isLight
                                ? 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                                : 'bg-white/5 hover:bg-white/10 border-white/10'
                        }`}
                    >
                        <Download size={20} className="text-indigo-500" />
                        <div className="text-left">
                            <p className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Excel Eksport</p>
                            <p className="text-xs text-slate-400">Xona bo&apos;yicha guruhlangan, batafsil jadval</p>
                        </div>
                    </button>
                    <button
                        onClick={exportToCSV}
                        className={`p-4 border rounded-lg transition-all group flex items-center gap-2 ${
                            isLight
                                ? 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                                : 'bg-white/5 hover:bg-white/10 border-white/10'
                        }`}
                    >
                        <Download size={20} className="text-indigo-500" />
                        <div className="text-left">
                            <p className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>CSV Eksport</p>
                            <p className="text-xs text-slate-400">Boshqa dastur/tizimga import qilish uchun xom ma&apos;lumot</p>
                        </div>
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
