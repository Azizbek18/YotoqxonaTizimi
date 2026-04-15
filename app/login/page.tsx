'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, ChevronRight, House, CheckCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
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
      const { data: userExists, error: checkError } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', cleanEmail)
        .maybeSingle()

      if (!userExists) {
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
      const { data: userRecord } = await supabase
        .from('users')
        .select('role')
        .eq('id', authData.user?.id)
        .single()

      show3DToast('success', 'Xush kelibsiz!')
      
      setTimeout(() => {
        router.push(userRecord?.role === 'tarbiyachi' ? '/tarbiyachi/talabalar' : '/talaba/dashboard')
      }, 1000)

    } catch (err: any) {
      show3DToast('error', err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#020617] flex items-center justify-center p-3 sm:p-5 relative overflow-hidden">
      {/* Static Background Glows */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-[320px] sm:max-w-[440px]">
        {/* Logo Section */}
        <div className="text-center mb-6 sm:mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl mb-4 p-[1px]">
            <div className="w-full h-full bg-[#020617] rounded-[15px] flex items-center justify-center text-blue-500">
              <House size={28} className="sm:size-[40px]" />
            </div>
          </div>
          <h1 className="text-xl sm:text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
            Yotoqxona Tizimi
          </h1>
        </div>

        {/* Card Container - No tilt animation */}
        <div className="relative bg-[#0b1120]/80 backdrop-blur-3xl border border-white/10 rounded-[24px] sm:rounded-[40px] p-3 sm:p-5 sm:p-10 shadow-2xl overflow-hidden">
          
          {/* Tabs */}
          <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 sm:mb-10 border border-white/5">
            <div className="flex-1 py-2 sm:py-3 text-center text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg text-white bg-blue-600 shadow-lg">Kirish</div>
            <Link href="/register" className="flex-1 py-2 sm:py-3 text-center text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg text-slate-500 hover:text-white transition-all italic">Ro'yxatdan o'tish</Link>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2 block">Email Manzil</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="misol@gmail.com"
                  className="w-full bg-white/[0.03] border border-white/10 p-3 pl-12 rounded-xl text-sm text-white outline-none focus:border-blue-500/50 transition-all font-sans"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2 block">Maxfiy Parol</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/[0.03] border border-white/10 p-3 pl-12 pr-12 rounded-xl text-sm text-white outline-none focus:border-blue-500/50 transition-all font-sans"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              disabled={loading}
              className={`w-full h-12 sm:h-14 rounded-xl sm:rounded-[22px] font-black text-[10px] sm:text-[12px] tracking-widest uppercase flex items-center justify-center gap-2 transition-all ${loading ? 'bg-white/5 text-slate-600' : 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl hover:shadow-blue-600/20 active:scale-[0.98]'}`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Tizimga kirish</span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[14px] sm:text-[14px] text-shadow-amber-500 text-slate-500 font-bold">
              Parolni unutdingizmi?{' '}
              <Link href="/forgot-password" className="text-blue-500 hover:underline">Tiklash</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}