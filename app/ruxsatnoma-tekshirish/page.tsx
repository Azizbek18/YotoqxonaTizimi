'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ShieldCheck, Search, FileText, CheckCircle2, XCircle, 
  HelpCircle, AlertTriangle, ChevronRight, House, LogIn 
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { useThemeStore } from '@/lib/stores/theme-store'

interface PermitRequest {
  id: string
  passport_series: string
  jshshir: string
  full_name: string
  email: string
  permit_url: string
  status: 'pending' | 'approved' | 'rejected' | 'registered'
  room_number: string | null
  reject_reason: string | null
}

function StatusCheckContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  // Input states
  const [passportSeries, setPassportSeries] = useState('')
  const [jshshir, setJshshir] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [result, setResult] = useState<PermitRequest | null>(null)

  // Auto search if params are present
  useEffect(() => {
    const passportParam = searchParams.get('passport')
    const jshshirParam = searchParams.get('jshshir')
    if (passportParam && jshshirParam) {
      setPassportSeries(passportParam)
      setJshshir(jshshirParam)
      handleSearch(passportParam, jshshirParam)
    }
  }, [searchParams])

  const showToast = (message: string) => {
    toast.error(message)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!passportSeries || !jshshir) {
      showToast("Pasport va JShSHIR ma'lumotlarini kiriting!")
      return
    }
    handleSearch(passportSeries, jshshir)
  }

  const handleSearch = async (passport: string, pin: string) => {
    setLoading(true)
    setSearched(true)
    setResult(null)

    try {
      const cleanPassport = passport.toUpperCase().replace(/\s/g, '')
      const cleanJshshir = pin.trim()

      const { data, error } = await supabase
        .from('permit_requests')
        .select('*')
        .eq('passport_series', cleanPassport)
        .eq('jshshir', cleanJshshir)
        .maybeSingle()

      if (error) throw new Error(error.message)

      if (data) {
        setResult(data as PermitRequest)
        if (typeof window !== 'undefined') {
          localStorage.setItem('student_permit_passport', cleanPassport)
          localStorage.setItem('student_permit_jshshir', cleanJshshir)
        }
      } else {
        setResult(null)
      }
    } catch (err: any) {
      showToast(err.message || 'Qidirishda xatolik yuz berdi')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-3 sm:p-6 relative overflow-x-hidden ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100 text-slate-900' : 'bg-[#020617] text-white'}`}>
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md my-4">
        <div className={`backdrop-blur-3xl border rounded-3xl sm:rounded-4xl p-5 sm:p-10 shadow-2xl overflow-hidden ${isLight ? 'bg-white/80 border-slate-200' : 'bg-[#0b1120]/80 border-white/10'}`}>
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-linear-to-br from-blue-500 to-indigo-650 shadow-xl mb-3.5 p-px">
              <div className={`w-full h-full rounded-full flex items-center justify-center ${isLight ? 'bg-white text-blue-600' : 'bg-[#020617] text-blue-500'}`}>
                <Search className="h-6 w-6" />
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight">Statusni Tekshirish</h1>
            <p className={`text-[10px] sm:text-xs font-medium mt-1.5 ${isLight ? 'text-slate-505' : 'text-slate-400'}`}>
              Pasport seriyasi va JShSHIR ma&apos;lumotlarini kiritib, yo&apos;llanma tasdiqlanish holatini tekshiring.
            </p>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className={`text-[9px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>Pasport Seriyasi & Raqami</label>
              <input
                type="text"
                value={passportSeries}
                onChange={(e) => setPassportSeries(e.target.value)}
                placeholder="AA1234567"
                className={`w-full border p-3 rounded-xl text-xs outline-none transition-all font-sans ${isLight ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200' : 'bg-slate-900/30 border-white/15 text-white placeholder:text-slate-450 focus:border-blue-500/50'}`}
                required
              />
            </div>
            <div className="space-y-1">
              <label className={`text-[9px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>JSHSHIR (14 ta raqam)</label>
              <input
                type="text"
                maxLength={14}
                value={jshshir}
                onChange={(e) => setJshshir(e.target.value)}
                placeholder="30102030405060"
                className={`w-full border p-3 rounded-xl text-xs outline-none transition-all font-sans ${isLight ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200' : 'bg-slate-900/30 border-white/15 text-white placeholder:text-slate-450 focus:border-blue-500/50'}`}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-750 text-white font-black uppercase tracking-wider text-xs shadow-xl transition-all active:scale-98 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Tekshirish</span>
                  <Search size={14} />
                </>
              )}
            </button>
          </form>

          {/* Results section */}
          <AnimatePresence mode="wait">
            {searched && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="mt-6 border-t border-slate-700/20 dark:border-white/5 pt-6 space-y-4"
              >
                {result ? (
                  <div className="space-y-4">
                    {/* 1. Pending Status */}
                    {result.status === 'pending' && (
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-3">
                        <HelpCircle className="mx-auto h-10 w-10 text-amber-400 animate-pulse" />
                        <div className="space-y-1">
                          <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">Ko&apos;rib chiqilmoqda</h3>
                          <p className={`text-[11px] leading-relaxed font-sans ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                            Hurmatli {result.full_name}, siz yuborgan yo&apos;llanma arizasi hozirda kutilmoqda. Zamdekan arizani ko&apos;rib chiqib, xona raqamini belgilaganidan so&apos;ng bu yerda ro&apos;yxatdan o&apos;tish tugmasi ochiladi.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 2. Rejected Status */}
                    {result.status === 'rejected' && (
                      <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
                        <XCircle className="mx-auto h-10 w-10 text-rose-455" />
                        <div className="space-y-1">
                          <h3 className="text-xs font-black uppercase tracking-wider text-rose-400">Rad etilgan</h3>
                          <p className={`text-[11px] leading-relaxed font-sans ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                            Arizangiz rad etildi. Sababi: <span className="font-bold text-rose-300">{result.reject_reason || "Hujjat talabga javob bermaydi."}</span>
                          </p>
                        </div>
                        <Link
                          href="/ruxsatnoma-yuborish"
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-500 hover:underline"
                        >
                          <span>Qayta yuborish</span>
                          <ChevronRight size={12} />
                        </Link>
                      </div>
                    )}

                    {/* 3. Approved Status */}
                    {result.status === 'approved' && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
                          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
                          <div className="space-y-1">
                            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 font-sans">Yo&apos;llanma Tasdiqlangan!</h3>
                            <p className={`text-xs leading-relaxed font-sans ${isLight ? 'text-slate-600' : 'text-slate-200'}`}>
                              Tabriklaymiz, yo&apos;llanmangiz tasdiqlandi! Sizga yotoqxonadan <b>{result.room_number}-xona</b> ajratildi.
                            </p>
                          </div>
                        </div>

                        {/* Big CTA button to register */}
                        <button
                          onClick={() => router.push(`/register?k=${result.passport_series}&j=${result.jshshir}`)}
                          className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 text-white font-black uppercase tracking-wider text-xs shadow-xl shadow-emerald-500/10 active:scale-98 transition-all"
                        >
                          <span>Ro&apos;yxatdan O&apos;tish</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}

                    {/* 4. Registered Status */}
                    {result.status === 'registered' && (
                      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center space-y-4">
                        <CheckCircle2 className="mx-auto h-10 w-10 text-blue-400" />
                        <div className="space-y-1">
                          <h3 className="text-xs font-black uppercase tracking-wider text-blue-450">Akkaunt Yaratilgan</h3>
                          <p className={`text-[11px] leading-relaxed font-sans ${isLight ? 'text-slate-605' : 'text-slate-300'}`}>
                            Siz ushbu yo&apos;llanma ma&apos;lumotlari bilan allaqachon ro&apos;yxatdan o&apos;tib bo&apos;lgansiz. Tizimdan foydalanish uchun login sahifasiga o&apos;ting.
                          </p>
                        </div>
                        <button
                          onClick={() => router.push('/login?student=1')}
                          className="w-full flex items-center justify-center gap-1.5 p-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition-all"
                        >
                          <LogIn size={14} />
                          Tizimga Kirish
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-950/40 border border-white/5 text-center space-y-2">
                    <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">Ariza topilmadi</h3>
                    <p className={`text-[10px] leading-relaxed font-sans ${isLight ? 'text-slate-500' : 'text-slate-450'}`}>
                      Kiritilgan pasport seriyasi ({passportSeries.toUpperCase()}) va JShSHIR bo&apos;yicha hech qanday ariza topilmadi. Ma&apos;lumotlar to&apos;g&apos;ri ekanini qayta tekshiring yoki yangi ariza yuboring.
                    </p>
                    <div className="pt-2">
                      <Link href="/ruxsatnoma-yuborish" className="text-xs font-bold text-blue-500 hover:underline">
                        Yo&apos;llanma yuklash →
                      </Link>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Navigation */}
          <div className="flex justify-between items-center mt-6 border-t border-slate-700/20 dark:border-white/5 pt-4 text-xs font-bold">
            <Link href="/" className="text-slate-500 hover:text-white flex items-center gap-1">
              <House size={14} />
              <span>Bosh sahifa</span>
            </Link>
            <Link href="/ruxsatnoma-yuborish" className="text-blue-500 hover:underline flex items-center gap-0.5">
              <span>Yo&apos;llanma yuborish</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RuxsatnomaTekshirish() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500" />
      </div>
    }>
      <StatusCheckContent />
    </Suspense>
  )
}
