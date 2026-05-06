"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ArrowLeft, Send, Sparkles, Orbit, CheckCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { useThemeStore } from '@/lib/stores/theme-store'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [mounted, setMounted] = useState(false)
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  useEffect(() => setMounted(true), [])

  // 3D Toast Funksiyasi (Emerald rangiga moslangan)
  const show3DToast = (type: 'success' | 'error', message: string) => {
    toast.custom((t) => (
      <AnimatePresence>
        {t.visible && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-3 p-4 rounded-2xl bg-[#0b1120]/95 backdrop-blur-xl border border-emerald-500/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-w-[90vw] sm:max-w-md w-full"
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

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return show3DToast('error', "Emailni kiriting")

    setLoading(true)
    try {
      const cleanEmail = email.trim().toLowerCase()

      // 1. QADAM: Tekshirish (Data massiv sifatida olinadi)
      const { data: users, error: checkError } = await supabase
        .from('users')
        .select('email')
        .eq('email', cleanEmail)

      // AGAR SUPABASE XATO QAYTARSA:
      if (checkError) {
        console.error("Supabase xatosi tafsiloti:", checkError)
        throw new Error(`Baza bilan aloqa uzildi: ${checkError.message}`)
      }

      // AGAR FOYDALANUVCHI TOPILMASA:
      if (!users || users.length === 0) {
        throw new Error("Bunday email bilan ro'yxatdan o'tilmagan!")
      }

      // 2. QADAM: Parol tiklash
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/update-password`,
      })

      if (resetError) throw resetError

      setIsSent(true)
      show3DToast('success', "Parolni tiklash signali yuborildi!")

    } catch (error: unknown) {
      // Xatolikni konsolga chiqaramiz (F12 ni bosib ko'rish uchun)
      const errorMessage = error instanceof Error ? error.message : 'Noma\'lum xatolik'
      console.error("Login xatosi:", error)
      show3DToast('error', errorMessage || "Xatolik yuz berdi")
    } finally {
      setLoading(false)
    }
  }

  const stars = mounted ? Array.from({ length: 45 }) : []

  return (
    <main className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100' : 'bg-[#020617]'}`}>
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Fon effektlari */}
      <div className={`absolute inset-0 z-0 ${isLight ? 'opacity-30' : ''}`}>
        {stars.map((_, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full blur-[0.5px] ${isLight ? 'bg-blue-400' : 'bg-emerald-200'}`}
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 2.5}px`,
              height: `${Math.random() * 2.5}px`,
            }}
          />
        ))}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-87.5 h-87.5 bg-emerald-500/10 rounded-full blur-[130px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-100"
      >
        <div className={`backdrop-blur-3xl border rounded-[2.5rem] p-6 sm:p-10 shadow-2xl ${isLight ? 'bg-white/80 border-slate-200' : 'bg-slate-900/60 border-emerald-500/10'}`}>
          <Link href="/login" className={`inline-flex items-center gap-2 transition-colors mb-8 text-[10px] font-black uppercase tracking-[0.2em] group ${isLight ? 'text-slate-600 hover:text-slate-700' : 'text-emerald-600/60 hover:text-emerald-400'}`}>
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            Kirishga qaytish
          </Link>

          <AnimatePresence mode="wait">
            {!isSent ? (
              <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="mb-10">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border ${isLight ? 'bg-blue-100 text-blue-600 border-blue-300' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}
                  >
                    <Orbit size={28} />
                  </motion.div>
                  <h1 className={`text-2xl sm:text-3xl font-black tracking-tighter uppercase leading-none ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Parolni <span className={`italic ${isLight ? 'text-blue-600' : 'text-emerald-500'}`}>Qayta Tiklash</span>
                  </h1>
                </div>

                <form onSubmit={handleReset} className="space-y-5">
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-[0.4em] ml-2 ${isLight ? 'text-slate-600' : 'text-emerald-500/50'}`}>Email Manzil</label>
                    <div className="relative group">
                      <div className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${isLight ? 'text-slate-400 group-focus-within:text-blue-600' : 'text-slate-600 group-focus-within:text-emerald-400'}`}>
                        <Mail size={18} />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        placeholder="pochta@manzil.uz"
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full border p-4 pl-14 rounded-2xl text-sm outline-none transition-all ${isLight ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200' : 'bg-slate-800/40 border-white/15 text-white placeholder:text-slate-400 focus:border-emerald-500/50 focus:bg-slate-800/50'}`}
                      />
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    disabled={loading}
                    className={`w-full h-14 sm:h-16 rounded-2xl font-black text-[11px] tracking-[0.3em] uppercase text-white flex items-center justify-center gap-3 transition-all shadow-lg ${loading ? isLight ? 'bg-slate-200 text-slate-400' : 'bg-white/5 text-slate-600' : isLight ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                  >
                    {loading ? (
                      <div className={`w-5 h-5 border-2 rounded-full animate-spin ${isLight ? 'border-slate-300 border-t-slate-600' : 'border-white/20 border-t-white'}`} />
                    ) : (
                      <>
                        <span>Yuborish</span>
                        <Send size={16} />
                      </>
                    )}
                  </motion.button>
                </form>
              </motion.div>
            ) : (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mx-auto mb-6 border border-emerald-500/20">
                  <Sparkles size={32} className="animate-pulse" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase mb-3">Havola Yuborildi</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-8 px-4">
                  <span className="text-emerald-400">{email}</span> manziliga xat yubordik.
                </p>
                <button onClick={() => setIsSent(false)} className="text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-emerald-400 transition-colors">
                  Boshqa email kiritish
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </main>
  )
}