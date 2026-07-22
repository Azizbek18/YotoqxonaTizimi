'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Upload, Check, Clock, AlertCircle, Download, Eye,
    Calendar, DollarSign, TrendingUp, FileText, Loader,
    CreditCard, ShieldCheck, HelpCircle,
    ShieldAlert, X, AlertTriangle, CheckCircle2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { supabase } from '@/lib/supabase'
import { getSafeUser } from '@/lib/auth-session'
import PageSkeleton from '@/components/ui/PageSkeleton'
import { User } from '@supabase/supabase-js'
import { fetchStudentPayments, submitStudentPayment } from '@/features/payments/client/api'
import type { PaymentRecord } from '@/features/payments/types'

interface ValidationResult {
    valid: boolean
    amount_match?: boolean
    is_duplicate?: boolean
    is_suspicious_id?: boolean
    amount?: number
    extracted_amount?: number
    confidence: number
    details?: string
    message?: string
    analysis?: string
    file_hash?: string
}

const MONTHS = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
]

export default function TolovaPage() {
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'

    const [payments, setPayments] = useState<PaymentRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [user, setUser] = useState<User | null>(null)

    // Form states
    const [newReceipt, setNewReceipt] = useState<File | null>(null)
    const [selectedMonth, setSelectedMonth] = useState<string>('')
    const [selectedMonths, setSelectedMonths] = useState<string[]>([])
    const [selectedYear, setSelectedYear] = useState<number>(2026)
    const [amount, setAmount] = useState<number>(300000)

    // AI Validation states
    const [validating, setValidating] = useState(false)
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
    const [showValidationModal, setShowValidationModal] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const loadPayments = async () => {
        try {
            setPayments(await fetchStudentPayments())
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error)
            console.error('Error loading payments:', errMsg)
        }
    }

    useEffect(() => {
        if (showValidationModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [showValidationModal]);

    useEffect(() => {
        async function init() {
            try {
                setLoading(true)
                const currentUser = await getSafeUser()
                if (currentUser) {
                    setUser(currentUser)

                    await loadPayments()
                }
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error)
                console.error('Init error:', errMsg)
            } finally {
                setLoading(false)
            }
        }
        init()
    }, [])

    // Helper to get status of a month
    const getMonthStatus = useCallback((monthName: string, year: number): PaymentRecord['status'] | 'unpaid' => {
        const records = payments.filter(p => p.month === monthName && p.year === year)
        if (records.length === 0) return 'unpaid'

        const approvedRecord = records.find(p => p.status === 'paid' || p.status === 'approved')
        if (approvedRecord) return approvedRecord.status

        const waitingRecord = records.find(p => p.status === 'waiting' || p.status === 'pending')
        if (waitingRecord) return waitingRecord.status

        const rejectedRecord = records.find(p => p.status === 'rejected')
        if (rejectedRecord) return rejectedRecord.status

        return 'unpaid'
    }, [payments])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setNewReceipt(e.target.files[0])
        }
    }

    const handleMonthClick = (m: string) => {
        const status = getMonthStatus(m, selectedYear)
        if (status === 'paid' || status === 'approved' || status === 'waiting') {
            toast(`${m} oyi uchun to'lov allaqachon ${status === 'waiting' ? 'tekshirilmoqda' : 'tasdiqlangan'}! ✅`, { icon: 'ℹ️' })
            return
        }

        const clickedIdx = MONTHS.indexOf(m)

        // Find first unpaid month index
        const firstUnpaidIdx = MONTHS.findIndex(month => {
            const s = getMonthStatus(month, selectedYear)
            return s !== 'paid' && s !== 'approved' && s !== 'waiting'
        })

        if (firstUnpaidIdx === -1) return

        // If clicked month is before the first unpaid month, it's invalid
        if (clickedIdx < firstUnpaidIdx) {
            toast.error(`${MONTHS[firstUnpaidIdx]} oyi allaqachon to'langan yoki tekshirilmoqda. Shartnoma bo'yicha to'lovlar faqat to'lanmagan oylardan boshlanadi.`)
            return
        }

        // Check if the clicked month is already selected
        const isAlreadySelected = selectedMonths.includes(m)

        if (isAlreadySelected) {
            // To unselect, they can only unselect if it's the last selected month in the range
            const selectedIndices = selectedMonths.map(month => MONTHS.indexOf(month)).sort((a, b) => a - b)
            const maxSelectedIndex = Math.max(...selectedIndices)
            if (clickedIdx === maxSelectedIndex) {
                const nextSelected = selectedMonths.filter(month => month !== m)
                setSelectedMonths(nextSelected)
                setAmount(nextSelected.length * 300000)
                if (nextSelected.length === 0) {
                    setSelectedMonth("")
                } else {
                    setSelectedMonth(nextSelected[nextSelected.length - 1])
                }
            } else {
                toast.error("Oylarni faqat tanlangan ketma-ketlikning oxiridan boshlab bekor qilishingiz mumkin — avval keyingi oylarni bekor qiling.")
            }
        } else {
            // To select, it must be exactly the next unpaid month!
            let expectedIdx = firstUnpaidIdx
            if (selectedMonths.length > 0) {
                const selectedIndices = selectedMonths.map(month => MONTHS.indexOf(month))
                expectedIdx = Math.max(...selectedIndices) + 1
            }

            // Find the next unpaid month starting from expectedIdx
            while (expectedIdx < MONTHS.length) {
                const s = getMonthStatus(MONTHS[expectedIdx], selectedYear)
                if (s !== 'paid' && s !== 'approved' && s !== 'waiting') {
                    break
                }
                expectedIdx++
            }

            if (clickedIdx === expectedIdx) {
                const nextSelected = [...selectedMonths, m]
                setSelectedMonths(nextSelected)
                setSelectedMonth(m)
                setAmount(nextSelected.length * 300000)
            } else {
                const nextLabel = expectedIdx < MONTHS.length ? MONTHS[expectedIdx] : null
                toast.error(
                    nextLabel
                        ? `Oylarni ketma-ket tanlash kerak — keyingi tanlanishi kerak bo'lgan oy: ${nextLabel}.`
                        : "Iltimos, oylarni ketma-ket tanlang!"
                )
            }
        }
    }

    // Auto-select first unpaid month on mount/year changes
    useEffect(() => {
        if (payments.length > 0 || !loading) {
            const firstUnpaid = MONTHS.find(m => {
                const s = getMonthStatus(m, selectedYear)
                return s !== 'paid' && s !== 'approved' && s !== 'waiting'
            })
            if (firstUnpaid) {
                setSelectedMonth(firstUnpaid)
                setSelectedMonths([firstUnpaid])
                setAmount(300000)
            } else {
                setSelectedMonths([])
                setSelectedMonth("")
                setAmount(0)
            }
        }
    }, [payments, selectedYear, loading, getMonthStatus])

    // Step 1: AI Validation — check receipt before saving
    const handleUpload = async () => {
        if (!newReceipt || !user) return

        if (selectedMonths.length === 0) {
            toast.error("Iltimos, avval to'lov qilmoqchi bo'lgan oyni tanlang!")
            return
        }

        if (amount <= 0) {
            toast.error("To'lov summasi noto'g'ri!")
            return
        }

        setValidating(true)
        setValidationResult(null)
        setShowValidationModal(false)

        try {
            // Send file to AI validation endpoint
            const formData = new FormData()
            formData.append('file', newReceipt)
            formData.append('amount', String(amount))

            const { data: { session: tekshiruvSession } } = await supabase.auth.getSession()
            const res = await fetch('/api/ai/tekshiruv', {
                method: 'POST',
                headers: {
                    ...(tekshiruvSession?.access_token ? { Authorization: `Bearer ${tekshiruvSession.access_token}` } : {})
                },
                body: formData
            })

            const result = await res.json()
            setValidationResult(result)

            if (!result.valid || result.amount_match === false || result.is_duplicate || result.is_suspicious_id) {
                // Show warning modal — amounts don't match, low confidence, or duplicate
                setShowValidationModal(true)
                setValidating(false)
                return
            }

            // If valid — proceed to upload
            await proceedWithUpload(result.file_hash)
        } catch (error) {
            console.error('AI validation error:', error)
            toast.error('AI tekshiruv tizimida xatolik. Qayta urinib ko\'ring.')
        } finally {
            setValidating(false)
        }
    }

    // Step 2: Actual upload after validation passes
    const proceedWithUpload = async (fileHash?: string) => {
        if (!newReceipt || !user) return
        setUploading(true)
        try {
            const monthsToPay = selectedMonths.length > 0 ? selectedMonths : [selectedMonth]
            const paymentForm = new FormData()
            paymentForm.append('file', newReceipt)
            paymentForm.append('amount', String(amount))
            paymentForm.append('year', String(selectedYear))
            paymentForm.append('months', JSON.stringify(monthsToPay))
            if (fileHash) paymentForm.append('validatedHash', fileHash)
            const paymentResult = await submitStudentPayment(paymentForm)
            const insertedDatas = paymentResult.records

            // 4. Trigger AI receipt analysis in the background for all batch records
            if (Array.isArray(insertedDatas)) {
                const { data: { session: tahlilSession } } = await supabase.auth.getSession()
                insertedDatas.forEach(record => {
                    fetch('/api/ai/tahlil', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(tahlilSession?.access_token ? { Authorization: `Bearer ${tahlilSession.access_token}` } : {})
                        },
                        body: JSON.stringify({ paymentId: record.id })
                    }).catch(err => console.error("Background AI trigger error:", err))
                })
            }

            // Refresh state
            await loadPayments()
            setNewReceipt(null)
            setShowValidationModal(false)
            setValidationResult(null)
            // Reset file input
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
            if (fileInput) fileInput.value = ''
            toast.success(`${selectedMonths.join(', ')} ${selectedYear} uchun chek muvaffaqiyatli yuklandi! ✅`)
        } catch (error) {
            console.error('Upload error:', error)
            const errMsg = error instanceof Error ? error.message : String(error)
            toast.error('Chekni yuklashda xatolik: ' + errMsg)
        } finally {
            setUploading(false)
        }
    }

    // Calculations for the dashboard card
    const paidRecords = payments.filter(p => p.status === 'paid' || p.status === 'approved')
    const waitingRecords = payments.filter(p => p.status === 'waiting')
    const paidMonths = paidRecords.length
    const totalContractFee = 3000000 // 3M default contract fee
    const paidAmount = paidRecords.reduce((sum, p) => sum + p.amount, 0)
    const waitingAmount = waitingRecords.reduce((sum, p) => sum + p.amount, 0)
    const remainingAmount = Math.max(0, totalContractFee - paidAmount)
    const progressPercent = Math.min(100, Math.round((paidAmount / totalContractFee) * 100))

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid':
            case 'approved':
                return isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-100/50' : 'bg-emerald-950/20 text-emerald-400 border-emerald-800/60 shadow-emerald-950/10'
            case 'waiting':
                return isLight ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-blue-100/50' : 'bg-blue-950/20 text-blue-400 border-blue-800/60 shadow-blue-950/10'
            case 'rejected':
                return isLight ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-rose-100/50' : 'bg-rose-950/20 text-rose-400 border-rose-800/60 shadow-rose-950/10'
            default:
                return isLight ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-slate-900/40 text-slate-500 border-white/5'
        }
    }

    const getMonthCardClass = (monthName: string, status: string) => {
        const isSelected = selectedMonths.includes(monthName)
        const baseClass = "relative rounded-2xl p-4 border transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl cursor-pointer flex flex-col justify-between h-28 "

        if (isSelected) {
            return baseClass + (isLight
                ? 'bg-blue-600/5 border-blue-500 shadow-lg shadow-blue-500/10 scale-102 ring-2 ring-blue-500/20'
                : 'bg-cyan-500/[0.04] border-cyan-400 shadow-lg shadow-cyan-400/15 scale-102 ring-2 ring-cyan-400/20')
        }

        switch (status) {
            case 'paid':
            case 'approved':
                return baseClass + (isLight ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-400' : 'bg-emerald-950/[0.04] border-emerald-900/30 hover:border-emerald-600/50')
            case 'waiting':
                return baseClass + (isLight ? 'bg-blue-50/40 border-blue-200 hover:border-blue-400' : 'bg-blue-950/[0.04] border-blue-900/30 hover:border-blue-600/50')
            case 'rejected':
                return baseClass + (isLight ? 'bg-rose-50/40 border-rose-200 hover:border-rose-400' : 'bg-rose-950/[0.04] border-rose-900/30 hover:border-rose-600/50')
            default:
                return baseClass + (isLight ? 'bg-white border-slate-200 hover:border-slate-300 text-slate-700' : 'bg-white/[0.02] border-white/5 hover:border-white/15 text-slate-400')
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'paid':
            case 'approved':
                return <Check size={16} className={isLight ? 'text-emerald-600' : 'text-emerald-400'} />
            case 'waiting':
                return <Clock size={16} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
            case 'rejected':
                return <AlertCircle size={16} className={isLight ? 'text-rose-600' : 'text-rose-400'} />
            default:
                return <DollarSign size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'paid':
                return 'To\'langan'
            case 'approved':
                return 'Tasdiqlangan'
            case 'waiting':
                return 'Tekshirilmoqda'
            case 'rejected':
                return 'Rad etilgan'
            default:
                return 'To\'lanmagan'
        }
    }

    const viewReceipt = (url?: string) => {
        if (url) {
            window.open(url, '_blank')
        }
    }

    return (
        <AnimatePresence mode="wait">
            {loading ? (
                <PageSkeleton key="skeleton" />
            ) : (
                <motion.div
                    key="content"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="space-y-8 pb-12"
                >
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <CreditCard size={20} className={isLight ? 'text-blue-600' : 'text-cyan-400'} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>Moliyaviy nazorat</span>
                            </div>
                            <h1 className={`text-3xl sm:text-4xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                To&apos;lov <span className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">Boshqaruvi</span>
                            </h1>
                            <p className={`mt-2 text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                To&apos;lov cheklarini yuklash, holatini 3D va dinamik shaklda nazorat qilish bo&apos;limi.
                            </p>
                        </div>
                    </div>

                    {/* 3D Stats Cards Deck */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {/* Paid Sum */}
                        <div className={`group relative p-5 rounded-3xl border backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(16,185,129,0.12)] ${isLight ? 'bg-white border-slate-200' : 'bg-slate-950/40 border-white/5'
                            }`}>
                            <div className={`absolute inset-0 rounded-3xl -z-10 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                            <div className="flex items-center justify-between mb-4">
                                <span className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>To&apos;langan summa</span>
                                <div className={`p-2 rounded-xl ${isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                    <DollarSign size={16} />
                                </div>
                            </div>
                            <p className={`text-3xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                {(paidAmount).toLocaleString('uz-UZ')} UZS
                            </p>
                            <p className={`text-[10px] mt-2 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Jami shartnoma: {(totalContractFee / 1000000).toFixed(1)}M</p>
                        </div>

                        {/* Waiting Sum */}
                        <div className={`group relative p-5 rounded-3xl border backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(59,130,246,0.12)] ${isLight ? 'bg-white border-slate-200' : 'bg-slate-950/40 border-white/5'
                            }`}>
                            <div className={`absolute inset-0 rounded-3xl -z-10 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                            <div className="flex items-center justify-between mb-4">
                                <span className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Kutilayotgan summa</span>
                                <div className={`p-2 rounded-xl ${isLight ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/10 text-blue-400'}`}>
                                    <Clock size={16} />
                                </div>
                            </div>
                            <p className={`text-3xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                {(waitingAmount).toLocaleString('uz-UZ')} UZS
                            </p>
                            <p className={`text-[10px] mt-2 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Tekshirilayotgan cheklar</p>
                        </div>

                        {/* Paid Months count */}
                        <div className={`group relative p-5 rounded-3xl border backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(6,182,212,0.12)] ${isLight ? 'bg-white border-slate-200' : 'bg-slate-950/40 border-white/5'
                            }`}>
                            <div className={`absolute inset-0 rounded-3xl -z-10 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                            <div className="flex items-center justify-between mb-4">
                                <span className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tasdiqlangan oylar</span>
                                <div className={`p-2 rounded-xl ${isLight ? 'bg-cyan-50 text-cyan-600' : 'bg-cyan-500/10 text-cyan-400'}`}>
                                    <Check size={16} />
                                </div>
                            </div>
                            <p className={`text-3xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                {paidMonths} ta oy
                            </p>
                            <p className={`text-[10px] mt-2 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Jami yuklangan: {payments.length} ta chek</p>
                        </div>

                        {/* Progress Circle Card */}
                        <div className={`group relative p-5 rounded-3xl border backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(168,85,247,0.12)] ${isLight ? 'bg-white border-slate-200' : 'bg-slate-950/40 border-white/5'
                            }`}>
                            <div className={`absolute inset-0 rounded-3xl -z-10 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                            <div className="flex items-center justify-between mb-4">
                                <span className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>To&apos;lov progressi</span>
                                <div className={`p-2 rounded-xl ${isLight ? 'bg-purple-50 text-purple-600' : 'bg-purple-500/10 text-purple-400'}`}>
                                    <TrendingUp size={16} />
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="3" fill="transparent" className={isLight ? "text-slate-100" : "text-white/5"} />
                                        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="3" fill="transparent" strokeDasharray="125" strokeDashoffset={125 - (125 * progressPercent) / 100} className="text-purple-500" style={{ transition: 'stroke-dashoffset 800ms ease-out' }} />
                                    </svg>
                                    <span className={`absolute text-[10px] font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{progressPercent}%</span>
                                </div>
                                <div>
                                    <p className={`text-xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                        {progressPercent}% bajarildi
                                    </p>
                                    <p className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Qolgan to&apos;lov: {remainingAmount.toLocaleString('uz-UZ')} UZS</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Interactive Month Grid & Upload Plate */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Month Picker Plate */}
                        <div className={`lg:col-span-2 rounded-[32px] border p-6 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between ${isLight ? 'bg-white border-slate-200' : 'bg-slate-950/40 border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.4)]'
                            }`}>
                            <div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <div>
                                        <h3 className={`text-lg font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                            📅 Oylar jadvali
                                        </h3>
                                        <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                            To&apos;lov qilmoqchi bo&apos;lgan oyingizni ustiga bosing
                                        </p>
                                    </div>

                                    {/* Year selector Tabs */}
                                    <div className={`flex p-0.5 rounded-xl border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/60 border-white/5'}`}>
                                        {[2025, 2026, 2027].map((y) => (
                                            <button
                                                key={y}
                                                onClick={() => setSelectedYear(y)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${selectedYear === y
                                                    ? isLight ? 'bg-white text-blue-600 shadow-sm' : 'bg-white/[0.08] text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.1)] border border-cyan-400/20'
                                                    : isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'
                                                    }`}
                                            >
                                                {y}-yil
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 12 Months Grid Layout */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {MONTHS.map((m) => {
                                        const status = getMonthStatus(m, selectedYear)
                                        const isSelected = selectedMonths.includes(m)
                                        return (
                                            <div
                                                key={m}
                                                onClick={() => handleMonthClick(m)}
                                                className={getMonthCardClass(m, status)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-xs font-black tracking-wide ${isSelected ? (isLight ? 'text-blue-600' : 'text-cyan-400') : ''}`}>{m}</span>
                                                    <div className="shrink-0">
                                                        {getStatusIcon(status)}
                                                    </div>
                                                </div>

                                                <div className="mt-2">
                                                    <p className={`text-[8px] font-black uppercase tracking-wider opacity-60`}>Holat</p>
                                                    <p className={`text-[10px] font-bold mt-0.5 ${status === 'paid' || status === 'approved' ? 'text-emerald-500' :
                                                        status === 'waiting' ? 'text-blue-500' :
                                                            status === 'rejected' ? 'text-rose-500' : 'text-slate-400'
                                                        }`}>
                                                        {getStatusLabel(status)}
                                                    </p>
                                                </div>

                                                {isSelected && (
                                                    <div className={`absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full ${isLight ? 'bg-blue-600' : 'bg-cyan-400 animate-ping'}`} />
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-between text-xs border-t pt-4 border-slate-200/40">
                                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Shartnoma to&apos;lovi bo&apos;yicha savollar bormi?</span>
                                <button className="flex items-center gap-1 font-bold text-blue-500 hover:underline">
                                    <HelpCircle size={14} /> Bizga bog&apos;laning
                                </button>
                            </div>
                        </div>

                        {/* Upload Form Card Plate */}
                        <div className="flex flex-col gap-6">
                            {/* Always visible 3D Dropzone plate */}
                            <div className={`rounded-[32px] border p-6 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between ${isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-950/40 border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]'
                                }`}>
                                <div className="absolute top-0 right-0 w-24 h-24 bg-linear-to-bl from-blue-500/10 to-transparent blur-2xl rounded-full" />

                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className={`text-lg font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                            📤 Chek yuklash oynasi
                                        </h3>
                                        <div className={`px-2.5 py-1 rounded-full border text-[9px] font-black uppercase ${isLight ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                                            }`}>
                                            {selectedMonths.length > 0 ? selectedMonths.join(', ') : 'Belgilanmagan'} / {selectedYear}
                                        </div>
                                    </div>

                                    <p className={`text-xs mb-6 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                        Tanlangan oy uchun bank yoki to&apos;lov kvitansiyasini (PDF/Rasm) yuklang.
                                    </p>

                                    {/* Sum Input Plate */}
                                    <div className="mb-5">
                                        <label className={`block text-[9px] font-black uppercase tracking-wider mb-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                            To&apos;lov Summasi (UZS)
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <DollarSign size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
                                            </div>
                                            <input
                                                type="number"
                                                value={amount}
                                                readOnly
                                                className={`w-full pl-8 pr-4 py-2.5 rounded-xl border font-bold transition-all text-sm cursor-not-allowed ${isLight ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-slate-900/60 border-white/5 text-white'
                                                    }`}
                                            />
                                        </div>
                                    </div>

                                    {/* Dropzone */}
                                    <label className={`block cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-300 ${newReceipt
                                        ? 'border-emerald-500/50 bg-emerald-500/[0.02]'
                                        : isLight ? 'border-slate-300 bg-slate-50/50 hover:border-blue-400' : 'border-white/10 bg-white/[0.01] hover:border-cyan-400/50'
                                        }`}>
                                        <input
                                            type="file"
                                            onChange={handleFileSelect}
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            className="hidden"
                                        />
                                        <div className="flex flex-col items-center justify-center">
                                            <Upload className={`mb-3 ${newReceipt ? 'text-emerald-500' : isLight ? 'text-slate-400' : 'text-slate-500'
                                                }`} size={28} />
                                            <p className={`text-xs font-black mb-1 truncate max-w-full ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                {newReceipt ? newReceipt.name : 'Kvitansiya faylini tanlang'}
                                            </p>
                                            <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                                {newReceipt ? `${(newReceipt.size / 1024 / 1024).toFixed(2)} MB` : 'PDF, JPG, JPEG yoki PNG'}
                                            </p>
                                        </div>
                                    </label>
                                </div>

                                <button
                                    onClick={handleUpload}
                                    disabled={!newReceipt || uploading || validating || selectedMonths.length === 0}
                                    className={`w-full mt-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all duration-300 flex items-center justify-center gap-2 ${newReceipt && !uploading && !validating && selectedMonths.length > 0
                                        ? isLight
                                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 hover:scale-102'
                                            : 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-cyan-500/15 hover:scale-102'
                                        : isLight
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                            : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'
                                        }`}
                                >
                                    {validating ? (
                                        <>
                                            <ShieldCheck size={14} className="animate-pulse" />
                                            <span>AI tekshirmoqda...</span>
                                        </>
                                    ) : uploading ? (
                                        <>
                                            <Loader size={14} className="animate-spin" />
                                            <span>Fayl yuklanmoqda...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={14} />
                                            <span>AI tekshiruv + Yuborish</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Uploaded Receipts & Payments History */}
                    <div className={`rounded-[32px] border p-6 backdrop-blur-xl ${isLight ? 'bg-white border-slate-200' : 'bg-slate-950/40 border-white/5'
                        }`}>
                        <div className="flex items-center gap-2 mb-6">
                            <FileText size={18} className={isLight ? 'text-blue-600' : 'text-cyan-400'} />
                            <h3 className={`text-lg font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                Yuklangan cheklar va to&apos;lovlar tarixi
                            </h3>
                        </div>

                        {payments.length === 0 ? (
                            <div className="py-8 text-center">
                                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Hozircha hech qanday chek yuklanmagan.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {payments.map((record) => (
                                    <div
                                        key={record.id}
                                        className={`p-4 rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${isLight ? 'bg-slate-50/50 border-slate-200' : 'bg-white/[0.01] border-white/5'
                                            }`}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2.5 rounded-xl shrink-0 ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/[0.04] text-slate-400'
                                                    }`}>
                                                    <Calendar size={18} />
                                                </div>
                                                <div>
                                                    <h4 className={`text-sm font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                        Chek: {record.month} {record.year}
                                                    </h4>
                                                    <p className={`text-xs mt-1 font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                                        Summa: {record.amount.toLocaleString('uz-UZ')} UZS
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1 ${getStatusColor(record.status)}`}>
                                                    {getStatusIcon(record.status)}
                                                    {getStatusLabel(record.status)}
                                                </span>

                                                {record.receipt_url && (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => viewReceipt(record.receipt_url)}
                                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${isLight ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20'
                                                                }`}
                                                        >
                                                            <Eye size={12} />
                                                            <span>Ko&apos;rish</span>
                                                        </button>
                                                        <a
                                                            href={record.receipt_url}
                                                            download
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                                                                }`}
                                                        >
                                                            <Download size={12} />
                                                            <span>Yuklab olish</span>
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {record.admin_message && (
                                            <div className={`mt-3 p-3 rounded-xl text-xs border ${isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-[#030712]/30 border-white/5 text-slate-300'
                                                }`}>
                                                <span className="font-black">Admin xabari:</span> {record.admin_message}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* AI Validation Result Modal — 3D Premium Glassmorphic */}
                    {mounted && typeof document !== 'undefined' && createPortal(
                        <AnimatePresence>
                            {showValidationModal && validationResult && (
                                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => { setShowValidationModal(false); setValidationResult(null) }}>
                                    {/* Animated backdrop */}
                                    <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />

                                    {/* Floating ambient glow orbs */}
                                    <div className={`absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-[120px] opacity-30 animate-pulse ${validationResult.is_duplicate ? 'bg-rose-600' : validationResult.amount_match === false ? 'bg-amber-500' : validationResult.confidence < 50 ? 'bg-rose-500' : 'bg-emerald-500'
                                        }`} />
                                    <div className={`absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full blur-[100px] opacity-20 animate-pulse ${validationResult.is_duplicate ? 'bg-red-500' : validationResult.amount_match === false ? 'bg-orange-400' : validationResult.confidence < 50 ? 'bg-pink-500' : 'bg-cyan-400'
                                        }`} style={{ animationDelay: '1s' }} />

                                    {/* Modal Card */}
                                    <div
                                        onClick={(e) => e.stopPropagation()}
                                        className={`relative w-full max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto rounded-[32px] shadow-2xl custom-scrollbar ${isLight ? 'shadow-black/20' : 'shadow-black/60'
                                            }`}
                                    >
                                        {/* Gradient Header Strip */}
                                        <div className={`relative h-2 w-full ${validationResult.is_duplicate
                                            ? 'bg-gradient-to-r from-red-600 via-rose-500 to-red-700'
                                            : validationResult.amount_match === false
                                                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500'
                                                : validationResult.confidence < 50
                                                    ? 'bg-gradient-to-r from-rose-500 via-pink-500 to-red-600'
                                                    : 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500'
                                            }`} />

                                        {/* Main content area */}
                                        <div className={`relative p-7 ${isLight
                                            ? 'bg-gradient-to-b from-white via-white to-slate-50'
                                            : 'bg-gradient-to-b from-slate-900 via-[#0c1222] to-slate-950'
                                            }`}>
                                            {/* Inner decorative elements */}
                                            <div className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-[80px] opacity-10 ${validationResult.is_duplicate ? 'bg-rose-500' : validationResult.amount_match === false ? 'bg-amber-400' : validationResult.confidence < 50 ? 'bg-rose-400' : 'bg-emerald-400'
                                                }`} />
                                            <div className={`absolute bottom-0 left-0 w-32 h-32 rounded-full blur-[60px] opacity-[0.06] ${isLight ? 'bg-blue-500' : 'bg-cyan-400'
                                                }`} />

                                            {/* Close Button */}
                                            <button
                                                onClick={() => { setShowValidationModal(false); setValidationResult(null) }}
                                                className={`absolute top-5 right-5 p-2 rounded-2xl border backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:rotate-90 z-10 ${isLight
                                                    ? 'bg-slate-100/80 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-200/80'
                                                    : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:bg-white/10'
                                                    }`}
                                            >
                                                <X size={16} />
                                            </button>

                                            {/* 3D Floating Icon */}
                                            <div className="flex justify-center mb-6">
                                                <div className="relative">
                                                    {/* Glow ring behind icon */}
                                                    <div className={`absolute inset-0 rounded-3xl blur-xl opacity-40 animate-pulse ${validationResult.is_duplicate ? 'bg-rose-600'
                                                        : validationResult.amount_match === false ? 'bg-amber-500'
                                                            : validationResult.confidence < 50 ? 'bg-rose-500' : 'bg-emerald-500'
                                                        }`} />
                                                    <div
                                                        className={`relative p-5 rounded-3xl border-2 ${validationResult.is_duplicate
                                                            ? isLight
                                                                ? 'bg-gradient-to-br from-rose-50 to-red-100 border-rose-400/50 text-rose-600 shadow-[0_20px_40px_-10px_rgba(225,29,72,0.4)]'
                                                                : 'bg-gradient-to-br from-rose-500/20 to-red-500/10 border-rose-500/40 text-rose-400 shadow-[0_20px_40px_-10px_rgba(225,29,72,0.3)]'
                                                            : validationResult.amount_match === false
                                                                ? isLight
                                                                    ? 'bg-gradient-to-br from-amber-50 to-orange-100 border-amber-300/50 text-amber-600 shadow-[0_20px_40px_-10px_rgba(245,158,11,0.35)]'
                                                                    : 'bg-gradient-to-br from-amber-500/15 to-orange-500/10 border-amber-500/30 text-amber-400 shadow-[0_20px_40px_-10px_rgba(245,158,11,0.25)]'
                                                                : validationResult.confidence < 50
                                                                    ? isLight
                                                                        ? 'bg-gradient-to-br from-rose-50 to-pink-100 border-rose-300/50 text-rose-600 shadow-[0_20px_40px_-10px_rgba(244,63,94,0.35)]'
                                                                        : 'bg-gradient-to-br from-rose-500/15 to-pink-500/10 border-rose-500/30 text-rose-400 shadow-[0_20px_40px_-10px_rgba(244,63,94,0.25)]'
                                                                    : isLight
                                                                        ? 'bg-gradient-to-br from-emerald-50 to-cyan-100 border-emerald-300/50 text-emerald-600 shadow-[0_20px_40px_-10px_rgba(16,185,129,0.35)]'
                                                                        : 'bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_20px_40px_-10px_rgba(16,185,129,0.25)]'
                                                            }`}
                                                        style={{ transform: 'translateZ(30px)' }}
                                                    >
                                                        {validationResult.is_duplicate
                                                            ? <ShieldAlert size={32} strokeWidth={2.5} />
                                                            : validationResult.amount_match === false
                                                                ? <AlertTriangle size={32} strokeWidth={2.5} />
                                                                : validationResult.confidence < 50
                                                                    ? <ShieldAlert size={32} strokeWidth={2.5} />
                                                                    : <CheckCircle2 size={32} strokeWidth={2.5} />
                                                        }
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Title */}
                                            <div className="text-center mb-6">
                                                <h3 className={`text-xl font-black tracking-tight mb-1 ${isLight ? 'text-slate-900' : 'text-white'
                                                    }`}>
                                                    {validationResult.is_duplicate
                                                        ? '🚫 Takroriy chek aniqlandi!'
                                                        : validationResult.amount_match === false
                                                            ? 'Summa mos kelmaydi!'
                                                            : validationResult.confidence < 50
                                                                ? 'Chek shubhali!'
                                                                : 'Tekshiruv muvaffaqiyatli'
                                                    }
                                                </h3>
                                                <p className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                                    {validationResult.is_duplicate
                                                        ? '🛡️ Bu chek oldin tizimga yuklangan'
                                                        : '🤖 AI real-vaqt tekshiruvi yakunlandi'
                                                    }
                                                </p>
                                            </div>

                                            {/* 3D Comparison Cards */}
                                            <div className="grid grid-cols-2 gap-3 mb-5">
                                                {/* User declared amount */}
                                                <div
                                                    className={`relative p-4 rounded-2xl border overflow-hidden ${isLight
                                                        ? 'bg-gradient-to-br from-blue-50 to-indigo-50/50 border-blue-200/60 shadow-[0_8px_24px_-6px_rgba(59,130,246,0.15)]'
                                                        : 'bg-gradient-to-br from-blue-500/[0.08] to-indigo-500/[0.04] border-blue-500/20 shadow-[0_8px_24px_-6px_rgba(59,130,246,0.15)]'
                                                        }`}
                                                >
                                                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-400/10 rounded-full blur-xl" />
                                                    <div className="flex items-center gap-1.5 mb-2">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-blue-500' : 'bg-blue-400'}`} />
                                                        <p className={`text-[8px] font-black uppercase tracking-widest ${isLight ? 'text-blue-600' : 'text-blue-400'
                                                            }`}>Siz kiritgan</p>
                                                    </div>
                                                    <p className={`text-xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                        {amount.toLocaleString('uz-UZ')}
                                                    </p>
                                                    <p className={`text-[9px] font-bold mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>UZS</p>
                                                </div>

                                                {/* AI extracted amount */}
                                                <div
                                                    className={`relative p-4 rounded-2xl border overflow-hidden ${validationResult.amount_match === false
                                                        ? isLight
                                                            ? 'bg-gradient-to-br from-amber-50 to-orange-50/50 border-amber-300/60 shadow-[0_8px_24px_-6px_rgba(245,158,11,0.2)]'
                                                            : 'bg-gradient-to-br from-amber-500/[0.08] to-orange-500/[0.04] border-amber-500/25 shadow-[0_8px_24px_-6px_rgba(245,158,11,0.2)]'
                                                        : isLight
                                                            ? 'bg-gradient-to-br from-emerald-50 to-teal-50/50 border-emerald-200/60 shadow-[0_8px_24px_-6px_rgba(16,185,129,0.15)]'
                                                            : 'bg-gradient-to-br from-emerald-500/[0.08] to-teal-500/[0.04] border-emerald-500/20 shadow-[0_8px_24px_-6px_rgba(16,185,129,0.15)]'
                                                        }`}
                                                >
                                                    <div className={`absolute top-0 right-0 w-16 h-16 rounded-full blur-xl ${validationResult.amount_match === false ? 'bg-amber-400/10' : 'bg-emerald-400/10'
                                                        }`} />
                                                    <div className="flex items-center gap-1.5 mb-2">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${validationResult.amount_match === false
                                                            ? 'bg-amber-500 animate-pulse'
                                                            : isLight ? 'bg-emerald-500' : 'bg-emerald-400'
                                                            }`} />
                                                        <p className={`text-[8px] font-black uppercase tracking-widest ${validationResult.amount_match === false
                                                            ? 'text-amber-600'
                                                            : isLight ? 'text-emerald-600' : 'text-emerald-400'
                                                            }`}>Chekdagi (AI)</p>
                                                    </div>
                                                    <p className={`text-xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                        {validationResult.extracted_amount
                                                            ? validationResult.extracted_amount.toLocaleString('uz-UZ')
                                                            : '—'
                                                        }
                                                    </p>
                                                    <p className={`text-[9px] font-bold mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>UZS</p>
                                                </div>
                                            </div>

                                            {/* Mismatch difference banner */}
                                            {validationResult.amount_match === false && validationResult.extracted_amount && (
                                                <div className={`mb-5 p-3.5 rounded-2xl border flex items-center gap-3 ${isLight
                                                    ? 'bg-gradient-to-r from-rose-50 to-amber-50 border-rose-200/60'
                                                    : 'bg-gradient-to-r from-rose-500/[0.06] to-amber-500/[0.04] border-rose-500/15'
                                                    }`}>
                                                    <div className={`p-2 rounded-xl shrink-0 ${isLight ? 'bg-rose-100 text-rose-600' : 'bg-rose-500/15 text-rose-400'
                                                        }`}>
                                                        <AlertCircle size={16} />
                                                    </div>
                                                    <div>
                                                        <p className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-rose-600' : 'text-rose-400'
                                                            }`}>Farq aniqlandi</p>
                                                        <p className={`text-sm font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                            {Math.abs(validationResult.extracted_amount - amount).toLocaleString('uz-UZ')} UZS
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* 3D Confidence Gauge */}
                                            <div className={`relative p-4 rounded-2xl border mb-5 overflow-hidden ${isLight
                                                ? 'bg-gradient-to-br from-slate-50 to-white border-slate-200/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)]'
                                                : 'bg-gradient-to-br from-white/[0.03] to-white/[0.01] border-white/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]'
                                                }`}>
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <ShieldCheck size={13} className={
                                                            validationResult.confidence >= 80 ? 'text-emerald-500' :
                                                                validationResult.confidence >= 50 ? 'text-amber-500' : 'text-rose-500'
                                                        } />
                                                        <span className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'
                                                            }`}>Ishonchlilik darajasi</span>
                                                    </div>
                                                    <div className={`px-2.5 py-1 rounded-xl text-xs font-black ${validationResult.confidence >= 80
                                                        ? isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400'
                                                        : validationResult.confidence >= 50
                                                            ? isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-400'
                                                            : isLight ? 'bg-rose-100 text-rose-700' : 'bg-rose-500/15 text-rose-400'
                                                        }`}>
                                                        {validationResult.confidence}%
                                                    </div>
                                                </div>
                                                {/* Track */}
                                                <div className={`w-full h-3 rounded-full overflow-hidden ${isLight ? 'bg-slate-200/80' : 'bg-white/[0.06]'
                                                    }`}>
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-1000 ease-out relative ${validationResult.confidence >= 80
                                                            ? 'bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                                                            : validationResult.confidence >= 50
                                                                ? 'bg-gradient-to-r from-amber-500 to-orange-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                                                                : 'bg-gradient-to-r from-rose-500 to-pink-400 shadow-[0_0_12px_rgba(244,63,94,0.5)]'
                                                            }`}
                                                        style={{ width: `${validationResult.confidence}%` }}
                                                    >
                                                        {/* Shine effect */}
                                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-full" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* AI Analysis — frosted panel */}
                                            {validationResult.analysis && (
                                                <div className={`relative p-4 rounded-2xl border mb-6 overflow-hidden ${isLight
                                                    ? 'bg-gradient-to-br from-indigo-50/40 to-blue-50/30 border-indigo-200/40'
                                                    : 'bg-gradient-to-br from-indigo-500/[0.04] to-blue-500/[0.02] border-indigo-500/10'
                                                    }`}>
                                                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-400/20 to-transparent" />
                                                    <div className="flex items-center gap-2 mb-2.5">
                                                        <div className={`p-1.5 rounded-lg ${isLight ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/15 text-indigo-400'
                                                            }`}>
                                                            <ShieldCheck size={11} />
                                                        </div>
                                                        <p className={`text-[8px] font-black uppercase tracking-widest ${isLight ? 'text-indigo-500' : 'text-indigo-400'
                                                            }`}>AI xulosasi</p>
                                                    </div>
                                                    <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'
                                                        }`}>{validationResult.analysis}</p>
                                                </div>
                                            )}

                                            {/* Instruction text for mismatch or duplicate */}
                                            {(validationResult.is_duplicate || validationResult.amount_match === false || validationResult.confidence < 50) && (
                                                <div className={`text-center mb-5 p-3.5 rounded-2xl ${validationResult.is_duplicate
                                                    ? isLight ? 'bg-rose-50/80' : 'bg-rose-500/[0.06]'
                                                    : isLight ? 'bg-amber-50/60' : 'bg-amber-500/[0.04]'
                                                    }`}>
                                                    <p className={`text-[11px] font-bold leading-relaxed ${validationResult.is_duplicate
                                                        ? isLight ? 'text-rose-800' : 'text-rose-300/90'
                                                        : isLight ? 'text-amber-800' : 'text-amber-300/90'
                                                        }`}>
                                                        {validationResult.is_duplicate
                                                            ? '🚫 Bu chek oldin yuklangan! Boshqa chekni tanlang yoki to\'lov haqida ma\'muriyatga murojaat qiling.'
                                                            : '⚠️ Iltimos, to\'lov summasini to\'g\'rilab qayta yuklang yoki to\'g\'ri chekni tanlang.'
                                                        }
                                                    </p>
                                                </div>
                                            )}

                                            {/* Single Close Button — 3D style */}
                                            <button
                                                onClick={() => { setShowValidationModal(false); setValidationResult(null) }}
                                                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300 border ${validationResult.amount_match === false || validationResult.confidence < 50
                                                    ? isLight
                                                        ? 'bg-gradient-to-b from-slate-100 to-slate-200 border-slate-300 text-slate-700 hover:from-slate-200 hover:to-slate-300 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]'
                                                        : 'bg-gradient-to-b from-white/10 to-white/5 border-white/10 text-slate-200 hover:from-white/15 hover:to-white/10 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]'
                                                    : isLight
                                                        ? 'bg-gradient-to-b from-blue-500 to-blue-600 border-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-[0_8px_24px_-4px_rgba(59,130,246,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]'
                                                        : 'bg-gradient-to-b from-cyan-400 to-cyan-500 border-cyan-500/50 text-slate-950 hover:from-cyan-300 hover:to-cyan-400 shadow-[0_8px_24px_-4px_rgba(34,211,238,0.35),inset_0_1px_0_rgba(255,255,255,0.3)]'
                                                    }`}
                                                style={{ transform: 'perspective(500px) translateZ(0)', transition: 'all 0.3s, transform 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.transform = 'perspective(500px) translateZ(4px)'}
                                                onMouseLeave={(e) => e.currentTarget.style.transform = 'perspective(500px) translateZ(0)'}
                                            >
                                                {validationResult.amount_match === false || validationResult.confidence < 50
                                                    ? 'Tushundim, yopish'
                                                    : 'Yaxshi, yopish ✓'
                                                }
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </AnimatePresence>,
                        document.body
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    )
}
