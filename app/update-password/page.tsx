"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import { Lock, Eye, EyeOff, Save, ShieldCheck, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { useThemeStore } from '@/lib/stores/theme-store'

export default function UpdatePassword() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [mounted, setMounted] = useState(false)
    const router = useRouter()
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'

    useEffect(() => setMounted(true), [])

    // --- 3D INTERACTIVE EFFECTS ---
    const x = useMotionValue(0)
    const y = useMotionValue(0)
    const mouseXSpring = useSpring(x)
    const mouseYSpring = useSpring(y)
    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"])
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"])

    // --- PASSWORD STRENGTH LOGIC ---
    const checks = {
        length: password.length >= 8,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
    }
    const strength = Object.values(checks).filter(Boolean).length

    const show3DToast = (type: 'success' | 'error', message: string) => {
        toast.custom((t) => (
            <AnimatePresence>
                {t.visible && (
                    <motion.div
                        initial={{ opacity: 0, y: -50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.9 }}
                        className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl bg-[#0b1120]/90 backdrop-blur-3xl border border-white/10 shadow-2xl max-w-[90vw] sm:max-w-md w-full relative overflow-hidden z-999"
                    >
                        <div className={`absolute -inset-1 rounded-2xl blur-2xl opacity-10 ${type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <div className={`flex items-center justify-center p-2 sm:p-3 rounded-xl ${type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                            {type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                        </div>
                        <div className="flex-1 text-left">
                            <p className={`text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] ${type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {type === 'success' ? 'Muvaffaqiyat' : 'Tizim xabari'}
                            </p>
                            <p className="text-xs sm:text-sm font-medium text-slate-200 mt-0.5 sm:mt-1 leading-tight sm:leading-relaxed">{message}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        ), { duration: 4000 });
    }

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (strength < 4) return show3DToast('error', "Barcha xavfsizlik shartlarini bajaring!")
        if (password !== confirmPassword) return show3DToast('error', "Parollar bir-biriga mos kelmadi!")

        setLoading(true)
        try {
            const { error } = await supabase.auth.updateUser({ password })
            if (error) {
                if (error.message.includes("New password should be different")) throw new Error("Yangi parol eskisi bilan bir xil bo'lmasligi kerak!")
                throw error
            }
            show3DToast('success', "Parolingiz muvaffaqiyatli yangilandi!")
            setTimeout(() => router.push('/login'), 2000)
        } catch (err: any) {
            show3DToast('error', err.message || "Xatolik yuz berdi")
        } finally {
            setLoading(false)
        }
    }

    if (!mounted) return null;

    return (
        <main className={`min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden perspective-1000 ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100' : 'bg-[#020617]'}`}>
            {/* Theme Toggle */}
            <div className="absolute top-4 right-4 z-20">
                <ThemeToggle />
            </div>

            {/* Background Effects */}
            <div className={`absolute inset-0 pointer-events-none ${isLight ? 'opacity-40' : ''}`}>
                <div className={`absolute top-[-5%] left-[-5%] w-[60%] h-[60%] rounded-full blur-[100px] ${isLight ? 'bg-blue-200 animate-pulse' : 'bg-emerald-500/5 animate-pulse'}`} />
                <div className={`absolute bottom-[-5%] right-[-5%] w-[60%] h-[60%] rounded-full blur-[100px] ${isLight ? 'bg-indigo-200' : 'bg-blue-500/5'}`} />
            </div>

            <motion.div
                style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    x.set((e.clientX - rect.left) / rect.width - 0.5)
                    y.set((e.clientY - rect.top) / rect.height - 0.5)
                }}
                onMouseLeave={() => { x.set(0); y.set(0) }}
                className="relative z-10 w-full max-w-105"
            >
                <div className={`relative backdrop-blur-2xl border rounded-[2.5rem] p-6 sm:p-10 shadow-3xl overflow-hidden ${isLight ? 'bg-white/80 border-slate-200' : 'bg-[#0b1120]/70 border-white/10'}`}>

                    {/* Header */}
                    <div className="text-center mb-8 sm:mb-10">
                        <motion.div
                            animate={{ y: [0, -5, 0] }}
                            transition={{ repeat: Infinity, duration: 3 }}
                            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 border shadow-lg ${isLight ? 'bg-blue-100 text-blue-600 border-blue-300 shadow-blue-200' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/5'}`}
                        >
                            <ShieldCheck size={28} className="sm:w-8 sm:h-8" />
                        </motion.div>
                        <h1 className={`text-2xl sm:text-3xl font-black tracking-tighter uppercase italic ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            Yangi <span className={`not-italic ${isLight ? 'text-blue-600' : 'text-emerald-500'}`}>Himoya</span>
                        </h1>
                        <p className={`text-[10px] sm:text-xs mt-2 uppercase tracking-widest font-bold ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>Xavfsizlik darajasini oshiring</p>
                    </div>

                    <form onSubmit={handleUpdate} className="space-y-5 sm:space-y-6">
                        {/* New Password */}
                        <div className="space-y-2">
                            <label className={`text-[9px] font-black uppercase tracking-[0.3em] ml-2 block ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>Yangi Parol</label>
                            <div className="relative group">
                                <div className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors z-10 ${isLight ? 'text-slate-400 group-focus-within:text-blue-600' : 'text-slate-600 group-focus-within:text-emerald-500'}`}>
                                    <Lock size={18} />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className={`w-full border p-4 pl-13 pr-13 rounded-2xl placeholder:text-slate-400 text-sm outline-none transition-all ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200' : 'bg-slate-800/40 border-white/15 text-white focus:border-emerald-500/50 focus:bg-slate-800/50'}`}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className={`absolute right-5 top-1/2 -translate-y-1/2 transition-colors z-10 ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-emerald-400'}`}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            {/* Strength Logic */}
                            <div className="pt-2 px-1">
                                <div className="flex gap-1 mb-3">
                                    {[1, 2, 3, 4].map((step) => (
                                        <div
                                            key={step}
                                            className={`h-1 flex-1 rounded-full transition-all duration-500 ${strength >= step
                                                ? strength <= 2 ? 'bg-rose-500/60' : strength === 3 ? 'bg-amber-500/60' : isLight ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                                : isLight ? 'bg-slate-200' : 'bg-white/5'
                                                }`}
                                        />
                                    ))}
                                </div>
                                <div className={`grid grid-cols-2 gap-2 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-600'}`}>
                                    {Object.entries({ length: '8 ta belgi', upper: 'Katta harf', lower: 'Kichik harf', number: 'Raqam' }).map(([key, label]) => (
                                        <div key={key} className={`flex items-center gap-1.5 transition-colors ${checks[key as keyof typeof checks] ? isLight ? 'text-blue-600' : 'text-emerald-400' : ''}`}>
                                            <div className={`w-1 h-1 rounded-full ${checks[key as keyof typeof checks] ? isLight ? 'bg-blue-600 shadow-[0_0_4px_blue]' : 'bg-emerald-400 shadow-[0_0_4px_emerald]' : isLight ? 'bg-slate-400' : 'bg-slate-800'}`} />
                                            {label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-2">
                            <label className={`text-[9px] font-black uppercase tracking-[0.3em] ml-2 block ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>Tasdiqlash</label>
                            <div className="relative group">
                                <div className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors z-10 ${isLight ? 'text-slate-400 group-focus-within:text-blue-600' : 'text-slate-600 group-focus-within:text-emerald-400'}`}>
                                    <Lock size={18} />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className={`w-full border p-4 pl-13 rounded-2xl placeholder:text-slate-400 text-sm outline-none transition-all ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200' : 'bg-slate-800/40 border-white/15 text-white focus:border-emerald-500/50 focus:bg-slate-800/50'}`}
                                    required
                                />
                            </div>
                        </div>

                        {/* Submit */}
                        <motion.button
                            whileHover={!loading ? { scale: 1.01 } : {}}
                            whileTap={!loading ? { scale: 0.98 } : {}}
                            disabled={loading}
                            className={`w-full h-14 sm:h-16 rounded-2xl font-black text-[10px] sm:text-[11px] tracking-[0.3em] uppercase text-white shadow-xl flex items-center justify-center gap-3 relative overflow-hidden transition-all ${loading ? isLight ? 'bg-slate-200 text-slate-400' : 'bg-white/5 text-slate-600' : isLight ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-400/30' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20'}`}
                        >
                            {loading ? (
                                <div className={`w-5 h-5 border-2 rounded-full animate-spin ${isLight ? 'border-slate-300 border-t-slate-600' : 'border-white/20 border-t-white'}`} />
                            ) : (
                                <>
                                    <Sparkles size={16} />
                                    <span>Yangilash</span>
                                    <Save size={16} />
                                </>
                            )}
                            {!loading && (
                                <motion.div
                                    animate={{ x: ['-100%', '200%'] }}
                                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                                    className={`absolute top-0 h-full w-1/3 ${isLight ? 'bg-linear-to-r from-transparent via-blue-100/20 to-transparent' : 'bg-linear-to-r from-transparent via-white/10 to-transparent'} italic`}
                                />
                            )}
                        </motion.button>
                    </form>
                </div>
            </motion.div>

            <style jsx global>{`
                .perspective-1000 { perspective: 1000px; }
                input::placeholder { color: rgba(255,255,255,0.1); font-size: 12px; }
            `}</style>
        </main>
    )
}