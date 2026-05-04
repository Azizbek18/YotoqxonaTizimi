'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
    Mail, Phone, GraduationCap, Home,
    ShieldCheck, LogOut, Camera, Edit2, Lock,
} from 'lucide-react'
import { motion, Variants } from 'framer-motion'
import toast from 'react-hot-toast'
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

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StudentProfile() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'

    useEffect(() => {
        async function fetchProfile() {
            try {
                setLoading(true)
                // Supabase'dan ma'lumot olishga urinib ko'ramiz
                const { data: { user } } = await supabase.auth.getUser()

                if (user) {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', user.id)
                        .single()

                    if (!error && data) {
                        setProfile(data)
                        return // Agar ma'lumot kelsa, shu yerda to'xtaydi
                    }
                }

                // AGAR XATO BO'LSA YOKI USER TOPILMASA:
                // O'zingizning ma'lumotlaringizni qo'lda yozib qo'yamiz
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

            } catch (err: unknown) {
                console.log("Hozircha offline rejimda ishlayapmiz")
            } finally {
                setLoading(false)
            }
        }
        fetchProfile()
    }, [])

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
        // layout.tsx already sets pb-24 px-4 max-w-md mx-auto — no need to repeat
        <div className={`space-y-4 transition-colors ${isLight ? 'text-slate-900' : 'text-white'}`}>

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
                            className="w-24 h-24 rounded-full p-0.5"
                            style={{ background: 'linear-gradient(135deg, #2563eb, #6366f1)' }}
                        >
                            <div className={`w-full h-full rounded-full flex items-center justify-center overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-[#020617]'
                                }`}>
                                {profile?.avatar_url ? (
                                    <img
                                        src={profile.avatar_url}
                                        alt={fullName}
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
                        <button
                            aria-label="Rasm yuklash"
                            className={`absolute bottom-0.5 right-0.5 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${isLight ? 'bg-blue-600 hover:bg-blue-700 border-white' : 'bg-blue-600 hover:bg-blue-500 border-[#0b1120]'
                                }`}
                        >
                            <Camera size={13} className="text-white" />
                        </button>
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
            </motion.div>

            {/* ── Stat cards ── */}
            <motion.div
                custom={2} variants={fadeUp} initial="hidden" animate="show"
                className="grid grid-cols-3 gap-2.5"
            >
                {[
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
                ))}
            </motion.div>

            {/* ── Info sections ── */}
            <div className="grid grid-cols-2 gap-2.5">
                {/* Aloqa */}
                <motion.section
                    custom={3} variants={fadeUp} initial="hidden" animate="show"
                    className={`group border rounded-[20px] p-4 transition-colors space-y-4 ${isLight ? 'bg-slate-100 border-slate-300 hover:border-blue-400' : 'bg-[#0b1120] border-white/[0.07] hover:border-blue-500/25'
                        }`}
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
                </motion.section>

                {/* Turar joy */}
                <motion.section
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
                </motion.section>
            </div>

            {/* ── Timeline ── */}
            <motion.div
                custom={5} variants={fadeUp} initial="hidden" animate="show"
                className={`border rounded-[20px] p-4 transition-colors ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0b1120] border-white/[0.07]'
                    }`}
            >
                <h3 className={`text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-1.5 mb-5 ${isLight ? 'text-slate-600' : 'text-slate-500'
                    }`}>
                    <span className={`block w-0.5 h-3 rounded-full ${isLight ? 'bg-violet-600' : 'bg-violet-500'}`} />
                    Ta'lim davri
                </h3>
                <Timeline course={course} isLight={isLight} />
            </motion.div>

            {/* ── Actions ── */}
            <motion.div
                custom={6} variants={fadeUp} initial="hidden" animate="show"
                className="flex gap-2.5"
            >
                <button className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all hover:-translate-y-0.5 active:scale-95 ${isLight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-[#020617] hover:bg-blue-500 hover:text-white'
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

        </div>
    )
}
