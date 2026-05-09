'use client'

import React, { useState } from 'react'
import {
    Upload, Check, Clock, AlertCircle, Download, Eye,
    Calendar, DollarSign, TrendingUp, FileText
} from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'

interface PaymentRecord {
    id: number
    month: string
    year: number
    amount: number
    status: 'paid' | 'pending' | 'rejected'
    uploadDate?: string
    receiptFile?: string
    adminResponse?: string
    adminResponseDate?: string
}

interface Receipt {
    id: number
    file: string
    uploadDate: string
    status: 'waiting' | 'approved' | 'rejected'
    adminMessage?: string
}

export default function TolovaPage() {
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'

    const [receipts, setReceipts] = useState<Receipt[]>([
        {
            id: 1,
            file: 'tolova_cheki_12_2025.pdf',
            uploadDate: '2025-12-10',
            status: 'approved',
            adminMessage: 'Chek tasdiqlandi'
        },
        {
            id: 2,
            file: 'tolova_cheki_11_2025.pdf',
            uploadDate: '2025-11-15',
            status: 'waiting',
            adminMessage: 'Tekshirilyapti...'
        }
    ])

    const [paymentHistory] = useState<PaymentRecord[]>([
        { id: 1, month: 'Yanvar', year: 2026, amount: 500000, status: 'paid' },
        { id: 2, month: 'Fevral', year: 2026, amount: 500000, status: 'paid' },
        { id: 3, month: 'Mart', year: 2026, amount: 500000, status: 'pending' },
        { id: 4, month: 'Aprel', year: 2026, amount: 500000, status: 'pending' },
        { id: 5, month: 'May', year: 2026, amount: 500000, status: 'pending' },
        { id: 6, month: 'Iyun', year: 2026, amount: 500000, status: 'pending' },
    ])

    const [newReceipt, setNewReceipt] = useState<File | null>(null)
    const [showUploadForm, setShowUploadForm] = useState(false)

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setNewReceipt(e.target.files[0])
        }
    }

    const handleUpload = () => {
        if (newReceipt) {
            const receipt: Receipt = {
                id: receipts.length + 1,
                file: newReceipt.name,
                uploadDate: new Date().toISOString().split('T')[0],
                status: 'waiting',
                adminMessage: 'Tekshirilyapti...'
            }
            setReceipts([receipt, ...receipts])
            setNewReceipt(null)
            setShowUploadForm(false)
        }
    }

    const paidMonths = paymentHistory.filter(p => p.status === 'paid').length
    const pendingMonths = paymentHistory.filter(p => p.status === 'pending').length
    const totalAmount = paymentHistory.reduce((sum, p) => sum + p.amount, 0)
    const paidAmount = paymentHistory.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid':
                return isLight ? 'bg-green-50 text-green-700 border-green-200' : 'bg-green-900/20 text-green-400 border-green-800'
            case 'pending':
                return isLight ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-yellow-900/20 text-yellow-400 border-yellow-800'
            case 'rejected':
                return isLight ? 'bg-red-50 text-red-700 border-red-200' : 'bg-red-900/20 text-red-400 border-red-800'
            case 'approved':
                return isLight ? 'bg-green-50 text-green-700 border-green-200' : 'bg-green-900/20 text-green-400 border-green-800'
            case 'waiting':
                return isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-900/20 text-blue-400 border-blue-800'
            default:
                return isLight ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-slate-900/20 text-slate-400 border-slate-800'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'paid':
            case 'approved':
                return <Check size={18} />
            case 'pending':
            case 'waiting':
                return <Clock size={18} />
            case 'rejected':
                return <AlertCircle size={18} />
            default:
                return <FileText size={18} />
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'paid':
                return 'To\'landi'
            case 'pending':
                return 'Kutilmoqda'
            case 'rejected':
                return 'Rad etildi'
            case 'approved':
                return 'Tasdiqlandi'
            case 'waiting':
                return 'Tekshirilyapti'
            default:
                return status
        }
    }

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div>
                <h1 className={`text-3xl font-black mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    💳 To&apos;lov Boshqaruvi
                </h1>
                <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    To&apos;lov chekini yuklash, holatini kuzatish va xabarlarni olish
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-2xl backdrop-blur-xl transition-all ${isLight ? 'bg-white border border-slate-200 hover:border-blue-300' : 'bg-slate-900/40 border border-white/10 hover:border-cyan-400/30'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs font-bold uppercase tracking-wide ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>To&apos;langan oylar</span>
                        <Check className={isLight ? 'text-green-600' : 'text-green-400'} size={20} />
                    </div>
                    <p className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{paidMonths}</p>
                    <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>6 dan {paidMonths}ta</p>
                </div>

                <div className={`p-4 rounded-2xl backdrop-blur-xl transition-all ${isLight ? 'bg-white border border-slate-200 hover:border-yellow-300' : 'bg-slate-900/40 border border-white/10 hover:border-yellow-400/30'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs font-bold uppercase tracking-wide ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Kutilayotgan oylar</span>
                        <Clock className={isLight ? 'text-yellow-600' : 'text-yellow-400'} size={20} />
                    </div>
                    <p className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{pendingMonths}</p>
                    <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>To&apos;lash kerak</p>
                </div>

                <div className={`p-4 rounded-2xl backdrop-blur-xl transition-all ${isLight ? 'bg-white border border-slate-200 hover:border-green-300' : 'bg-slate-900/40 border border-white/10 hover:border-green-400/30'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs font-bold uppercase tracking-wide ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>To&apos;langan summa</span>
                        <DollarSign className={isLight ? 'text-emerald-600' : 'text-emerald-400'} size={20} />
                    </div>
                    <p className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{(paidAmount / 1000000).toFixed(1)}M</p>
                    <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>{(totalAmount / 1000000).toFixed(1)}M dan</p>
                </div>

                <div className={`p-4 rounded-2xl backdrop-blur-xl transition-all ${isLight ? 'bg-white border border-slate-200 hover:border-purple-300' : 'bg-slate-900/40 border border-white/10 hover:border-purple-400/30'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs font-bold uppercase tracking-wide ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Progress</span>
                        <TrendingUp className={isLight ? 'text-purple-600' : 'text-purple-400'} size={20} />
                    </div>
                    <p className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{Math.round((paidAmount / totalAmount) * 100)}%</p>
                    <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Yakunlangan</p>
                </div>
            </div>

            {/* Upload Receipt Section */}
            <div className={`rounded-2xl backdrop-blur-xl p-6 transition-all ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900/40 border border-white/10'}`}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-lg font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        📄 Chek Yuklash
                    </h2>
                    <button
                        onClick={() => setShowUploadForm(!showUploadForm)}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${isLight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-cyan-600 text-white hover:bg-cyan-700'}`}
                    >
                        {showUploadForm ? 'Bekor qilish' : '+ Yangi Chek'}
                    </button>
                </div>

                {showUploadForm && (
                    <div className={`p-4 rounded-lg border-2 border-dashed mb-4 transition-all ${isLight ? 'border-slate-300 bg-slate-50' : 'border-slate-700 bg-slate-950/30'}`}>
                        <label className="cursor-pointer">
                            <div className="flex flex-col items-center justify-center py-8">
                                <Upload className={`${isLight ? 'text-slate-400' : 'text-slate-500'} mb-3`} size={32} />
                                <p className={`font-semibold mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                    Chek faylini tanlang
                                </p>
                                <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                    (PDF yoki Rasm formati)
                                </p>
                            </div>
                            <input
                                type="file"
                                onChange={handleFileSelect}
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                            />
                        </label>

                        {newReceipt && (
                            <div className={`mt-4 p-3 rounded-lg ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-800/50 border border-slate-700'}`}>
                                <p className={`font-semibold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                    ✅ Tanlangan fayl: {newReceipt.name}
                                </p>
                            </div>
                        )}

                        <button
                            onClick={handleUpload}
                            disabled={!newReceipt}
                            className={`w-full mt-4 py-3 rounded-lg font-semibold transition-all ${newReceipt
                                ? isLight
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                : isLight
                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                }`}
                        >
                            Yuklash
                        </button>
                    </div>
                )}

                {/* Recent Receipts */}
                <div className="space-y-3">
                    <h3 className={`text-sm font-bold uppercase tracking-wide mb-3 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        Yuklangan cheklar
                    </h3>
                    {receipts.length === 0 ? (
                        <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                            Hali chek yuklanmagan
                        </p>
                    ) : (
                        receipts.map((receipt) => (
                            <div
                                key={receipt.id}
                                className={`p-4 rounded-lg border transition-all hover:shadow-md ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/30 border-slate-700'}`}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-start gap-3 flex-1">
                                        <FileText className={`${isLight ? 'text-slate-500' : 'text-slate-400'} mt-1`} size={20} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-semibold text-sm break-all ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                {receipt.file}
                                            </p>
                                            <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                                📅 {new Date(receipt.uploadDate).toLocaleDateString('uz-UZ')}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 whitespace-nowrap ${getStatusColor(receipt.status)}`}>
                                        {getStatusIcon(receipt.status)}
                                        {getStatusLabel(receipt.status)}
                                    </span>
                                </div>

                                {receipt.adminMessage && (
                                    <div className={`p-3 rounded-lg text-xs ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900/40 border border-slate-700'}`}>
                                        <p className={`font-semibold mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>Admin xabari:</p>
                                        <p className={isLight ? 'text-slate-700' : 'text-slate-300'}>{receipt.adminMessage}</p>
                                    </div>
                                )}

                                <div className="flex gap-2 mt-3">
                                    <button className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isLight ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-blue-900/20 text-blue-400 hover:bg-blue-900/30'}`}>
                                        <Eye size={14} className="inline mr-1" /> Ko&apos;rish
                                    </button>
                                    <button className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'}`}>
                                        <Download size={14} className="inline mr-1" /> Yuklab olish
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Payment History */}
            <div className={`rounded-2xl backdrop-blur-xl p-6 transition-all ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900/40 border border-white/10'}`}>
                <h2 className={`text-lg font-black mb-4 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    📊 To&apos;lov Tarixi
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={`border-b ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
                                <th className={`text-left py-3 px-3 font-bold uppercase tracking-wider text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                    Oy
                                </th>
                                <th className={`text-left py-3 px-3 font-bold uppercase tracking-wider text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                    Summa
                                </th>
                                <th className={`text-left py-3 px-3 font-bold uppercase tracking-wider text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                    Holat
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {paymentHistory.map((record) => (
                                <tr
                                    key={record.id}
                                    className={`border-b transition-all hover:bg-opacity-50 ${isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-slate-800 hover:bg-slate-800/30'}`}
                                >
                                    <td className={`py-4 px-3 font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                        <Calendar size={16} className="inline mr-2" />
                                        {record.month} {record.year}
                                    </td>
                                    <td className={`py-4 px-3 font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                        {record.amount.toLocaleString('uz-UZ')} so&apos;m
                                    </td>
                                    <td className="py-4 px-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1 ${getStatusColor(record.status)}`}>
                                            {getStatusIcon(record.status)}
                                            {getStatusLabel(record.status)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Legend */}
            <div className={`rounded-2xl backdrop-blur-xl p-4 transition-all ${isLight ? 'bg-blue-50 border border-blue-200' : 'bg-blue-900/20 border border-blue-800'}`}>
                <p className={`text-xs font-semibold mb-3 ${isLight ? 'text-blue-900' : 'text-blue-300'}`}>
                    ℹ️ Ma&apos;lumot
                </p>
                <ul className={`text-xs space-y-2 ${isLight ? 'text-blue-800' : 'text-blue-300'}`}>
                    <li>✅ <strong>To&apos;landi/Tasdiqlandi:</strong> To&apos;lov muvaffaqiyatli o&apos;tkazildi yoki admin tasdiqladi</li>
                    <li>⏳ <strong>Kutilmoqda/Tekshirilyapti:</strong> To&apos;lov jarayonida yoki admin tekshiryapti</li>
                    <li>❌ <strong>Rad etildi:</strong> To&apos;lov rad etildi, qayta o&apos;tkazing</li>
                </ul>
            </div>
        </div>
    )
}
