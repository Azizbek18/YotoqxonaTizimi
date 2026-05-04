'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { findRoleByUserId } from '@/lib/auth-tables'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, ChevronRight, House, CheckCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { useThemeStore } from '@/lib/stores/theme-store'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const isStudentFlow = searchParams.get('student') === '1'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const show3DToast = (type: 'success' | 'error', message: string) => {
    toast.custom((t) => (
      <AnimatePresence>
        {t.visible && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-3 p-4 rounded-2xl bg-[#0b1120]/95 backdrop-blur-xl border border-white/10 shadow-2xl max-w-[90vw] sm:max-w-md w-full"
          >
            <div className={`flex items-center justify-center p-2 rounded-xl ${type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div className="flex-1">
              <p className={`text-[10px] font-black uppercase tracking-wider ${type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {type === 'success' ? 'Muvaffaqiyat' : 'Tizim xabari'}
              </p>
              <p className="text-xs font-medium text-slate-200 mt-0.5">{message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    ), { duration: 4000 });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return show3DToast('error', "Ma'lumotlarni to'liq kiriting")

    setLoading(true)
    try {
      const cleanEmail = email.trim().toLowerCase()

      // 1. Birinchi navbatda foydalanuvchi ro'yxatdan o'tganmi yoki yo'qligini tekshiramiz
      const [{ data: userExists }, { data: staffExists }] = await Promise.all([
        supabase.from('users').select('id, email').eq('email', cleanEmail).maybeSingle(),
        supabase.from('staff').select('id, email, role').eq('email', cleanEmail).maybeSingle(),
      ])

      if (!userExists && !staffExists) {
        throw new Error("Bunday foydalanuvchi ro'yxatdan o'tmagan!")
      }

      // 2. Foydalanuvchi bor bo'lsa, endi tizimga kirishga urinib ko'ramiz
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      })

      // Agar parol xato bo'lsa Supabase 'Invalid login credentials' qaytaradi
      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          throw new Error("Xato parol kiritildi! Tekshirib qaytadan kiriting.")
        }
        throw new Error(authError.message)
      }

      // 3. Tizimga kirish muvaffaqiyatli bo'lsa, rolini aniqlaymiz
      const userRole = authData.user?.id ? await findRoleByUserId(supabase, authData.user.id) : null
      show3DToast('success', 'Xush kelibsiz!')

      setTimeout(() => {
        // Rol asosida yantiqlash
        if (userRole === 'admin') {
          router.push('/admin/dashboard')
        } else if (userRole === 'tarbiyachi') {
          router.push('/tarbiyachi/dashboard')
        } else {
          router.push('/talaba/dashboard')
        }
      }, 1000)

    } catch (err) {
      const error = err as Error
      show3DToast('error', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={`min-h-screen flex items-center justify-center p-3 sm:p-5 relative overflow-hidden ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100' : 'bg-[#020617]'}`}>
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Static Background Glows */}
      <div className={`absolute top-0 left-0 w-full h-full pointer-events-none ${isLight ? 'opacity-30' : ''}`}>
        <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] ${isLight ? 'bg-blue-200' : 'bg-blue-500/10'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] ${isLight ? 'bg-indigo-200' : 'bg-indigo-500/10'}`} />
      </div>

      <div className="relative z-10 w-full max-w-[320px] sm:max-w-110">
        {/* Logo Section */}
        <div className="text-center mb-6 sm:mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-xl mb-4 p-px">
            <div className={`w-full h-full rounded-[15px] flex items-center justify-center ${isLight ? 'bg-white text-blue-600' : 'bg-[#020617] text-blue-500'}`}>
              <House className="h-7 w-7 sm:h-10 sm:w-10" />
            </div>
          </div>
          <h1 className={`text-xl sm:text-4xl font-black tracking-tighter uppercase italic leading-none ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Yotoqxona Tizimi
          </h1>
        </div>

        <div className={`relative backdrop-blur-3xl border rounded-3xl sm:rounded-4xl p-3 sm:p-10 shadow-2xl overflow-hidden ${isLight ? 'bg-white/80 border-slate-200' : 'bg-[#0b1120]/80 border-white/10'}`}>

          {/* Tabs */}
          <div className={`flex gap-1 rounded-xl p-1 mb-6 sm:mb-10 border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/5'}`}>
            <div className={`flex-1 py-2 sm:py-3 text-center text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg ${isLight ? 'text-white bg-blue-600' : 'text-white bg-blue-600'}`}>Kirish</div>
            <Link href="/register" className={`flex-1 py-2 sm:py-3 text-center text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg transition-all italic ${isLight ? 'text-slate-500 hover:text-slate-700' : 'text-slate-500 hover:text-white'}`}>Ro&apos;yxatdan o&apos;tish</Link>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <label className={`text-[9px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>Email Manzil</label>
              <div className="relative group">
                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-blue-500 ${isLight ? 'text-slate-400 group-focus-within:text-blue-600' : 'text-slate-600'}`}>
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="misol@gmail.com"
                  className={`w-full border p-3 pl-12 rounded-xl text-sm outline-none transition-all font-sans ${isLight ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200' : 'bg-slate-900/30 border-white/15 text-white placeholder:text-slate-400 focus:border-blue-500/50 focus:bg-slate-900/40'}`}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className={`text-[9px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>Maxfiy Parol</label>
              <div className="relative group">
                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-blue-500 ${isLight ? 'text-slate-400 group-focus-within:text-blue-600' : 'text-slate-600'}`}>
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full border p-3 pl-12 pr-12 rounded-xl text-sm outline-none transition-all font-sans ${isLight ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200' : 'bg-slate-900/30 border-white/15 text-white placeholder:text-slate-400 focus:border-blue-500/50 focus:bg-slate-900/40'}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-white'}`}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              disabled={loading}
              className={`w-full h-12 sm:h-14 rounded-xl sm:rounded-[22px] font-black text-[10px] sm:text-[12px] tracking-widest uppercase flex items-center justify-center gap-2 transition-all ${loading ? isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-600' : isLight ? 'bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-[0.98]' : 'bg-linear-to-r from-blue-600 to-indigo-700 text-white shadow-xl hover:shadow-blue-600/20 active:scale-[0.98]'}`}
            >
              {loading ? (
                <div className={`w-5 h-5 border-2 rounded-full animate-spin ${isLight ? 'border-slate-300 border-t-slate-600' : 'border-white/20 border-t-white'}`} />
              ) : (
                <>
                  <span>Tizimga kirish</span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className={`text-[14px] sm:text-[14px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>
              Parolni unutdingizmi?{' '}
              <Link href="/forgot-password" className={`hover:underline ${isLight ? 'text-blue-600 hover:text-blue-700' : 'text-blue-500'}`}>Tiklash</Link>
            </p>
          </div>

          {!isStudentFlow && (
            <div className="mt-4 text-center opacity-5 hover:opacity-40 transition-opacity">
              <Link href="/admin/login" className="text-[8px] text-slate-600 uppercase tracking-widest">Admin panelga kirish</Link>
            </div>
          )}
          {/* Hidden Admin Access Point */}
          <div
            className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-white/5 cursor-pointer opacity-0 hover:opacity-20 transition-opacity duration-300"
            onClick={() => router.push('/admin/login')}
            title="Admin Panel"
          />
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#020617]" />}>
      <LoginContent />
    </Suspense>
  )
}
