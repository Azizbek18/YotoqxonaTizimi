'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Mail,
    Lock,
    Shield,
    CheckCircle,
    AlertTriangle,
    Eye,
    EyeOff,
    ChevronRight,
    KeyRound,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminLoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)

    const show3DToast = (type: 'success' | 'error', message: string) => {
        toast.custom(
            (t) => (
                <AnimatePresence>
                    {t.visible && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex w-full max-w-[90vw] items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1120]/95 p-4 shadow-2xl backdrop-blur-xl sm:max-w-md"
                        >
                            <div
                                className={`flex items-center justify-center rounded-xl p-2 ${type === 'success'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-rose-500/10 text-rose-400'
                                    }`}
                            >
                                {type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                            </div>
                            <div className="flex-1">
                                <p
                                    className={`text-[10px] font-black uppercase tracking-wider ${type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                                        }`}
                                >
                                    {type === 'success' ? 'Muvaffaqiyat' : 'Tizim xabari'}
                                </p>
                                <p className="mt-0.5 text-xs font-medium text-slate-200">{message}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            ),
            { duration: 4000 }
        )
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email || !password) {
            return show3DToast('error', "Ma'lumotlarni to'liq kiriting")
        }

        setLoading(true)
        try {
            const cleanEmail = email.trim().toLowerCase()

            const { data: userExists } = await supabase
                .from('staff')
                .select('id, email, role')
                .eq('email', cleanEmail)
                .maybeSingle()

            if (!userExists) {
                throw new Error("Bunday foydalanuvchi ro'yxatdan o'tmagan!")
            }

            if (userExists.role !== 'admin') {
                throw new Error("Siz admin huquqlari bilan ro'yxatdan o'tmagansiz!")
            }

            const { error: authError } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password,
            })

            if (authError) {
                if (authError.message.includes('Invalid login credentials')) {
                    throw new Error("Xato parol kiritildi! Tekshirib qaytadan kiriting.")
                }
                throw new Error(authError.message)
            }

            show3DToast('success', 'Admin paneliga xush kelibsiz!')

            setTimeout(() => {
                router.push('/admin/dashboard')
            }, 1000)
        } catch (err) {
            const error = err as Error
            show3DToast('error', error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] p-3 sm:p-5">
            <div className="pointer-events-none absolute left-0 top-0 h-full w-full">
                <div className="absolute left-[-10%] top-[-10%] h-[50%] w-[50%] rounded-full bg-blue-500/10 blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-indigo-500/10 blur-[100px]" />
            </div>

            <div className="relative z-10 w-full max-w-[320px] sm:max-w-[440px]">
                <div className="mb-6 text-center sm:mb-10">
                    <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-[1px] shadow-xl sm:h-20 sm:w-20">
                        <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-[#020617] text-blue-500">
                            <Shield size={28} className="sm:size-[40px]" />
                        </div>
                    </div>
                    <h1 className="text-xl font-black uppercase italic leading-none tracking-tighter text-white sm:text-4xl">
                        Admin Portali
                    </h1>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 sm:text-xs">
                        Xavfsiz kirish oynasi
                    </p>
                </div>

                <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#0b1120]/80 p-3 shadow-2xl backdrop-blur-3xl sm:rounded-[40px] sm:p-10">
                    <div className="mb-6 flex gap-1 rounded-xl border border-white/5 bg-white/5 p-1 sm:mb-8">
                        <div className="flex-1 rounded-lg bg-blue-600 py-2 text-center text-[8px] font-black uppercase tracking-widest text-white shadow-lg sm:py-3 sm:text-[10px]">
                            Kirish
                        </div>
                        <Link
                            href="/admin/register"
                            className="flex-1 py-2 text-center text-[8px] font-black uppercase tracking-widest text-slate-500 transition-all hover:text-white sm:py-3 sm:text-[10px]"
                        >
                            Ro&apos;yxatdan o&apos;tish
                        </Link>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
                        <div className="space-y-2">
                            <label className="ml-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">
                                Admin email
                            </label>
                            <div className="group relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-blue-500">
                                    <Mail size={18} />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@system.local"
                                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 pl-12 text-sm text-white outline-none transition-all focus:border-blue-500/50"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="ml-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">
                                Maxfiy parol
                            </label>
                            <div className="group relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors group-focus-within:text-blue-500">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="********"
                                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 pl-12 pr-12 text-sm text-white outline-none transition-all focus:border-blue-500/50"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-white"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl font-black uppercase tracking-widest transition-all sm:h-14 sm:rounded-[22px] sm:text-[12px] ${loading
                                ? 'bg-white/5 text-slate-600'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl hover:shadow-blue-600/20 active:scale-[0.98]'
                                } text-[10px]`}
                        >
                            {loading ? (
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                            ) : (
                                <>
                                    <span>Admin panelga kirish</span>
                                    <ChevronRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 grid grid-cols-1 gap-2 text-center sm:grid-cols-2">
                        <Link
                            href="/forgot-password"
                            className="rounded-xl border border-white/5 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all hover:border-blue-500/30 hover:bg-white/5 hover:text-white"
                        >
                            <span className="inline-flex items-center gap-2">
                                <KeyRound size={14} />
                                Parolni tiklash
                            </span>
                        </Link>
                        <Link
                            href="/login"
                            className="rounded-xl border border-white/5 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:border-white/10 hover:bg-white/5 hover:text-white"
                        >
                            Oddiy kirish
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    )
}
