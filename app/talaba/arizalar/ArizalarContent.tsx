'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
    Plus, Download, Edit2, Trash2, Send, Sparkles,
    FileText, CheckCircle, Clock, AlertCircle
} from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'
import { supabase } from '@/lib/supabase'
import { getSafeUser } from '@/lib/auth-session'
import { User } from '@supabase/supabase-js'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import CustomSelect from '@/components/ui/CustomSelect'
import { useConfirmModal } from '@/lib/hooks/useConfirmModal'

interface Profile {
    id: string
    full_name: string
    email: string
    phone_number?: string
    faculty?: string
    role?: string
    room_number?: string
    course?: string | number
    group?: string | number
    avatar_url?: string
    is_floor_captain?: boolean
    assigned_floor?: number
    gender?: string
    warning_count?: number
    blacklisted?: boolean
    direction?: string
}

interface Application {
    id: string | number
    type: 'ariza' | 'tushuntirish'
    title: string
    reason: string
    content: string
    createdDate: string
    status: 'draft' | 'submitted' | 'pending' | 'approved' | 'rejected'
    aiGenerated: boolean
    adminResponse?: string
    responseDate?: string
}

export default function ArizalarContent() {
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'

    const [applications, setApplications] = useState<Application[]>([])
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<User | null>(null)
    const [studentProfile, setStudentProfile] = useState<Profile | null>(null)

    const [showNewForm, setShowNewForm] = useState(false)
    const [selectedApp, setSelectedApp] = useState<Application | null>(null)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [mounted, setMounted] = useState(false)
    const deleteModal = useConfirmModal<number | string>()

    useEffect(() => {
        setMounted(true)
    }, [])

    const [newAppForm, setNewAppForm] = useState({
        type: 'ariza' as 'ariza' | 'tushuntirish',
        title: '',
        reason: ''
    })

    useEffect(() => {
        if (showDetailModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [showDetailModal]);

    useEffect(() => {
        async function loadData() {
            try {
                setLoading(true)
                const currentUser = await getSafeUser()
                if (currentUser) {
                    setUser(currentUser)

                    // Fetch student profile from users table
                    const { data: profileData, error: profileError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', currentUser.id)
                        .single()

                    if (!profileError && profileData) {
                        setStudentProfile(profileData)
                    }

                    // Fetch student's applications
                    const { data: appData, error: appError } = await supabase
                        .from('arizalar')
                        .select('*')
                        .eq('student_id', currentUser.id)
                        .in('type', ['ariza', 'tushuntirish'])
                        .order('created_at', { ascending: false })

                    if (!appError && appData) {
                        const mapped = appData.map((app: {
                            id: string | number
                            type?: string
                            title?: string
                            reason?: string
                            text?: string
                            date?: string
                            created_at?: string
                            status?: string
                            ai_generated?: boolean
                            admin_response?: string
                            response_date?: string
                        }) => ({
                            id: app.id,
                            type: (app.type || 'ariza') as 'ariza' | 'tushuntirish',
                            title: app.title || 'Sarlavhasiz',
                            reason: app.reason || '',
                            content: app.text || '',
                            createdDate: app.date || app.created_at || new Date().toISOString(),
                            status: (app.status || 'pending') as 'draft' | 'submitted' | 'pending' | 'approved' | 'rejected',
                            aiGenerated: app.ai_generated || false,
                            adminResponse: app.admin_response || undefined,
                            responseDate: app.response_date || undefined
                        }))
                        setApplications(mapped)
                    }
                }
            } catch (error) {
                console.error('Data loading error:', error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    const generateWithAI = async () => {
        if (!newAppForm.title || !newAppForm.reason) {
            toast.error('Iltimos, sarlavha va sababni kiriting')
            return
        }

        if (!user) {
            toast.error('Sessiya topilmadi. Tizimga qaytadan kiring.')
            return
        }

        setIsGenerating(true)
        try {
            const generatedContent = generateAIContent(newAppForm)
            const appDate = new Date().toISOString()

            const newRecord = {
                student_id: user.id,
                student_name: studentProfile?.full_name || user.email || 'Talaba',
                faculty: studentProfile?.faculty || '',
                direction: studentProfile?.direction || '',
                course: studentProfile?.course ? parseInt(String(studentProfile.course)) : 1,
                date: appDate,
                text: generatedContent,
                level: 'info',
                status: 'draft',
                title: newAppForm.title,
                type: newAppForm.type,
                reason: newAppForm.reason,
                ai_generated: true
            }

            const { data, error } = await supabase
                .from('arizalar')
                .insert(newRecord)
                .select()
                .single()

            if (error) {
                throw error
            }

            if (data) {
                const newApp: Application = {
                    id: data.id,
                    type: data.type as 'ariza' | 'tushuntirish',
                    title: data.title || newAppForm.title,
                    reason: data.reason || newAppForm.reason,
                    content: data.text || generatedContent,
                    createdDate: data.date || appDate,
                    status: data.status as 'draft' | 'submitted' | 'pending' | 'approved' | 'rejected',
                    aiGenerated: data.ai_generated
                }

                setApplications([newApp, ...applications])
                setNewAppForm({ type: 'ariza', title: '', reason: '' })
                setShowNewForm(false)
            }
        } catch (error) {
            console.error('Error generating and saving application:', error)
            const errMsg = error instanceof Error ? error.message : String(error)
            toast.error('Ariza yaratish va saqlashda xatolik yuz berdi: ' + errMsg)
        } finally {
            setIsGenerating(false)
        }
    }

    const generateAIContent = (form: { type: string; title: string; reason: string }) => {
        const fullName = studentProfile?.full_name || '__________ (F.I.O)'
        const email = studentProfile?.email || '__________'

        const prefix = form.type === 'ariza'
            ? `O'zbekiston Milliy Universiteti Rektori bilan\n\nIltimos!\n\nMen, ${fullName}, talaba (${email}), sizga murojaat qilyapman.\n\n${form.title} haqida ariza topshiryapman.`
            : `O'zbekiston Milliy Universiteti Rektori bilan\n\nIltimos!\n\nMen, ${fullName}, talaba (${email}), sizga murojaat qilyapman.\n\n${form.title} haqida tushuntirish taqdim qilyapman.`

        return `${prefix}\n\nSabablari:\n${form.reason}\n\nBundan keyin barcha qoidalarga amal qilishimni kafolatlayman.\n\nHurmat bilan,\nMurojaatchi: ${fullName}\nSana: ${new Date().toISOString().split('T')[0]}`
    }

    const downloadPDF = async (app: Application) => {
        try {
            const { jsPDF } = await import('jspdf')
            const doc = new jsPDF()
            
            // Set font and size (Helvetica is built-in and supports ASCII/Latin standard text)
            doc.setFont('Helvetica', 'normal')
            doc.setFontSize(11)
            
            // Split text to fit A4 page width with margins (180mm width)
            const splitText = doc.splitTextToSize(app.content, 180)
            
            // Render text starting at x: 15, y: 20
            doc.text(splitText, 15, 20)
            
            // Save as PDF file directly to downloads folder
            doc.save(`${app.type}_${app.id}.pdf`)
        } catch (error) {
            console.error('Error generating PDF:', error)
            toast.error('PDF yuklashda xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.')
        }
    }

    const deleteApp = (id: number | string) => {
        deleteModal.open(id)
    }

    const confirmDeleteApp = async () => {
        if (deleteModal.target === undefined) return
        const id = deleteModal.target
        deleteModal.setIsLoading(true)
        try {
            const { error } = await supabase
                .from('arizalar')
                .delete()
                .eq('id', id)

            if (error) throw error

            setApplications(applications.filter(a => a.id !== id))
            deleteModal.close()
        } catch (error) {
            console.error('Error deleting application:', error)
            const errMsg = error instanceof Error ? error.message : String(error)
            toast.error('Arizani o\'chirishda xatolik yuz berdi: ' + errMsg)
        } finally {
            deleteModal.setIsLoading(false)
        }
    }

    const submitApp = async (app: Application) => {
        try {
            const { error } = await supabase
                .from('arizalar')
                .update({ status: 'pending' })
                .eq('id', app.id)

            if (error) throw error

            setApplications(applications.map(a =>
                a.id === app.id ? { ...a, status: 'pending' as const } : a
            ))
        } catch (error) {
            console.error('Error submitting application:', error)
            const errMsg = error instanceof Error ? error.message : String(error)
            toast.error('Arizani yuborishda xatolik yuz berdi: ' + errMsg)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft':
                return isLight ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-yellow-900/20 text-yellow-400 border-yellow-800'
            case 'submitted':
            case 'pending':
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
            case 'pending':
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
            case 'pending':
                return 'Yuborildi'
            case 'approved':
                return 'Tasdiqlandi'
            case 'rejected':
                return 'Rad etildi'
            default:
                return status
        }
    }

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className={`animate-spin rounded-full h-10 w-10 border-b-2 ${isLight ? 'border-blue-600' : 'border-cyan-400'}`}></div>
            </div>
        )
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
                    <p className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{applications.filter(a => a.status === 'submitted' || a.status === 'pending').length}</p>
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
                                <CustomSelect
                                    value={newAppForm.type}
                                    onChange={(val) => setNewAppForm({ ...newAppForm, type: val as 'ariza' | 'tushuntirish' })}
                                    options={[
                                        { value: 'ariza', label: 'Ariza' },
                                        { value: 'tushuntirish', label: 'Tushuntirish' },
                                    ]}
                                    className={`px-3 py-2 rounded-lg border transition-all ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500' : 'bg-slate-800 border-slate-700 text-white focus:border-cyan-500'}`}
                                />
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
                                                setSelectedApp(app)
                                                setShowDetailModal(true)
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
            {mounted && typeof document !== 'undefined' && showDetailModal && selectedApp && createPortal(
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
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
                </div>,
                document.body
            )}

            <ConfirmModal
                isOpen={deleteModal.isOpen}
                title="Arizani o'chirish"
                description="Ushbu qoralamani o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi."
                onClose={deleteModal.close}
                onConfirm={confirmDeleteApp}
                confirmText="O'chirish"
                confirmVariant="danger"
                isLoading={deleteModal.isLoading}
            />
        </div>
    )
}
