'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Download, BarChart3, TrendingUp, Users, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import ExcelJS from 'exceljs'
import { useThemeStore } from '@/lib/stores/theme-store'
import { fetchAdminDashboard } from '@/features/admin-dashboard/client/api'
import { extractFloor } from '@/lib/floor'

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
    const [mounted, setMounted] = useState(false)
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
                    { name: 'Talabalar', value: dashboard.roleCounts.students, color: '#3b82f6' },
                    { name: 'Tarbiyachilar', value: dashboard.roleCounts.educators, color: '#10b981' },
                    { name: 'Adminlar', value: dashboard.roleCounts.admins, color: '#ef4444' },
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

            // Xona raqami bo'yicha tabiiy (1, 2, 10...) saralash — shu bilan birga
            // qavat ham (xonadan hisoblanadi) o'sish tartibida guruhlanadi
            const sortedUsers = [...students].sort((a, b) => {
                const roomA = a.room_number || '';
                const roomB = b.room_number || '';
                return roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
            });

            // Matnni tozalash funksiyasi (apostroflar va ortiqcha bo'shliqlar uchun)
            const cleanText = (val: unknown) => String(val ?? '')
                .replace(/[ʻʼ‘’`‘]/g, "'")
                .replace(/\s+/g, ' ')
                .trim();

            // "YYYY-MM-DD" ni "DD.MM.YYYY" ko'rinishiga o'tkazish
            const formatDate = (val?: string | null) => {
                if (!val) return '-';
                const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (!match) return val;
                return `${match[3]}.${match[2]}.${match[1]}`;
            };

            const headers = [
                '№',
                'Qavati',
                'Xona raqami',
                'F.I.Sh.',
                'Viloyati',
                'Tumani',
                'MFY',
                'Shartnoma raqami',
                'Pasport seriya raqami',
                'JSHSHIR',
                'Pasport berilgan vaqti',
                "Tug'ilgan kun, oy, yil",
                'Fakulteti',
                "Yo'nalish",
                'Kursi',
                'Millati',
                'Moliya turi',
                'Jinsi',
                'Telefon raqami',
                'Ijtimoiy holati',
                'Ish joyi',
                'Ish vaqti',
                'TTJga joylashgan oyi',
                "TTJdan chiqib ketgan sanasi",
                'Tyutor',
                'Telefon raqami',
                'Otasining ismi va familiyasi',
                'Ish joyi',
                'Telefon nomeri',
                'Onasining ismi va familiyasi',
                'Onasining ish joyi',
                'Telefon nomeri',
            ]

            // Har bir xonada 4 ta o'rin bor — talaba ma'lumotlaridan tashqari
            // qolgan ustunlarni to'ldiruvchi yordamchi funksiya
            const buildFields = (u: typeof sortedUsers[number]) => {
                const gender = u.gender === 'male' || u.gender === 'Erkak' ? 'Erkak' : u.gender === 'female' || u.gender === 'Ayol' ? 'Ayol' : (u.gender || '-');
                const phone = u.phone_number || u.phone || '-';
                return [
                    cleanText(u.full_name || '-'),
                    cleanText(u.region || '-'),
                    cleanText(u.district || '-'),
                    cleanText(u.mahalla || '-'),
                    '-', // Shartnoma raqami — tizimda saqlanmaydi
                    cleanText(u.passport_series || '-'),
                    cleanText(u.jshshir || '-'),
                    cleanText(formatDate(u.passport_date)),
                    cleanText(formatDate(u.birth_date)),
                    cleanText(u.faculty || '-'),
                    cleanText(u.direction || '-'),
                    cleanText(u.course || '-'),
                    cleanText(u.nationality || '-'),
                    cleanText(u.study_type || '-'),
                    cleanText(gender),
                    cleanText(phone),
                    '-', // Ijtimoiy holati — tizimda saqlanmaydi
                    '-', // Ish joyi (talabaning o'zi) — tizimda saqlanmaydi
                    '-', // Ish vaqti — tizimda saqlanmaydi
                    cleanText(formatDate(u.entry_date)),
                    '-', // TTJdan chiqib ketgan sanasi — tizimda saqlanmaydi
                    '-', // Tyutor — tizimda saqlanmaydi
                    '-', // Tyutor telefon raqami — tizimda saqlanmaydi
                    cleanText(u.father_full_name || '-'),
                    cleanText(u.father_workplace || '-'),
                    cleanText(u.father_phone || '-'),
                    cleanText(u.mother_full_name || '-'),
                    cleanText(u.mother_workplace || '-'),
                    cleanText(u.mother_phone || '-'),
                ]
            }
            const emptyFields = () => Array(29).fill('')
            const ROOM_CAPACITY = 4

            // Ketma-ket bir xil xonadagi talabalarni guruhlash
            type RoomGroup = { room: string | null; floor: number | null; students: typeof sortedUsers }
            const roomGroups: RoomGroup[] = []
            sortedUsers.forEach((u) => {
                const room = u.room_number || null
                const last = roomGroups[roomGroups.length - 1]
                if (room && last && last.room === room) {
                    last.students.push(u)
                } else {
                    roomGroups.push({ room, floor: extractFloor(u.room_number), students: [u] })
                }
            })

            // Ma'lumotlarni shakllantirish — xona to'liq bo'lmasa ham qolgan
            // 4 tagacha o'rin bo'sh qator sifatida qoldiriladi
            const rawRows: string[][] = []
            let seq = 1
            roomGroups.forEach((group) => {
                const qavatValue = group.floor ? String(group.floor) : '-'
                const xonaValue = group.room ? `№-${group.room}` : '-'

                group.students.forEach((u) => {
                    rawRows.push([String(seq), qavatValue, xonaValue, ...buildFields(u)])
                    seq++
                })

                if (group.room) {
                    const emptySlots = Math.max(0, ROOM_CAPACITY - group.students.length)
                    for (let k = 0; k < emptySlots; k++) {
                        rawRows.push(['', qavatValue, xonaValue, ...emptyFields()])
                    }
                }
            })

            // Bir xil qavat va xonalarni guruhlash (vizual birlashtirish)
            const displayRows = JSON.parse(JSON.stringify(rawRows));
            const excelMerges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

            const mergeColumn = (col: number) => {
                let i = 0;
                while (i < displayRows.length) {
                    const value = displayRows[i][col];
                    if (value === '-' || !value) {
                        i++;
                        continue;
                    }

                    let j = i + 1;
                    while (j < displayRows.length && rawRows[j][col] === value) {
                        displayRows[j][col] = ""; // Takrorlanmasligi uchun bo'shatish
                        j++;
                    }

                    if (j - i > 1) {
                        excelMerges.push({
                            s: { r: i + 1, c: col }, // s: start (header dan keyin)
                            e: { r: j, c: col }      // e: end
                        });
                    }
                    i = j;
                }
            };

            if (displayRows.length > 0) {
                mergeColumn(1); // Qavati
                mergeColumn(2); // Xona raqami
            }

            if (format === 'excel') {
                // Excel (.xlsx) yaratish — ExcelJS orqali (bepul "xlsx" kutubxonasi
                // katak stillarini — qalin shrift, ramka — faylga yoza olmaydi)
                const workbook = new ExcelJS.Workbook()
                const worksheet = workbook.addWorksheet('Hisobot')

                worksheet.addRow(headers)
                displayRows.forEach((row: string[]) => worksheet.addRow(row))

                excelMerges.forEach(({ s, e }) => {
                    worksheet.mergeCells(s.r + 1, s.c + 1, e.r + 1, e.c + 1)
                })

                const thinBorder = {
                    top: { style: 'thin' as const },
                    left: { style: 'thin' as const },
                    bottom: { style: 'thin' as const },
                    right: { style: 'thin' as const },
                }
                const centeredCols = new Set([1, 2, 3]) // №, Qavati, Xona raqami (1-indekslangan)

                // Sarlavhalarni (birinchi qator) formatlash — asosiy matn sifatida qalin qilib
                const headerRow = worksheet.getRow(1)
                headerRow.height = 40
                headerRow.eachCell({ includeEmpty: true }, (cell) => {
                    cell.font = { bold: true, name: 'Times New Roman', size: 12 }
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
                    cell.border = thinBorder
                })

                // Ma'lumotlar kataklarini formatlash — har bir katakka ramka
                for (let r = 2; r <= worksheet.rowCount; r++) {
                    worksheet.getRow(r).eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        cell.font = { name: 'Times New Roman', size: 11 }
                        cell.alignment = {
                            vertical: 'middle',
                            horizontal: centeredCols.has(colNumber) ? 'center' : 'left',
                            wrapText: true,
                        }
                        cell.border = thinBorder
                    })
                }

                // Ustun kengliklarini avtomatik hisoblash (№ ustuni tor bo'lishi kerak)
                headers.forEach((h, i) => {
                    const maxLen = Math.max(h.length, ...rawRows.map(row => String(row[i]).length))
                    worksheet.getColumn(i + 1).width = i === 0 ? Math.max(maxLen + 2, 5) : maxLen + 4
                })

                // Faylni yuklab olish
                const buffer = await workbook.xlsx.writeBuffer()
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.setAttribute('download', `foydalanuvchilar_${new Date().toISOString().slice(0, 10)}.xlsx`)
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)

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

                let startY = 28
                // 31 ta ustun bitta landscape A4 sahifasiga sig'mas darajada ko'p
                // bo'lgani uchun kenglik sahifa bo'yicha teng taqsimlanadi (o'rniga
                // hardcode qilingan 14 ta ustunlik kenglik ishlatilmaydi, aks holda
                // ustunlar sahifadan chiqib ketardi)
                const availableWidth = 277
                const colWidth = availableWidth / headers.length
                const maxChars = Math.max(3, Math.floor(colWidth / 1.8))
                const rowHeight = 7

                // Header drawing
                let x = 10
                doc.setFontSize(5)
                doc.setFillColor(79, 70, 229)
                doc.setTextColor(255, 255, 255)
                headers.forEach((h) => {
                    doc.rect(x, startY, colWidth, rowHeight, 'F')
                    doc.text(h.slice(0, maxChars), x + 0.5, startY + 4.5)
                    x += colWidth
                })

                startY += rowHeight
                doc.setTextColor(0, 0, 0)

                rawRows.forEach((row) => {
                    if (startY > 185) {
                        doc.addPage()
                        startY = 15
                    }
                    let rx = 10
                    row.forEach((cellText) => {
                        doc.rect(rx, startY, colWidth, rowHeight)
                        const str = String(cellText).slice(0, maxChars)
                        doc.text(str, rx + 0.5, startY + 4.5)
                        rx += colWidth
                    })
                    startY += rowHeight
                })

                doc.save(`foydalanuvchilar_${new Date().toISOString().slice(0, 10)}.pdf`)
                toast.success("PDF fayl yuklab olindi", { id: toastId })
                return
            }

            // CSV formati — merged-cell birlashtirish faqat Excelda ma'no
            // beradi, CSVda esa bo'sh katak "ma'lumot yo'q" deb o'qilib
            // qolishi mumkin, shuning uchun to'liq (blanklanmagan) qiymatlar
            // ishlatiladi
            const content = [
                'sep=,',
                headers.join(','),
                ...rawRows.map((row: string[]) => row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n')

            const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `foydalanuvchilar_xonalar_boyicha_${new Date().toISOString().slice(0, 10)}.csv`)
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

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
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className={`text-3xl sm:text-4xl font-black tracking-tighter flex items-center gap-2 ${
                        isLight ? 'text-slate-800' : 'text-white'
                    }`}>
                        <BarChart3 size={32} />
                        Hisobotlar va Tahlil
                    </h1>
                    <p className={`${isLight ? 'text-slate-500' : 'text-slate-400'} mt-2`}>Tizim statistikasi va analitikasi</p>
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
                            className={`backdrop-blur-xl border rounded-2xl p-6 ${
                                isLight 
                                    ? 'bg-white border-slate-200/80 shadow-md shadow-slate-100' 
                                    : 'bg-[#0b1120]/50 border-white/10'
                            }`}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className={`text-sm font-medium mb-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{item.label}</p>
                                    <p className={`text-4xl font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>{loading ? '...' : item.value}</p>
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
                    className={`backdrop-blur-xl border rounded-2xl p-6 ${
                        isLight 
                            ? 'bg-white border-slate-200/80 shadow-md shadow-slate-100' 
                            : 'bg-[#0b1120]/50 border-white/10'
                    }`}
                >
                    <h3 className={`text-lg font-black mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>Oylik Dinamika</h3>
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
                    className={`backdrop-blur-xl border rounded-2xl p-6 ${
                        isLight 
                            ? 'bg-white border-slate-200/80 shadow-md shadow-slate-100' 
                            : 'bg-[#0b1120]/50 border-white/10'
                    }`}
                >
                    <h3 className={`text-lg font-black mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>Rol bo&apos;yicha Taqsimot</h3>
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
                className={`backdrop-blur-xl border rounded-2xl p-6 mb-8 ${
                    isLight 
                        ? 'bg-white border-slate-200/80 shadow-md shadow-slate-100' 
                        : 'bg-[#0b1120]/50 border-white/10'
                }`}
            >
                <h3 className={`text-lg font-black mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>Qabul va Rad etishlar</h3>
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
                        <Bar dataKey="applications" fill="#a855f7" name="Arizalar" />
                        <Bar dataKey="approved" fill="#10b981" name="Tasdiqlangan" />
                    </BarChart>
                </ResponsiveContainer>
            </motion.div>

            {/* Export Options */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={`backdrop-blur-xl border rounded-2xl p-6 ${
                    isLight 
                        ? 'bg-white border-slate-200/80 shadow-md shadow-slate-100' 
                        : 'bg-[#0b1120]/50 border-white/10'
                }`}
            >
                <h3 className={`text-lg font-black mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>Eksport Qilish</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                        onClick={exportToPDF}
                        className={`p-4 border rounded-lg transition-all group flex items-center gap-2 ${
                            isLight
                                ? 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                                : 'bg-white/5 hover:bg-white/10 border-white/10'
                        }`}
                    >
                        <Download size={20} className="text-blue-400" />
                        <div className="text-left">
                            <p className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>PDF Eksport</p>
                            <p className="text-xs text-slate-400">Tizim hisoboti</p>
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
                        <Download size={20} className="text-green-400" />
                        <div className="text-left">
                            <p className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Excel Eksport</p>
                            <p className="text-xs text-slate-400">Batafsil ma&apos;lumot</p>
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
                        <Download size={20} className="text-purple-400" />
                        <div className="text-left">
                            <p className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>CSV Eksport</p>
                            <p className="text-xs text-slate-400">Ma&apos;lumotlar tabli</p>
                        </div>
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
