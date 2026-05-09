'use client'

import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
    Mail, Phone, GraduationCap, Home,
    ShieldCheck, LogOut, Camera, Edit2, Lock, X, Check, Loader
} from 'lucide-react'
import { motion, Variants } from 'framer-motion'
import { useThemeStore } from '@/lib/stores/theme-store'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Profile {
    id: string
    full_name: string
    email: string
    phone?: string
    faculty?: string
    role?: string
    room_number?: string
    course?: string | number
    group?: string | number
    avatar_url?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fadeUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.07,
            duration: 0.4,
            ease: [0.22, 1, 0.36, 1] as const
        },
    }),
};

function getInitials(name: string) {
    return name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
}

// ─── 3D Creative Toast ────────────────────────────────────────────────────────
interface Toast3DProps {
    message: { type: 'success' | 'error'; text: string } | null
    isLight: boolean
}

function Toast3D({ message, isLight }: Toast3DProps) {
    if (!message) return null

    const isSuccess = message.type === 'success'
    const bgColor = isSuccess
        ? isLight ? 'from-green-400 to-emerald-600' : 'from-emerald-500 to-teal-600'
        : isLight ? 'from-red-400 to-pink-600' : 'from-red-500 to-pink-600'

    return (
        <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.8 }}
            animate={{ opacity: 1, y: 20, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.8 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[999]"
        >
            <div className={`bg-gradient-to-r ${bgColor} rounded-2xl px-6 py-4 shadow-2xl backdrop-blur-xl border border-white/30`}
                style={{
                    boxShadow: `
                        0 20px 40px rgba(0, 0, 0, 0.3),
                        0 0 60px ${isSuccess ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'},
                        inset 0 1px 0 rgba(255, 255, 255, 0.4)
                    `,
                    transform: 'perspective(1000px) rotateX(0deg)',
                }}
            >
                <div className="flex items-center gap-3">
                    <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 0.6, repeat: Infinity }}
                        className="flex-shrink-0"
                    >
                        {isSuccess ? (
                            <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center">
                                <Check size={16} className="text-white" />
                            </div>
                        ) : (
                            <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center">
                                <X size={16} className="text-white" />
                            </div>
                        )}
                    </motion.div>
                    <span className="text-white font-bold text-sm">{message.text}</span>
                </div>
            </div>
        </motion.div>
    )
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
type StepState = 'done' | 'active' | 'todo'

function Timeline({ course, isLight }: { course: number; isLight: boolean }) {
    const steps = [1, 2, 3, 4].map((n) => ({
        n,
        year: String(2021 + n),
        state: (course > n ? 'done' : course === n ? 'active' : 'todo') as StepState,
    }))

    const cls: Record<StepState, string> = {
        done: isLight ? 'bg-blue-600 text-blue-100' : 'bg-blue-700 text-blue-200',
        active: isLight ? 'bg-blue-600 text-white ring-4 ring-blue-500/25' : 'bg-violet-600 text-white ring-4 ring-violet-500/25',
        todo: isLight ? 'bg-slate-300 text-slate-600' : 'bg-slate-800 text-slate-600',
    }

    return (
        <div className="flex items-start w-full">
            {steps.map((s, i) => (
                <div key={s.n} className="flex-1 flex flex-col items-center relative">
                    {i < 3 && (
                        <div className={`absolute top-4 left-1/2 w-full h-px ${isLight ? 'bg-slate-300' : 'bg-white/5'}`} />
                    )}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black z-10 mb-1.5 ${cls[s.state]}`}>
                        {s.n}
                    </div>
                    <p className={`text-[10px] font-bold ${s.state === 'active' ? isLight ? 'text-blue-600' : 'text-violet-400' : isLight ? 'text-slate-500' : 'text-slate-600'}`}>
                        {s.n}-kurs
                    </p>
                    <p className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-700'}`}>{s.year}</p>
                </div>
            ))}
        </div>
    )
}

// ─── Info row ─────────────────────────────────────────────────────────────────
interface InfoRowProps {
    icon: React.ReactNode
    label: string
    value: string
    bg: string
    color: string
}

function InfoRow({ icon, label, value, bg, color }: InfoRowProps) {
    return (
        <div className="flex items-center gap-3.5">
            <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                style={{ background: bg, color }}
            >
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5" style={{ color }}>
                    {label}
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate" style={{ color: 'inherit' }}>
                    {value}
                </p>
            </div>
        </div>
    )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'
    return (
        <div className={`min-h-screen flex items-center justify-center ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100' : 'bg-[#020617]'}`}>
            <div className={`w-10 h-10 border-4 rounded-full animate-spin ${isLight ? 'border-blue-200 border-t-blue-600' : 'border-blue-500/20 border-t-blue-500'}`} />
        </div>
    )
}

// ─── Roommate Card ─────────────────────────────────────────────────────────────
interface RoommateCardProps {
    roommate: Profile
    isLight: boolean
}

function RoommateCard({ roommate, isLight }: RoommateCardProps) {
    const initials = getInitials(roommate.full_name)
    const course = Number(roommate.course ?? 1)

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`border rounded-2xl p-3.5 transition-all hover:scale-[1.02] ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-white/5 border-white/10'}`}
        >
            <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                    className="w-14 h-14 rounded-xl p-0.5 shrink-0"
                    style={{ background: 'linear-gradient(135deg, #10b981, #34d399)' }}
                >
                    <div className={`w-full h-full rounded-lg flex items-center justify-center overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/10'}`}>
                        {roommate.avatar_url ? (
                            <Image
                                key={`${roommate.avatar_url}-${Date.now()}`}
                                src={roommate.avatar_url}
                                alt={roommate.full_name}
                                width={56}
                                height={56}
                                unoptimized
                                className="object-cover"
                            />
                        ) : (
                            <span className={`text-sm font-black ${isLight ? 'text-green-300' : 'text-emerald-300/60'}`}>
                                {initials}
                            </span>
                        )}
                    </div>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                    <p className={`font-black text-sm truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {roommate.full_name}
                    </p>
                    <p className={`text-[11px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {course}-kurs · {roommate.group || '—'}
                    </p>
                </div>

                {/* Status badge */}
                <div className={`px-2 py-1 rounded-lg text-[9px] font-black whitespace-nowrap ${isLight ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/15 text-emerald-400'}`}>
                    Faol
                </div>
            </div>
        </motion.div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StudentProfile() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [roommates, setRoommates] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [editForm, setEditForm] = useState<Partial<Profile>>({})
    const [savingEdit, setSavingEdit] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'

    useEffect(() => {
        async function fetchProfile() {
            try {
                setLoading(true)
                const { data: { user } } = await supabase.auth.getUser()

                if (user) {
                    const { data, error } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', user.id)
                        .single()

                    if (!error && data) {
                        setProfile(data)

                        // Xonadoshlarni olish - shu xonada yashovchi boshqa talabalar
                        if (data.room_number) {
                            const { data: roommatesData, error: roommatesError } = await supabase
                                .from('users')
                                .select('id, full_name, email, phone, faculty, role, room_number, course, group, avatar_url')
                                .eq('room_number', data.room_number)
                                .neq('id', user.id)
                                .order('full_name', { ascending: true })

                            if (!roommatesError && roommatesData) {
                                setRoommates(roommatesData)
                            }
                        }
                        return
                    }
                }

                setProfile({
                    id: '1',
                    full_name: "Azizbek Karimov",
                    email: "azizbek@univer.uz",
                    phone: "+998 90 123 45 67",
                    faculty: "Dasturiy Injiniring",
                    role: "Talaba",
                    room_number: "204-xona",
                    course: "3",
                    group: "412"
                })
                setRoommates([
                    {
                        id: '2',
                        full_name: "Dilshod Latipov",
                        email: "dilshod@univer.uz",
                        phone: "+998 90 234 56 78",
                        faculty: "Dasturiy Injiniring",
                        role: "Talaba",
                        room_number: "204-xona",
                        course: "1",
                        group: "412"
                    },
                    {
                        id: '3',
                        full_name: "Gaxriman Araznepesov",
                        email: "gaxriman@univer.uz",
                        phone: "+998 90 345 67 89",
                        faculty: "Dasturiy Injiniring",
                        role: "Talaba",
                        room_number: "204-xona",
                        course: "1",
                        group: "412"
                    }
                ])

            } catch {
                console.log("Hozircha offline rejimda ishlayapmiz")
            } finally {
                setLoading(false)
            }
        }
        fetchProfile()
    }, [])

    // Profile-ni refresh qilish (avatar upload/delete qilingandan keyin)
    const refreshProfile = async () => {
        if (!profile) return
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', profile.id)
                .single()

            if (!error && data) {
                setProfile(data)
            }
        } catch (error) {
            console.error('Profile refresh xatosi:', error)
        }
    }

    const handleAvatarClick = () => {
        fileInputRef.current?.click()
    }

    const handleDeleteAvatar = async () => {
        if (!profile) return

        setUploading(true)
        try {
            // Auth token'ni olish
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.access_token) {
                setMessage({ type: 'error', text: 'Autentifikatsiya xatosi' })
                return
            }

            const response = await fetch(
                `/api/student/profile/upload-avatar?userId=${profile.id}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                }
            )

            const data = await response.json()

            if (!response.ok) {
                setMessage({ type: 'error', text: data.error || 'Avatar o\'chirilishida xato' })
                return
            }

            // Profil-ni refresh qilish
            await refreshProfile()
            setMessage({ type: 'success', text: 'Avatar muvaffaqiyatli o\'chirildi' })
            setTimeout(() => setMessage(null), 4000)
        } catch (error) {
            console.error('Delete xatosi:', error)
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Xato yuz berdi' })
        } finally {
            setUploading(false)
        }
    }

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !profile) return

        // File validatsiya
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if (!validTypes.includes(file.type)) {
            setMessage({ type: 'error', text: 'Faqat JPEG, PNG, WebP yoki GIF formatida rasm qabul qilinadi' })
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'Rasm 5MB dan katta bo\'lmasligi kerak' })
            return
        }

        setUploading(true)
        try {
            // Auth token'ni olish
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.access_token) {
                setMessage({ type: 'error', text: 'Autentifikatsiya xatosi' })
                return
            }

            const formData = new FormData()
            formData.append('file', file)
            formData.append('userId', profile.id)

            const response = await fetch('/api/student/profile/upload-avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: formData,
            })

            const data = await response.json()

            console.log('✅ Upload Response:', {
                success: data.success,
                url: data.url,
                message: data.message,
                fullResponse: data
            })

            if (!response.ok) {
                setMessage({ type: 'error', text: data.error || 'Rasm yuklanishida xato' })
                return
            }

            console.log('✅ API Response:', { url: data.url, data })

            // Profil-ni refresh qilish
            await refreshProfile()
            setMessage({ type: 'success', text: 'Rasm muvaffaqiyatli yuklanildi' })
            setTimeout(() => setMessage(null), 4000)
        } catch (error) {
            console.error('Upload xatosi:', error)
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Xato yuz berdi' })
        } finally {
            setUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const handleEditOpen = () => {
        if (profile) {
            setEditForm({
                full_name: profile.full_name,
                phone: profile.phone,
                faculty: profile.faculty,
                group: profile.group,
                room_number: profile.room_number,
            })
            setShowEditModal(true)
        }
    }

    const handleEditSave = async () => {
        if (!profile) return

        setSavingEdit(true)
        try {
            const response = await fetch('/api/student/profile/update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: profile.id,
                    ...editForm,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                setMessage({ type: 'error', text: data.error || 'Yangilashda xato' })
                return
            }

            setProfile(data.data)
            setShowEditModal(false)
            setMessage({ type: 'success', text: 'Profil muvaffaqiyatli yangilandi' })

            setTimeout(() => setMessage(null), 4000)
        } catch {
            setMessage({ type: 'error', text: 'Xato yuz berdi' })
        } finally {
            setSavingEdit(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        window.location.href = '/login'
    }

    if (loading) return <Skeleton />

    // ── Safe values ──
    const fullName = profile?.full_name || 'Ism kiritilmagan'
    const faculty = profile?.faculty || 'Fakultet kiritilmagan'
    const role = profile?.role || 'Talaba'
    const email = profile?.email || '—'
    const phone = profile?.phone || '+998 -- --- -- --'
    const roomNumber = profile?.room_number || 'Biriktirilmagan'
    const course = Number(profile?.course ?? 1)
    const group = profile?.group ? String(profile.group) : '—'
    const initials = getInitials(fullName)

    return (
        <div className={`space-y-4 transition-colors ${isLight ? 'text-slate-900' : 'text-white'}`}>

            {/* ── 3D Creative Toast ── */}
            <Toast3D message={message} isLight={isLight} />

            {/* ── Header ── */}
            <motion.div
                custom={0} variants={fadeUp} initial="hidden" animate="show"
                className={`flex items-center justify-between pt-2 pb-4 border-b ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/5 text-white'}`}
            >
                <h1 className="text-2xl font-black italic uppercase tracking-tighter leading-none">
                    Shaxsiy<br />Profil
                </h1>

                <button
                    onClick={handleLogout}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all active:scale-95 ${isLight ? 'bg-red-100 border border-red-300 text-red-600 hover:bg-red-200' : 'bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500 hover:text-white'
                        }`}
                >
                    <LogOut size={14} />
                    Chiqish
                </button>
            </motion.div>

            {/* ── Hero card ── */}
            <motion.div
                custom={1} variants={fadeUp} initial="hidden" animate="show"
                className={`relative overflow-hidden border rounded-3xl p-5 transition-colors ${isLight ? 'bg-white border-slate-300' : 'bg-[#0b1120] border-white/[0.07]'
                    }`}
            >
                {/* Decorative glow */}
                {!isLight && (
                    <div
                        className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none opacity-15"
                        style={{ background: 'radial-gradient(circle, #2563eb, transparent 70%)' }}
                    />
                )}

                <div className="flex items-center gap-5 relative z-10">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                        <div
                            className="w-24 h-24 rounded-full p-0.5 flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #2563eb, #6366f1)' }}
                        >
                            <div className={`w-full h-full rounded-full flex items-center justify-center overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-[#020617]'
                                }`}>
                                {profile?.avatar_url ? (
                                    <Image
                                        key={`${profile.avatar_url}-${Date.now()}`}
                                        src={profile.avatar_url}
                                        alt={fullName}
                                        width={96}
                                        height={96}
                                        priority
                                        unoptimized
                                        onLoad={() => console.log('✅ Avatar image loaded:', profile.avatar_url)}
                                        onError={(error) => {
                                            console.error('❌ Avatar image error:', {
                                                src: profile.avatar_url,
                                                error,
                                                errorType: error?.type,
                                                errorStatus: (error as any)?.status
                                            })
                                        }}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className={`text-2xl font-black select-none ${isLight ? 'text-blue-300' : 'text-indigo-400/50'
                                        }`}>
                                        {initials}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="absolute bottom-0.5 right-0.5 flex gap-1">
                            {/* Upload button */}
                            <button
                                onClick={handleAvatarClick}
                                disabled={uploading}
                                aria-label="Rasm yuklash"
                                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50 ${isLight ? 'bg-blue-600 hover:bg-blue-700 border-white' : 'bg-blue-600 hover:bg-blue-500 border-[#0b1120]'
                                    }`}
                            >
                                {uploading ? <Loader size={13} className="text-white animate-spin" /> : <Camera size={13} className="text-white" />}
                            </button>

                            {/* Delete button - faqat avatar bo'lsa */}
                            {profile?.avatar_url && (
                                <button
                                    onClick={handleDeleteAvatar}
                                    disabled={uploading}
                                    aria-label="Rasmni o'chirish"
                                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50 ${isLight ? 'bg-red-600 hover:bg-red-700 border-white' : 'bg-red-600 hover:bg-red-500 border-[#0b1120]'
                                        }`}
                                >
                                    <X size={13} className="text-white" />
                                </button>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="hidden"
                        />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 space-y-2">
                        <h2 className={`text-2xl font-black leading-tight truncate ${isLight ? 'text-slate-900' : 'text-white'
                            }`}>
                            {fullName}
                        </h2>

                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${isLight ? 'bg-green-100 border border-green-300 text-green-600' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                            }`}>
                            <ShieldCheck size={11} />
                            Faol Talaba
                        </span>

                        <p className={`font-bold text-[10px] uppercase tracking-[0.2em] truncate ${isLight ? 'text-blue-600' : 'text-blue-400'
                            }`}>
                            {faculty} · {role}
                        </p>
                    </div>
                </div>
            </motion.div >

            {/* ── Stat cards ── */}
            < motion.div
                custom={2} variants={fadeUp} initial="hidden" animate="show"
                className="grid grid-cols-3 gap-2.5"
            >
                {
                    [
                        { val: course, label: 'Kurs', color: '#60a5fa' },
                        { val: group, label: 'Guruh', color: '#34d399' },
                        { val: roomNumber, label: 'Xona', color: '#fcd34d' },
                    ].map((s) => (
                        <div
                            key={s.label}
                            className={`border rounded-2xl p-3.5 text-center transition-colors ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0b1120] border-white/6'
                                }`}
                        >
                            <p
                                className="font-black leading-tight mb-1 truncate"
                                style={{
                                    color: s.color,
                                    fontSize: String(s.val).length > 5 ? '13px' : '22px',
                                }}
                            >
                                {s.val}
                            </p>
                            <p className={`text-[9px] font-bold uppercase tracking-[0.18em] ${isLight ? 'text-slate-500' : 'text-slate-600'
                                }`}>
                                {s.label}
                            </p>
                        </div>
                    ))
                }
            </motion.div >

            {/* ── Info sections ── */}
            < div className="grid grid-cols-2 gap-2.5" >
                {/* Aloqa */}
                < motion.section
                    custom={3} variants={fadeUp} initial="hidden" animate="show"
                    className={`group border rounded-[20px] p-4 transition-colors space-y-4 ${isLight ? 'bg-slate-100 border-slate-300 hover:border-blue-400' : 'bg-[#0b1120] border-white/[0.07] hover:border-blue-500/25'
                        }`
                    }
                >
                    <h3 className={`text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-1.5 ${isLight ? 'text-slate-600' : 'text-slate-500'
                        }`}>
                        <span className={`block w-0.5 h-3 rounded-full ${isLight ? 'bg-blue-600' : 'bg-blue-500'}`} />
                        Aloqa
                    </h3>
                    <InfoRow
                        icon={<Mail size={17} />}
                        label="Email"
                        value={email}
                        bg={isLight ? "rgba(37,99,235,0.1)" : "rgba(59,130,246,0.1)"}
                        color={isLight ? "#2563eb" : "#60a5fa"}
                    />
                    <InfoRow
                        icon={<Phone size={17} />}
                        label="Telefon"
                        value={phone}
                        bg={isLight ? "rgba(79,70,229,0.1)" : "rgba(99,102,241,0.1)"}
                        color={isLight ? "#4f46e5" : "#a5b4fc"}
                    />
                </motion.section >

                {/* Turar joy */}
                < motion.section
                    custom={4} variants={fadeUp} initial="hidden" animate="show"
                    className={`group border rounded-[20px] p-4 transition-colors space-y-4 ${isLight ? 'bg-slate-100 border-slate-300 hover:border-green-400' : 'bg-[#0b1120] border-white/[0.07] hover:border-emerald-500/25'
                        }`}
                >
                    <h3 className={`text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-1.5 ${isLight ? 'text-slate-600' : 'text-slate-500'
                        }`}>
                        <span className={`block w-0.5 h-3 rounded-full ${isLight ? 'bg-green-600' : 'bg-emerald-500'}`} />
                        Turar joy
                    </h3>
                    <InfoRow
                        icon={<Home size={17} />}
                        label="Xona"
                        value={roomNumber}
                        bg={isLight ? "rgba(22,163,74,0.1)" : "rgba(16,185,129,0.1)"}
                        color={isLight ? "#16a34a" : "#34d399"}
                    />
                    <InfoRow
                        icon={<GraduationCap size={17} />}
                        label="Kurs / Guruh"
                        value={`${course}-kurs, ${group}-guruh`}
                        bg={isLight ? "rgba(217,119,6,0.1)" : "rgba(245,158,11,0.1)"}
                        color={isLight ? "#d97706" : "#fcd34d"}
                    />
                </motion.section >
            </div >

            {/* ── Timeline ── */}
            < motion.div
                custom={5} variants={fadeUp} initial="hidden" animate="show"
                className={`border rounded-[20px] p-4 transition-colors ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0b1120] border-white/[0.07]'
                    }`}
            >
                <h3 className={`text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-1.5 mb-5 ${isLight ? 'text-slate-600' : 'text-slate-500'
                    }`}>
                    <span className={`block w-0.5 h-3 rounded-full ${isLight ? 'bg-violet-600' : 'bg-violet-500'}`} />
                    Ta&apos;lim davri
                </h3>
                <Timeline course={course} isLight={isLight} />
            </motion.div >

            {/* ── Xonadoshlar (Roommates) ── */}
            {
                roommates.length > 0 && (
                    <motion.div
                        custom={6} variants={fadeUp} initial="hidden" animate="show"
                        className={`border rounded-[20px] p-4 transition-colors ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0b1120] border-white/[0.07]'
                            }`}
                    >
                        <h3 className={`text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-1.5 mb-4 ${isLight ? 'text-slate-600' : 'text-slate-500'
                            }`}>
                            <span className={`block w-0.5 h-3 rounded-full ${isLight ? 'bg-green-600' : 'bg-emerald-500'}`} />
                            Xonadoshlar ({roommates.length} kishi)
                        </h3>
                        <div className="space-y-2.5">
                            {roommates.map((roommate) => (
                                <RoommateCard key={roommate.id} roommate={roommate} isLight={isLight} />
                            ))}
                        </div>
                    </motion.div>
                )
            }

            {/* ── Actions ── */}
            <motion.div
                custom={roommates.length > 0 ? 7 : 6} variants={fadeUp} initial="hidden" animate="show"
                className="flex gap-2.5"
            >
                <button
                    onClick={handleEditOpen}
                    className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all hover:-translate-y-0.5 active:scale-95 ${isLight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-[#020617] hover:bg-blue-500 hover:text-white'
                        }`}>
                    <Edit2 size={15} />
                    Tahrirlash
                </button>
                <button className={`flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black uppercase text-[11px] transition-all active:scale-95 ${isLight ? 'bg-blue-100 border border-blue-300 text-blue-600 hover:bg-blue-200' : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20'
                    }`}>
                    <Lock size={15} />
                    Parol
                </button>
            </motion.div>

            {/* ── Edit Modal ── */}
            {
                showEditModal && profile && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pb-32 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setShowEditModal(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={(e) => e.stopPropagation()}
                            className={`rounded-3xl p-6 w-full max-w-sm my-auto ${isLight ? 'bg-white' : 'bg-[#0b1120]'} shadow-2xl`}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className={`text-xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                    ✨ Profilni Tahrirlash
                                </h2>
                                <button onClick={() => setShowEditModal(false)} className={`p-2 rounded-lg ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}>
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Image Section */}
                            <div className={`p-4 rounded-2xl mb-4 ${isLight ? 'bg-slate-50 border border-slate-200' : 'bg-white/5 border border-white/10'}`}>
                                <p className={`text-xs font-black uppercase mb-3 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                    📸 Avatar
                                </p>
                                <div className="flex items-center gap-4">
                                    {/* Avatar Preview */}
                                    <div
                                        className="w-16 h-16 rounded-2xl p-0.5 flex-shrink-0"
                                        style={{ background: 'linear-gradient(135deg, #2563eb, #6366f1)' }}
                                    >
                                        <div className={`w-full h-full rounded-xl flex items-center justify-center overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/10'}`}>
                                            {profile?.avatar_url ? (
                                                <Image
                                                    key={`${profile.avatar_url}-modal`}
                                                    src={profile.avatar_url}
                                                    alt="Avatar preview"
                                                    width={64}
                                                    height={64}
                                                    unoptimized
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-lg font-black text-blue-300">
                                                    {getInitials(profile?.full_name || '')}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Upload/Delete Buttons */}
                                    <div className="flex flex-col gap-2 flex-1">
                                        <button
                                            onClick={handleAvatarClick}
                                            disabled={uploading}
                                            className={`w-full px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${isLight
                                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50'
                                                : 'bg-blue-600/30 text-blue-400 hover:bg-blue-600/50 disabled:opacity-50'
                                                }`}
                                        >
                                            {uploading ? <Loader size={14} className="animate-spin" /> : <Camera size={14} />}
                                            {uploading ? 'Yuklanyapti...' : "O'zgartirish"}
                                        </button>
                                        {profile?.avatar_url && (
                                            <button
                                                onClick={handleDeleteAvatar}
                                                disabled={uploading}
                                                className={`w-full px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${isLight
                                                    ? 'bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50'
                                                    : 'bg-red-600/30 text-red-400 hover:bg-red-600/50 disabled:opacity-50'
                                                    }`}
                                            >
                                                <X size={14} />
                                                O'chirish
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Form Fields */}
                            <div className="space-y-3">
                                {[
                                    { key: 'full_name', label: "To'liq Ism", placeholder: "Ismingiz" },
                                    { key: 'phone', label: 'Telefon', placeholder: '+998 90 123 45 67' },
                                    { key: 'faculty', label: 'Fakultet', placeholder: 'Fakultetingiz' },
                                    { key: 'group', label: 'Guruh', placeholder: '412' },
                                    { key: 'room_number', label: 'Xona', placeholder: '204-xona' },
                                ].map(({ key, label, placeholder }) => (
                                    <div key={key}>
                                        <label className={`block text-xs font-black uppercase mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                            {label}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={placeholder}
                                            value={editForm[key as keyof Profile] || ''}
                                            onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                                            className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all ${isLight
                                                ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:bg-white'
                                                : 'bg-white/5 border-white/10 text-white focus:border-blue-500/50 focus:bg-white/10'
                                                }`}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className={`flex-1 py-3 rounded-xl font-black transition-all text-sm ${isLight ? 'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-900 hover:from-slate-200 hover:to-slate-300 shadow-lg' : 'bg-gradient-to-r from-slate-800 to-slate-700 text-white hover:from-slate-700 hover:to-slate-600 shadow-lg'}`}
                                >
                                    ✕ Bekor Qilish
                                </button>
                                <button
                                    onClick={handleEditSave}
                                    disabled={savingEdit}
                                    className={`flex-1 py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 text-sm shadow-lg ${isLight ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 disabled:opacity-50' : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-500 hover:to-cyan-600 disabled:opacity-50'}`}
                                >
                                    {savingEdit ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
                                    {savingEdit ? 'Saqlanmoqda...' : '✓ Saqlash'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )
            }

        </div >
    )
}
