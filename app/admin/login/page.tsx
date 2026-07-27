'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2 } from 'next/font/google'
import { supabase } from '@/lib/supabase'
import {
    Mail,
    Lock,
    Shield,
    Eye,
    EyeOff,
    ChevronRight,
    KeyRound,
} from 'lucide-react'
import toast from 'react-hot-toast'

const baloo2 = Baloo_2({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export default function AdminLoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [focusedField, setFocusedField] = useState<string | null>(null)

    const show3DToast = (type: 'success' | 'error', message: string) => {
        if (type === 'success') {
            toast.success(message)
        } else {
            toast.error(message)
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email || !password) {
            return show3DToast('error', "Ma'lumotlarni to'liq kiriting")
        }

        setLoading(true)
        try {
            const cleanEmail = email.trim().toLowerCase()

            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password,
            })

            if (authError) {
                if (authError.message.includes('Invalid login credentials')) {
                    throw new Error("Xato parol kiritildi! Tekshirib qaytadan kiriting.")
                }
                throw new Error(authError.message)
            }

            const roleResponse = await fetch('/api/auth/resolve-role', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authData.session?.access_token ? { Authorization: `Bearer ${authData.session.access_token}` } : {}),
                },
            })
            const roleResult: { ok: boolean; role?: 'admin' | 'tarbiyachi' | 'talaba' | null; error?: string } = await roleResponse.json()

            if (!roleResponse.ok || !roleResult.ok) {
                await supabase.auth.signOut()
                throw new Error(roleResult.error ?? "Foydalanuvchi rolini aniqlab bo'lmadi")
            }

            if (roleResult.role !== 'admin') {
                await supabase.auth.signOut()
                throw new Error("Sizning akkauntingiz admin sifatida biriktirilmagan!")
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
        <main className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] p-3 sm:p-5 ${baloo2.className}`} style={{ fontFamily: baloo2.style.fontFamily }}>
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes sweep {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .cyber-border {
                    background: linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
                    padding: 1px;
                    border-radius: 12px;
                    transition: all 0.35s ease;
                }
                .cyber-border.focused {
                    background: linear-gradient(90deg, #6366f1, #3b82f6, #ec4899, #6366f1);
                    background-size: 200% 200%;
                    animation: sweep 2s linear infinite;
                    box-shadow: 0 0 12px rgba(99, 102, 241, 0.15);
                }
                .cyber-input-inner {
                    background: rgba(11, 17, 32, 0.75);
                    backdrop-filter: blur(15px);
                    border-radius: 11px;
                    transition: all 0.3s ease;
                }
            `}} />
            <div className="pointer-events-none absolute left-0 top-0 h-full w-full">
                <div className="absolute left-[-10%] top-[-10%] h-[50%] w-[50%] rounded-full bg-blue-500/10 blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-indigo-500/10 blur-[100px]" />
            </div>

            <div className="relative z-10 w-full max-w-[320px] sm:max-w-110">
                <div className="mb-6 text-center sm:mb-10">
                    <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 p-px shadow-xl sm:h-20 sm:w-20">
                        <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-[#020617] text-blue-500">
                            <Shield className="h-7 w-7 sm:h-10 sm:w-10" />
                        </div>
                    </div>
                    <h1
                        className="text-xl font-black uppercase italic leading-none tracking-tighter text-white sm:text-4xl"
                        style={{ fontFamily: baloo2.style.fontFamily }}
                    >
                        Admin Portali
                    </h1>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 sm:text-xs">
                        Xavfsiz kirish oynasi
                    </p>
                </div>

                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b1120]/80 p-3 shadow-2xl backdrop-blur-3xl sm:rounded-4xl sm:p-10">
                    <div className="mb-6 flex gap-1 rounded-xl border border-white/5 bg-white/5 p-1 sm:mb-8">
                        <div className="flex-1 rounded-lg bg-blue-600 py-2 text-center text-[8px] font-black uppercase tracking-widest text-white shadow-lg sm:py-3 sm:text-[10px]">
                            Kirish
                        </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
                        <div className="space-y-2">
                            <label className="ml-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">
                                Admin email
                            </label>
                            <div className={`cyber-border ${focusedField === 'email' ? 'focused' : ''}`}>
                                <div className="cyber-input-inner relative">
                                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${focusedField === 'email' ? 'text-blue-500 scale-110 drop-shadow-[0_0_8px_#3b82f6]' : 'text-slate-600'}`}>
                                        <Mail size={18} />
                                    </div>
                                    {focusedField === 'email' && (
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-blue-500/10 blur-[6px] pointer-events-none" />
                                    )}
                                    <input
                                        type="email"
                                        value={email}
                                        onFocus={() => setFocusedField('email')}
                                        onBlur={() => setFocusedField(null)}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="admin@system.local"
                                        className="w-full bg-transparent p-3 pl-12 rounded-xl text-sm text-white outline-none transition-colors placeholder:text-slate-500"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="ml-2 block text-[9px] font-black uppercase tracking-widest text-slate-500">
                                Maxfiy parol
                            </label>
                            <div className={`cyber-border ${focusedField === 'password' ? 'focused' : ''}`}>
                                <div className="cyber-input-inner relative">
                                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${focusedField === 'password' ? 'text-blue-500 scale-110 drop-shadow-[0_0_8px_#3b82f6]' : 'text-slate-600'}`}>
                                        <Lock size={18} />
                                    </div>
                                    {focusedField === 'password' && (
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-blue-500/10 blur-[6px] pointer-events-none" />
                                    )}
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onFocus={() => setFocusedField('password')}
                                        onBlur={() => setFocusedField(null)}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="********"
                                        className="w-full bg-transparent p-3 pl-12 pr-12 rounded-xl text-sm text-white outline-none transition-colors placeholder:text-slate-500"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-500 transition-colors hover:text-white"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl font-black uppercase tracking-widest transition-all sm:h-14 sm:rounded-[22px] sm:text-[12px] ${loading
                                ? 'bg-white/5 text-slate-600'
                                : 'bg-linear-to-r from-blue-600 to-indigo-700 text-white hover:shadow-blue-600/20 active:scale-[0.98]'
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
