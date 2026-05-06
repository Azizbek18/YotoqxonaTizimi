'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { useThemeStore } from '@/lib/stores/theme-store'

import StepProgress from '@/components/register/StepProgress'
import Step1Passport from '@/components/register/Step1Passport'
import Step2Name from '@/components/register/Step2Name'
import Step3Gender from '@/components/register/Step3Gender'
import Step4Study from '@/components/register/Step4Study'
import Step5Address from '@/components/register/Step5Address'
import Step6Family from '@/components/register/Step6Family'
import Step7Date from '@/components/register/Step7Date'
import Step8Room from '@/components/register/Step8Room'      // Yangi qo'shildi
import Step9Password from '@/components/register/Step9Password' // Oxiriga surildi
import { initialData, RegisterData } from '@/components/register/types'

const TOTAL = 9 // Jami qadamlar 9 taga yetdi

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<RegisterData>(initialData)
  const [loading, setLoading] = useState(false)

  function update(partial: Partial<RegisterData>) {
    setData(prev => ({ ...prev, ...partial }))
  }
  function next() { setStep(s => Math.min(s + 1, TOTAL)) }
  function back() { setStep(s => Math.max(s - 1, 1)) }

  const show3DToast = (type: 'success' | 'error', message: string) => {
    toast.custom((t) => (
      <AnimatePresence>
        {t.visible && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-[#0b1120]/95 backdrop-blur-xl border border-white/10 shadow-2xl max-w-70 w-full"
          >
            <div className={`flex items-center justify-center p-2 rounded-lg ${type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            </div>
            <div className="flex-1">
              <p className={`text-[9px] font-black uppercase tracking-wider ${type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {type === 'success' ? 'Muvaffaqiyat' : 'Xatolik'}
              </p>
              <p className="text-[11px] font-medium text-slate-200 mt-0.5">{message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    ), { duration: 4000 });
  };

  async function handleSubmit() {
    // Parollarni tekshirish
    if (data.password !== data.confirmPassword) {
      return show3DToast('error', "Parollar mos kelmadi!")
    }

    setLoading(true)
    try {
      const userEmail = data.email.trim().toLowerCase()

      // 1. Supabase Auth-da foydalanuvchi yaratish
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userEmail,
        password: data.password
      })

      if (authError || !authData.user) throw new Error(authError?.message ?? "Ro'yxatdan o'tishda xatolik")

      // 2. 'users' jadvaliga siz aytgan 21 ta ustun bo'yicha ma'lumot yozish
      const { error: dbError } = await supabase.from('users').insert({
        id: authData.user.id,
        email: userEmail,

        // 1. Ism familya va sharifni bitta ustunga birlashtirish
        full_name: `${data.lastName} ${data.firstName} ${data.middleName}`.trim(),
        middle_name: data.middleName,
        // 2-3-4. Manzil ma'lumotlari
        region: data.region,
        district: data.district,
        mahalla: data.mahalla,

        // 5-6-7-8. Shaxsiy hujjat va tug'ilgan sana
        passport_series: data.passportSeries.toUpperCase().replace(/\s/g, ''),
        jshshir: data.jshshir,
        passport_date: data.passportDate,
        birth_date: data.entryDate, // Agar interface'da alohida birthDate bo'lsa o'shani qo'ying

        // 9-10-11. O'qish ma'lumotlari
        faculty: data.faculty,
        direction: data.direction,
        course: Number(data.course),

        // 12-13-14-15. Qo'shimcha ma'lumotlar
        nationality: data.nationality,
        study_type: data.study_type, // Grand yoki Kontrakt
        gender: data.gender,
        phoneNumber: data.phone,

        // 16-17-18. Ota ma'lumotlari
        father_full_name: data.father_full_name,
        father_workplace: data.father_workplace,
        father_phone: data.father_phone,

        // 19-20-21. Ona ma'lumotlari
        mother_full_name: data.mother_full_name,
        mother_workplace: data.mother_workplace,
        mother_phone: data.mother_phone,

        // Yotoqxona uchun maxsus (Qo'shimcha)
        room_number: data.room_number,
        entry_date: data.entryDate,
        role: 'talaba',
        status: 'pending'
      })

      if (dbError) throw new Error(dbError.message)

      show3DToast('success', "Muvaffaqiyatli ro'yxatdan o'tdingiz!")

      // 2 soniyadan keyin login sahifasiga yuborish
      setTimeout(() => router.push('/login?registered=1'), 2000)

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Noma\'lum xatolik'
      show3DToast('error', errorMessage)
      console.error("Xatolik tafsiloti:", err)
    } finally {
      setLoading(false)
    }
  }
  const stepProps = { data, onChange: update, onNext: next, onBack: back }
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  return (
    <main className={`min-h-screen flex items-center justify-center p-2 sm:p-6 font-sans overflow-hidden relative ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100' : 'bg-[#020617]'}`}>
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className={`absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden ${isLight ? 'opacity-40' : ''}`}>
        <div className={`absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[80px] ${isLight ? 'bg-blue-200' : 'bg-blue-500/10'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[80px] ${isLight ? 'bg-indigo-200' : 'bg-indigo-500/10'}`} />
      </div>

      <div className="relative z-10 w-full max-w-[320px] sm:max-w-md my-2">
        <div className={`flex flex-col max-h-[94vh] rounded-3xl sm:rounded-4xl border backdrop-blur-3xl shadow-2xl overflow-hidden ${isLight ? 'bg-white/90 border-slate-200' : 'bg-[#111827]/80 border-white/10'}`}>

          <div className={`p-4 sm:pt-8 sm:pb-4 pb-2 shrink-0 border-b ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/5'}`}>
            <div className={`flex gap-1 rounded-xl p-1 mb-4 border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/5'}`}>
              <Link href="/login" className={`flex-1 py-1.5 sm:py-3 text-center text-[10px] sm:text-sm font-bold rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400'}`}>Kirish</Link>
              <div className={`flex-1 py-1.5 sm:py-3 text-center text-[10px] sm:text-sm font-bold rounded-lg text-white bg-blue-600 shadow-lg ${isLight ? 'shadow-blue-400/30' : 'shadow-blue-600/20'}`}>Ro&apos;yxatdan o&apos;tish</div>
            </div>

            <div className="w-full overflow-x-auto no-scrollbar py-2">
              <div className="min-w-max px-2">
                <StepProgress current={step} total={TOTAL} />
              </div>
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-8 py-2 ${isLight ? '' : ''}`}>
            <div className="min-h-70 flex flex-col justify-start py-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  {step === 1 && <Step1Passport {...stepProps} />}
                  {step === 2 && <Step2Name {...stepProps} />}
                  {step === 3 && <Step3Gender {...stepProps} />}
                  {step === 4 && <Step4Study {...stepProps} />}
                  {step === 5 && <Step5Address {...stepProps} />}
                  {step === 6 && <Step6Family {...stepProps} />}
                  {step === 7 && <Step7Date {...stepProps} />}
                  {step === 8 && <Step8Room {...stepProps} />}
                  {step === 9 && (
                    <Step9Password
                      data={data}
                      onChange={update}
                      onBack={back}
                      onSubmit={handleSubmit}
                      loading={loading}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="p-4 sm:p-8 pt-2 shrink-0">
            <p className="text-center text-[14px] sm:text-[12px] text-slate-500 border-t border-white/5 pt-3">
              Akkauntingiz bormi?{' '}
              <Link href="/login?student=1" className="text-blue-500 font-bold hover:underline">Kirish</Link>
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.3); border-radius: 10px; }
      `}</style>
    </main>
  )
}
