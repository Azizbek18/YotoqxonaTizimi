'use client'

import React, { useState } from 'react'
import {
    Plus, Download, Edit2, Trash2, Send, Sparkles,
    FileText, CheckCircle, Clock, AlertCircle
} from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'

interface Application {
    id: number
    type: 'ariza' | 'tushuntirish'
    title: string
    reason: string
    content: string
    createdDate: string
    status: 'draft' | 'submitted' | 'approved' | 'rejected'
    aiGenerated: boolean
    adminResponse?: string
    responseDate?: string
}

export default function ArizalarPage() {
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'

    const [applications, setApplications] = useState<Application[]>([
        {
            id: 1,
            type: 'ariza',
            title: 'Turarjoyni o\'zgartirish',
            reason: 'Shaxsiy sabablarga ko\'ra turgan joyin o\'zgartirish kerak',
            content: `Farg'ona Davlat Universiteti Rektori bilan
      
Iltimos!

Men, __________ (F.I.O), talaba ID __________, sizga murojaat qilyapman.

Shaxsiy sabablarga ko\'ra tarbiyaviy korxonaning turgan joyin o\'zgartirish haqida ariza topshiryapman. Buning uchun quyidagi sabablarga asoslanmoqda:

1. Shaxsiy sog\'liq-salomatlik muammolari
2. Oilani zarar etuvchi sharoitlar
3. Malakali ta\'lim olishni xavf ostiga qo\'yma

Ushbu arizani ijobiy qariy olishingizni iltimos qilyapman.

Hurmatni bilan,
Arizachi: __________
Sana: 2026-05-09`,
            createdDate: '2026-05-08',
            status: 'submitted',
            aiGenerated: true,
            adminResponse: 'Ariza admin boshliga jonatildi. 2-3 kun ichida javob olasiz.',
            responseDate: '2026-05-09'
        },
        {
            id: 2,
            type: 'tushuntirish',
            title: 'Kemchilik haqida tushuntirish',
            reason: 'Dars vaqtida ishtiroki kam bo\'lgani uchun tushuntirish yozish',
            content: `Farg'ona Davlat Universiteti Rektori bilan

Iltimos!

Men, __________ (F.I.O), talaba ID __________, sizga murojaat qilyapman.

Kemchil dars vaqtiga toliqligi haqida tushuntirish taqdim qilyapman.

Sabablari:
1. Shaxsiy sog\'liq-salomatlik muammolari bo\'ldi
2. Vaqtinchalik tashrifxona ta\'tiliga yuborilgan edim
3. Doktor tavsiyasi bo\'yicha uyda qo\'l tutuv kerak edi

Bundan keyin dars vaqtiga to\'g\'ri qo\'lga o\'timasligimni kafolatlayman.

Hurmatni bilan,
Murojachhchi: __________
Sana: 2026-05-07`,
            createdDate: '2026-05-07',
            status: 'approved',
            aiGenerated: true,
            adminResponse: 'Tushuntirish qabul qilindi. Rekord yuklab olindi.',
            responseDate: '2026-05-08'
        }
    ])

    const [showNewForm, setShowNewForm] = useState(false)
    const [selectedApp, setSelectedApp] = useState<Application | null>(null)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)

    const [newAppForm, setNewAppForm] = useState({
        type: 'ariza' as 'ariza' | 'tushuntirish',
        title: '',
        reason: ''
    })

    const generateWithAI = async () => {
        if (!newAppForm.title || !newAppForm.reason) {
            alert('Iltimos, sarlavha va sababni kiriting')
            return
        }

        setIsGenerating(true)
        // Simulate AI generation
        setTimeout(() => {
            const newApp: Application = {
                id: Math.max(...applications.map(a => a.id), 0) + 1,
                type: newAppForm.type,
                title: newAppForm.title,
                reason: newAppForm.reason,
                content: generateAIContent(newAppForm),
                createdDate: new Date().toISOString().split('T')[0],
                status: 'draft',
                aiGenerated: true
            }

            setApplications([newApp, ...applications])
            setNewAppForm({ type: 'ariza', title: '', reason: '' })
            setShowNewForm(false)
            setIsGenerating(false)
        }, 1500)
    }

    const generateAIContent = (form: { type: string; title: string; reason: string }) => {
        const prefix = form.type === 'ariza'
            ? `Farg'ona Davlat Universiteti Rektori bilan\n\nIltimos!\n\nMen, __________ (F.I.O), talaba ID __________, sizga murojaat qilyapman.\n\n${form.title} haqida ariza topshiryapman.`
            : `Farg'ona Davlat Universiteti Rektori bilan\n\nIltimos!\n\nMen, __________ (F.I.O), talaba ID __________, sizga murojaat qilyapman.\n\n${form.title} haqida tushuntirish taqdim qilyapman.`

        return `${prefix}\n\nSabablari:\n${form.reason}\n\nBundan keyin barcha qoidalarga amal qilamdan kafolatlayman.\n\nHurmatni bilan,\nMurojachhchi: __________\nSana: ${new Date().toISOString().split('T')[0]}`
    }

    const downloadPDF = (app: Application) => {
        // Simulate PDF download
        const element = document.createElement('a')
        const file = new Blob([app.content], { type: 'text/plain' })
        element.href = URL.createObjectURL(file)
        element.download = `${app.type}_${app.id}.pdf`
        document.body.appendChild(element)
        element.click()
        document.body.removeChild(element)
    }

    const deleteApp = (id: number) => {
        if (confirm('Rostanham o\'chirmoqchisiz?')) {
            setApplications(applications.filter(a => a.id !== id))
        }
    }

    const submitApp = (app: Application) => {
        setApplications(applications.map(a =>
            a.id === app.id ? { ...a, status: 'submitted' as const } : a
        ))
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft':
                return isLight ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-yellow-900/20 text-yellow-400 border-yellow-800'
            case 'submitted':
                return isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-900/20 text-blue-400 border-blue-800'
            case 'approved':
                return isLight ? 'bg-green-50 text-green-700 border-green-200' : 'bg-green-900/20 text-green-400 border-green-800'
            case 'rejected':
                return isLight ? 'bg-red-50 text-red-700 border-red-200' : 'bg-red-900/20 text-red-400 border-red-800'
            default:
                return isLight ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-slate-900/20 text-slate-400 border-slate-800'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'draft':
                return <Edit2 size={16} />
            case 'submitted':
                return <Clock size={16} />
            case 'approved':
                return <CheckCircle size={16} />
            case 'rejected':
                return <AlertCircle size={16} />
            default:
                return <FileText size={16} />
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'draft':
                return 'Qoralamasi'
            case 'submitted':
                return 'Yuborildi'
            case 'approved':
                return 'Tasdiqlandi'
            case 'rejected':
                return 'Rad etildi'
            default:
                return status
        }
    }

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div>
                <h1 className={`text-3xl font-black mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    📋 Arizalar va Tushuntirishlar
                </h1>
                <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    AI yordamida ariza yozing va PDF formatida yuklab oling
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-2xl backdrop-blur-xl transition-all ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900/40 border border-white/10'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Jami</p>
                    <p className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{applications.length}</p>
                </div>
                <div className={`p-4 rounded-2xl backdrop-blur-xl transition-all ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900/40 border border-white/10'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Qoralamasi</p>
                    <p className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{applications.filter(a => a.status === 'draft').length}</p>
                </div>
                <div className={`p-4 rounded-2xl backdrop-blur-xl transition-all ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900/40 border border-white/10'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Tasdiqlandi</p>
                    <p className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{applications.filter(a => a.status === 'approved').length}</p>
                </div>
                <div className={`p-4 rounded-2xl backdrop-blur-xl transition-all ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900/40 border border-white/10'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Yuborildi</p>
                    <p className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{applications.filter(a => a.status === 'submitted').length}</p>
                </div>
            </div>

            {/* Create New Application Button */}
            <div className={`rounded-2xl backdrop-blur-xl p-6 transition-all ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900/40 border border-white/10'}`}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-lg font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        ✨ Yangi Ariza Yaratish
                    </h2>
                    <button
                        onClick={() => setShowNewForm(!showNewForm)}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${isLight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-cyan-600 text-white hover:bg-cyan-700'}`}
                    >
                        <Plus size={18} /> Yangi
                    </button>
                </div>

                {showNewForm && (
                    <div className={`p-4 rounded-lg border-2 ${isLight ? 'border-slate-300 bg-slate-50' : 'border-slate-700 bg-slate-950/30'}`}>
                        <div className="space-y-4">
                            <div>
                                <label className={`block text-sm font-semibold mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                    Tur tanlang
                                </label>
                                <select
                                    value={newAppForm.type}
                                    onChange={(e) => setNewAppForm({ ...newAppForm, type: e.target.value as 'ariza' | 'tushuntirish' })}
                                    className={`w-full px-3 py-2 rounded-lg border transition-all ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500' : 'bg-slate-800 border-slate-700 text-white focus:border-cyan-500'}`}
                                >
                                    <option value="ariza">Ariza</option>
                                    <option value="tushuntirish">Tushuntirish</option>
                                </select>
                            </div>

                            <div>
                                <label className={`block text-sm font-semibold mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                    Sarlavha
                                </label>
                                <input
                                    type="text"
                                    placeholder="Masalan: Turarjoyni o'zgartirish"
                                    value={newAppForm.title}
                                    onChange={(e) => setNewAppForm({ ...newAppForm, title: e.target.value })}
                                    className={`w-full px-3 py-2 rounded-lg border transition-all ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 placeholder-slate-500' : 'bg-slate-800 border-slate-700 text-white focus:border-cyan-500 placeholder-slate-500'}`}
                                />
                            </div>

                            <div>
                                <label className={`block text-sm font-semibold mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                    Sababi
                                </label>
                                <textarea
                                    placeholder="Masalan: Shaxsiy sog'liq-salomatlik muammolari bo'ldi..."
                                    value={newAppForm.reason}
                                    onChange={(e) => setNewAppForm({ ...newAppForm, reason: e.target.value })}
                                    rows={3}
                                    className={`w-full px-3 py-2 rounded-lg border transition-all ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 placeholder-slate-500' : 'bg-slate-800 border-slate-700 text-white focus:border-cyan-500 placeholder-slate-500'}`}
                                />
                            </div>

                            <button
                                onClick={generateWithAI}
                                disabled={isGenerating || !newAppForm.title || !newAppForm.reason}
                                className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${isGenerating || !newAppForm.title || !newAppForm.reason
                                    ? isLight
                                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    : isLight
                                        ? 'bg-linear-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg'
                                        : 'bg-linear-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg'
                                    }`}
                            >
                                <Sparkles size={18} />
                                {isGenerating ? 'AI yaratmoqda...' : 'AI bilan Yaratish'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Applications List */}
            <div className={`rounded-2xl backdrop-blur-xl p-6 transition-all ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900/40 border border-white/10'}`}>
                <h2 className={`text-lg font-black mb-4 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    📄 Arizalarning Ro&apos;yxati
                </h2>

                {applications.length === 0 ? (
                    <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        Hali ariza yaratilmagan
                    </p>
                ) : (
                    <div className="space-y-3">
                        {applications.map((app) => (
                            <div
                                key={app.id}
                                className={`p-4 rounded-lg border transition-all hover:shadow-md cursor-pointer ${isLight ? 'bg-slate-50 border-slate-200 hover:bg-white' : 'bg-slate-800/30 border-slate-700 hover:bg-slate-800/50'}`}
                                onClick={() => {
                                    setSelectedApp(app)
                                    setShowDetailModal(true)
                                }}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <FileText size={18} className={isLight ? 'text-slate-500' : 'text-slate-400'} />
                                            <h3 className={`font-bold text-sm break-all ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                {app.title}
                                            </h3>
                                            {app.aiGenerated && (
                                                <span className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 whitespace-nowrap ${isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-900/30 text-purple-400'}`}>
                                                    <Sparkles size={12} /> AI
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                            {app.type === 'ariza' ? '📋 Ariza' : '📝 Tushuntirish'} • 📅 {new Date(app.createdDate).toLocaleDateString('uz-UZ')}
                                        </p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 whitespace-nowrap ${getStatusColor(app.status)}`}>
                                        {getStatusIcon(app.status)}
                                        {getStatusLabel(app.status)}
                                    </span>
                                </div>

                                <p className={`text-xs line-clamp-2 mb-3 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                    {app.reason}
                                </p>

                                {app.adminResponse && (
                                    <div className={`p-3 rounded-lg text-xs mb-3 border ${isLight ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-blue-900/20 border-blue-800 text-blue-300'}`}>
                                        <p className="font-semibold mb-1">Admin xabari:</p>
                                        <p>{app.adminResponse}</p>
                                    </div>
                                )}

                                <div className="flex gap-2 flex-wrap">
                                    {app.status === 'draft' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                submitApp(app)
                                            }}
                                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${isLight ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'}`}
                                        >
                                            <Send size={12} className="inline mr-1" /> Yuborish
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            downloadPDF(app)
                                        }}
                                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${isLight ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50'}`}
                                    >
                                        <Download size={12} className="inline mr-1" /> PDF
                                    </button>
                                    {app.status === 'draft' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setEditingApp(app)
                                            }}
                                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${isLight ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50'}`}
                                        >
                                            <Edit2 size={12} className="inline mr-1" /> Tahrir
                                        </button>
                                    )}
                                    {app.status === 'draft' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                deleteApp(app.id)
                                            }}
                                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${isLight ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-red-900/30 text-red-400 hover:bg-red-900/50'}`}
                                        >
                                            <Trash2 size={12} className="inline mr-1" /> O&apos;chirish
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {showDetailModal && selectedApp && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setShowDetailModal(false)}
                >
                    <div
                        className={`rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 ${isLight ? 'bg-white' : 'bg-slate-900'}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className={`text-xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                    {selectedApp.title}
                                </h2>
                                <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                    {selectedApp.type === 'ariza' ? '📋 Ariza' : '📝 Tushuntirish'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className={`text-2xl font-bold ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
                            >
                                ✕
                            </button>
                        </div>

                        <div className={`p-4 rounded-lg mb-4 whitespace-pre-wrap text-sm font-mono ${isLight ? 'bg-slate-50 border border-slate-200 text-slate-700' : 'bg-slate-800/50 border border-slate-700 text-slate-300'}`}>
                            {selectedApp.content}
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => downloadPDF(selectedApp)}
                                className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${isLight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-cyan-600 text-white hover:bg-cyan-700'}`}
                            >
                                <Download size={18} /> PDF Yuklab Olish
                            </button>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className={`px-4 py-2 rounded-lg font-semibold transition-all ${isLight ? 'bg-slate-200 text-slate-900 hover:bg-slate-300' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
                            >
                                Yopish
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
