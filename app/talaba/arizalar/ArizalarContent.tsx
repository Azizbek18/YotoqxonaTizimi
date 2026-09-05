'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
    Plus, Download, Trash2, ShieldCheck,
    FileText, CheckCircle, Clock, AlertCircle
} from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'
import { getSafeUser } from '@/lib/auth-session'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { TalabaArizalarSkeleton } from '@/components/talaba/skeletons'
import { useConfirmModal } from '@/lib/hooks/useConfirmModal'
import { fetchStudentProfile } from '@/features/profile/client/api'
import {
    deleteStudentApplication,
    fetchArizaDocument,
    fetchStudentApplications,
    submitStudentApplication,
    type ArizaReceipt,
} from '@/features/applications/client/api'
import SignArizaModal from '@/components/applications/SignArizaModal'
import FormalArizaComposer from '@/components/applications/FormalArizaComposer'
import { generateStudentArizaPdf } from '@/lib/student-ariza-pdf'
import type { ArizaComposeInput } from '@/lib/student-ariza-template'

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
    const [studentProfile, setStudentProfile] = useState<Profile | null>(null)

    const [composerOpen, setComposerOpen] = useState(false)
    const [selectedApp, setSelectedApp] = useState<Application | null>(null)
    const [signTarget, setSignTarget] = useState<Application | null>(null)
    const [signBusy, setSignBusy] = useState(false)
    const [signReceipt, setSignReceipt] = useState<ArizaReceipt | null>(null)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [mounted, setMounted] = useState(false)
    const deleteModal = useConfirmModal<number | string>()

    useEffect(() => {
        setMounted(true)
    }, [])

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

    // `silent` skips the loading flag — used for refreshing the list behind
    // an already-open modal (e.g. right after a submit succeeds). Without
    // it, setLoading(true) makes this component's early `if (loading)
    // return <Skeleton />` swap out the ENTIRE tree, including the portal-
    // rendered composer/sign modals — unmounting them mid-flow. The
    // composer would then remount fresh (back on its first "write" step)
    // the moment loading finished, right after the student had just signed
    // and submitted — looking exactly like the ariza got bounced back.
    const reload = React.useCallback(async (silent = false) => {
        try {
            if (!silent) setLoading(true)
            const currentUser = await getSafeUser()
            if (!currentUser) return
            const [profilePayload, applicationPayload] = await Promise.all([
                fetchStudentProfile(),
                fetchStudentApplications('documents'),
            ])
            setStudentProfile({
                ...profilePayload.profile,
                full_name: profilePayload.profile.full_name ?? '',
                email: profilePayload.profile.email ?? '',
            } as Profile)
            const appData = applicationPayload.applications ?? []
            setApplications(appData.map((app) => ({
                id: app.id,
                type: (app.type || 'ariza') as 'ariza' | 'tushuntirish',
                title: app.title || 'Sarlavhasiz',
                reason: app.reason || '',
                content: app.text || '',
                createdDate: app.date || app.created_at || new Date().toISOString(),
                status: (app.status || 'pending') as 'draft' | 'submitted' | 'pending' | 'approved' | 'rejected',
                aiGenerated: app.ai_generated || false,
                adminResponse: app.admin_response || undefined,
                responseDate: app.response_date || undefined,
            })))
        } catch (error) {
            console.error('Data loading error:', error)
        } finally {
            if (!silent) setLoading(false)
        }
    }, [])

    useEffect(() => { reload() }, [reload])

    // The signed formal document, regenerated from the frozen snapshot.
    const downloadDocument = async (app: Application) => {
        try {
            const doc = await fetchArizaDocument(app.id)
            const formal = doc.formal as (ArizaComposeInput & Record<string, unknown>) | null
            if (formal) {
                await generateStudentArizaPdf({
                    kind: (doc.type as 'ariza' | 'tushuntirish') ?? formal.kind,
                    recipient: formal.recipient,
                    fullName: String(formal.fullName ?? ''),
                    facultyLabel: String(formal.facultyLabel ?? ''),
                    course: (formal.course as string | number) ?? '',
                    ttjNumber: String(formal.ttjNumber ?? ''),
                    room: String(formal.room ?? ''),
                    incidentText: String(formal.incidentText ?? ''),
                    dekanName: (formal.dekanName as string | null) ?? null,
                    signatureImage: doc.signatureImage,
                    signedAt: doc.signedAt,
                    verifyCode: doc.verifyCode,
                })
                return
            }
            // Legacy plain-text ariza — simple fallback PDF.
            const { jsPDF } = await import('jspdf')
            const d = new jsPDF()
            d.setFont('Helvetica', 'normal'); d.setFontSize(11)
            d.text(d.splitTextToSize(doc.text || app.content, 180), 15, 20)
            d.save(`${app.type}_${app.id}.pdf`)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Hujjatni yuklab bo‘lmadi')
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
            await deleteStudentApplication(id)

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

    const submitApp = (app: Application) => {
        setSignReceipt(null)
        setSignTarget(app)
    }

    const doSign = async (typedName: string) => {
        if (!signTarget) return
        setSignBusy(true)
        try {
            const { receipt } = await submitStudentApplication(signTarget.id, { typedName, attested: true })
            setApplications(applications.map(a =>
                a.id === signTarget.id ? { ...a, status: 'pending' as const } : a
            ))
            if (receipt) setSignReceipt(receipt)
            else { toast.success('Ariza yuborildi'); setSignTarget(null) }
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error)
            toast.error(errMsg)
        } finally {
            setSignBusy(false)
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
                return <Clock size={16} />
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
        return <TalabaArizalarSkeleton />
    }

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div>
                <h1 className={`text-2xl sm:text-3xl font-black mb-2 break-words ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    📋 Arizalar va Tushuntirishlar
                </h1>
                <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    AI yordamida ariza yozing va PDF formatida yuklab oling
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className={`p-3 sm:p-4 rounded-2xl backdrop-blur-xl transition-all min-w-0 ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900/40 border border-white/10'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-2 truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Jami</p>
                    <p className={`text-xl sm:text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{applications.length}</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl backdrop-blur-xl transition-all min-w-0 ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900/40 border border-white/10'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-2 truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Qoralamasi</p>
                    <p className={`text-xl sm:text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{applications.filter(a => a.status === 'draft').length}</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl backdrop-blur-xl transition-all min-w-0 ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900/40 border border-white/10'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-2 truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Tasdiqlandi</p>
                    <p className={`text-xl sm:text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{applications.filter(a => a.status === 'approved').length}</p>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl backdrop-blur-xl transition-all min-w-0 ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900/40 border border-white/10'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-2 truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Yuborildi</p>
                    <p className={`text-xl sm:text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{applications.filter(a => a.status === 'submitted' || a.status === 'pending').length}</p>
                </div>
            </div>

            {/* Create New Application */}
            <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 sm:p-5 ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900/40 border border-white/10'}`}>
                <div className="min-w-0">
                    <h2 className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>Yangi ariza / tushuntirish</h2>
                    <p className={`mt-0.5 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Rasmiy hujjat tuziladi, ko‘rib chiqasiz va imzo qo‘yasiz</p>
                </div>
                <button
                    onClick={() => setComposerOpen(true)}
                    className="shrink-0 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-blue-700"
                >
                    <Plus size={16} /> Yangi ariza
                </button>
            </div>

            {/* Applications List */}
            <div className={`rounded-2xl backdrop-blur-xl p-4 sm:p-6 transition-all ${isLight ? 'bg-white border border-slate-200' : 'bg-slate-900/40 border border-white/10'}`}>
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
                                className={`p-3 sm:p-4 rounded-xl border transition-all hover:shadow-md cursor-pointer overflow-hidden ${isLight ? 'bg-slate-50 border-slate-200 hover:bg-white' : 'bg-slate-800/30 border-slate-700 hover:bg-slate-800/50'}`}
                                onClick={() => {
                                    setSelectedApp(app)
                                    setShowDetailModal(true)
                                }}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1 min-w-0">
                                            <FileText size={18} className={`shrink-0 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
                                            <h3 className={`font-bold text-sm break-words min-w-0 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                {app.title}
                                            </h3>
                                        </div>
                                        <p className={`text-xs break-words ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                            {app.type === 'ariza' ? '📋 Ariza' : '📝 Tushuntirish'} • 📅 {new Date(app.createdDate).toLocaleDateString('uz-UZ')}
                                        </p>
                                    </div>
                                    <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 whitespace-nowrap ${getStatusColor(app.status)}`}>
                                        {getStatusIcon(app.status)}
                                        {getStatusLabel(app.status)}
                                    </span>
                                </div>

                                <p className={`text-xs line-clamp-2 mb-3 break-words ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                    {app.reason}
                                </p>

                                {app.adminResponse && (
                                    <div className={`p-3 rounded-xl text-xs mb-3 border break-words ${isLight ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-blue-900/20 border-blue-800 text-blue-300'}`}>
                                        <p className="font-semibold mb-1">Admin xabari:</p>
                                        <p className="break-words">{app.adminResponse}</p>
                                    </div>
                                )}

                                <div className="flex gap-2 flex-wrap">
                                    {app.status === 'draft' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); submitApp(app) }}
                                            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-emerald-600 text-white"
                                        >
                                            <ShieldCheck size={12} className="inline mr-1" /> Imzolash va yuborish
                                        </button>
                                    )}
                                    {app.status !== 'draft' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); downloadDocument(app) }}
                                            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-blue-600 text-white"
                                        >
                                            <Download size={12} className="inline mr-1" /> Hujjat (PDF)
                                        </button>
                                    )}
                                    {app.status === 'draft' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteApp(app.id) }}
                                            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-rose-600 text-white"
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
                        className={`rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 ${isLight ? 'bg-white' : 'bg-slate-900'}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="min-w-0">
                                <h2 className={`text-xl font-black break-words ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                    {selectedApp.title}
                                </h2>
                                <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                    {selectedApp.type === 'ariza' ? '📋 Ariza' : '📝 Tushuntirish'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className={`shrink-0 p-1.5 rounded-full text-lg font-bold ${isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/10'}`}
                            >
                                ✕
                            </button>
                        </div>

                        <div className={`p-4 rounded-lg mb-4 whitespace-pre-wrap break-words text-sm font-mono ${isLight ? 'bg-slate-50 border border-slate-200 text-slate-700' : 'bg-slate-800/50 border border-slate-700 text-slate-300'}`}>
                            {selectedApp.content}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {selectedApp.status !== 'draft' && (
                                <button
                                    onClick={() => downloadDocument(selectedApp)}
                                    className="flex-1 sm:flex-none justify-center px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 bg-blue-600 text-white"
                                >
                                    <Download size={18} /> Hujjat (PDF)
                                </button>
                            )}
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className={`flex-1 sm:flex-none justify-center px-4 py-2 rounded-xl font-bold transition-all flex items-center ${isLight ? 'bg-slate-200 text-slate-900' : 'bg-slate-800 text-white'}`}
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
                description="Ushbu qoralamani o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaysiz."
                onClose={deleteModal.close}
                onConfirm={confirmDeleteApp}
                confirmText="O'chirish"
                confirmVariant="danger"
                isLoading={deleteModal.isLoading}
            />

            {/* Legacy drafts (pre-composer) still sign via the lightweight modal. */}
            <SignArizaModal
                open={signTarget !== null}
                onClose={() => { setSignTarget(null); setSignReceipt(null); reload(true) }}
                app={signTarget ? {
                    title: signTarget.title,
                    type: signTarget.type,
                    reason: signTarget.reason,
                    content: signTarget.content,
                } : null}
                expectedName={studentProfile?.full_name ?? ''}
                busy={signBusy}
                receipt={signReceipt}
                onSign={doSign}
            />

            <FormalArizaComposer
                open={composerOpen}
                onClose={() => setComposerOpen(false)}
                onSubmitted={() => reload(true)}
            />
        </div>
    )
}
