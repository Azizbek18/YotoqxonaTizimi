'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
    Mail, Phone, GraduationCap, Home,
    ShieldCheck, LogOut, Camera, Edit2, Lock,
} from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

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
const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    show: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
    }),
}

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

function Timeline({ course }: { course: number }) {
    const steps = [1, 2, 3, 4].map((n) => ({
        n,
        year: String(2021 + n),
        state: (course > n ? 'done' : course === n ? 'active' : 'todo') as StepState,
    }))

    const cls: Record<StepState, string> = {
        done: 'bg-blue-700 text-blue-200',
        active: 'bg-violet-600 text-white ring-4 ring-violet-500/25',
        todo: 'bg-slate-800 text-slate-600',
    }

    return (
        <div className="flex items-start w-full">
            {steps.map((s, i) => (
                <div key={s.n} className="flex-1 flex flex-col items-center relative">
                    {i < 3 && (
                        <div className="absolute top-4 left-1/2 w-full h-px bg-white/[0.05]" />
                    )}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black z-10 mb-1.5 ${cls[s.state]}`}>
                        {s.n}
                    </div>
                    <p className={`text-[10px] font-bold ${s.state === 'active' ? 'text-violet-400' : 'text-slate-600'}`}>
                        {s.n}-kurs
                    </p>
                    <p className="text-[9px] text-slate-700">{s.year}</p>
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
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.18em] mb-0.5">{label}</p>
                <p className="text-sm font-bold text-slate-100 truncate">{value}</p>
            </div>
        </div>
    )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StudentProfile() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)

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
        <div className="space-y-4">

            {/* ── Header ── */}
            <motion.div
                custom={0} variants={fadeUp} initial="hidden" animate="show"
                className="flex items-center justify-between pt-2 pb-4 border-b border-white/[0.05]"
            >
                <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">
                    Shaxsiy<br />Profil
                </h1>

                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-[11px] font-black uppercase tracking-wide hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                >
                    <LogOut size={14} />
                    Chiqish
                </button>
            </motion.div>

            {/* ── Hero card ── */}
            <motion.div
                custom={1} variants={fadeUp} initial="hidden" animate="show"
                className="relative overflow-hidden bg-[#0b1120] border border-white/[0.07] rounded-[24px] p-5"
            >
                {/* Decorative glow */}
                <div
                    className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none opacity-15"
                    style={{ background: 'radial-gradient(circle, #2563eb, transparent 70%)' }}
                />

                <div className="flex items-center gap-5 relative z-10">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                        <div
                            className="w-24 h-24 rounded-full p-[2px]"
                            style={{ background: 'linear-gradient(135deg, #2563eb, #6366f1)' }}
                        >
                            <div className="w-full h-full rounded-full bg-[#020617] flex items-center justify-center overflow-hidden">
                                {profile?.avatar_url ? (
                                    <img
                                        src={profile.avatar_url}
                                        alt={fullName}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-2xl font-black text-indigo-400/50 select-none">
                                        {initials}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            aria-label="Rasm yuklash"
                            className="absolute bottom-0.5 right-0.5 w-7 h-7 bg-blue-600 hover:bg-blue-500 rounded-full border-2 border-[#0b1120] flex items-center justify-center transition-all hover:scale-110"
                        >
                            <Camera size={13} className="text-white" />
                        </button>
                    </div>

                    {/* Info */}
                    <div className="min-w-0 space-y-2">
                        <h2 className="text-2xl font-black text-white leading-tight truncate">
                            {fullName}
                        </h2>

                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase">
                            <ShieldCheck size={11} />
                            Faol Talaba
                        </span>

                        <p className="text-blue-400 font-bold text-[10px] uppercase tracking-[0.2em] truncate">
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
                        className="bg-[#0b1120] border border-white/[0.06] rounded-2xl p-3.5 text-center"
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
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.18em]">
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
                    className="group bg-[#0b1120] border border-white/[0.07] rounded-[20px] p-4 hover:border-blue-500/25 transition-colors space-y-4"
                >
                    <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-1.5">
                        <span className="block w-0.5 h-3 bg-blue-500 rounded-full" />
                        Aloqa
                    </h3>
                    <InfoRow
                        icon={<Mail size={17} />}
                        label="Email"
                        value={email}
                        bg="rgba(59,130,246,0.1)"
                        color="#60a5fa"
                    />
                    <InfoRow
                        icon={<Phone size={17} />}
                        label="Telefon"
                        value={phone}
                        bg="rgba(99,102,241,0.1)"
                        color="#a5b4fc"
                    />
                </motion.section>

                {/* Turar joy */}
                <motion.section
                    custom={4} variants={fadeUp} initial="hidden" animate="show"
                    className="group bg-[#0b1120] border border-white/[0.07] rounded-[20px] p-4 hover:border-emerald-500/25 transition-colors space-y-4"
                >
                    <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-1.5">
                        <span className="block w-0.5 h-3 bg-emerald-500 rounded-full" />
                        Turar joy
                    </h3>
                    <InfoRow
                        icon={<Home size={17} />}
                        label="Xona"
                        value={roomNumber}
                        bg="rgba(16,185,129,0.1)"
                        color="#34d399"
                    />
                    <InfoRow
                        icon={<GraduationCap size={17} />}
                        label="Kurs / Guruh"
                        value={`${course}-kurs, ${group}-guruh`}
                        bg="rgba(245,158,11,0.1)"
                        color="#fcd34d"
                    />
                </motion.section>
            </div>

            {/* ── Timeline ── */}
            <motion.div
                custom={5} variants={fadeUp} initial="hidden" animate="show"
                className="bg-[#0b1120] border border-white/[0.07] rounded-[20px] p-4"
            >
                <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-1.5 mb-5">
                    <span className="block w-0.5 h-3 bg-violet-500 rounded-full" />
                    Ta'lim davri
                </h3>
                <Timeline course={course} />
            </motion.div>

            {/* ── Actions ── */}
            <motion.div
                custom={6} variants={fadeUp} initial="hidden" animate="show"
                className="flex gap-2.5"
            >
                <button className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white text-[#020617] font-black uppercase tracking-widest text-[11px] hover:bg-blue-500 hover:text-white transition-all hover:-translate-y-0.5 active:scale-95">
                    <Edit2 size={15} />
                    Tahrirlash
                </button>
                <button className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-black uppercase text-[11px] hover:bg-indigo-500/20 transition-all active:scale-95">
                    <Lock size={15} />
                    Parol
                </button>
            </motion.div>

        </div>
    )
}
