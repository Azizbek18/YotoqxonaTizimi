'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { GraduationCap, Home, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { getPasswordPolicyError } from '@/lib/password-policy'
import ThemeToggle from '@/components/theme/ThemeToggle'
import DeveloperContactLink from '@/components/DeveloperContactLink'
import { useThemeStore } from '@/lib/stores/theme-store'
import StepProgress from '@/components/register/StepProgress'
import Step1Name from '@/components/kv-register/Step1Name'
import Step2Contact from '@/components/kv-register/Step2Contact'
import Step3Gender from '@/components/kv-register/Step3Gender'
import Step4Study from '@/components/kv-register/Step4Study'
import Step5Password from '@/components/kv-register/Step5Password'
import { initialKvData, KvRegisterData } from '@/components/kv-register/types'

const TOTAL_STEPS = 5
const STEP_NAMES = ['F.I.Sh', 'Aloqa', 'Jinsi', "O'qish", 'Xavfsizlik']

// KV-talaba (off-campus student) self-registration — deliberately its own
// standalone page, not a step in the /register wizard: that wizard's whole
// step machine assumes an approved permit_requests row exists somewhere,
// which a KV-talaba never has. No document upload here, no dekan approval
// gate either — the account lands active immediately (see
// api/kv-talaba/register's comment) and this page auto-signs the student in
// and drops them straight on their dashboard, same as app/register does.
export default function KvRoyxatdanOtish() {
  const router = useRouter()
  const isLight = useThemeStore((s) => s.theme) === 'light'
  const [stepIndex, setStepIndex] = useState(0)
  const [data, setData] = useState<KvRegisterData>(initialKvData)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const update = (patch: Partial<KvRegisterData>) => setData((current) => ({ ...current, ...patch }))
  const next = () => setStepIndex((i) => Math.min(i + 1, TOTAL_STEPS - 1))
  const back = () => setStepIndex((i) => Math.max(i - 1, 0))

  const handleSubmit = async () => {
    if (password !== confirmPassword) {
      toast.error('Parollar bir xil emas')
      return
    }
    const passwordError = getPasswordPolicyError(password)
    if (passwordError) {
      toast.error(passwordError)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/kv-talaba/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastName: data.lastName,
          firstName: data.firstName,
          middleName: data.middleName,
          noMiddleName: data.noMiddleName,
          email: data.email,
          phone: data.phone,
          gender: data.gender,
          faculty: data.faculty,
          direction: data.direction,
          course: Number(data.course),
          group: data.group,
          hemisStudentId: data.hemisStudentId,
          password,
          confirmPassword,
        }),
      })
      const result: { ok: boolean; error?: string } = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Ro'yxatdan o'tishda xatolik")

      // No dekan approval gate — the account is active immediately, so sign
      // the student straight in and drop them on their dashboard, same as
      // app/register does. A sign-in hiccup still counts as success: the
      // account exists, they just log in by hand instead.
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email.trim().toLowerCase(),
        password,
      })
      if (signInError || !authData.session) {
        setSubmitted(true)
        return
      }
      router.push('/talaba/dashboard')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Noma'lum xatolik")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <main className={`min-h-screen px-4 py-8 flex items-center justify-center relative overflow-hidden ${isLight ? 'bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900' : 'bg-[#020617] text-white'}`}>
        <div className="absolute top-4 right-4 z-20">
          <ThemeToggle />
        </div>
        <div className={`mx-auto w-full max-w-md rounded-3xl border p-8 text-center shadow-2xl backdrop-blur-xl ${isLight ? 'bg-white/95 border-slate-200' : 'border-white/10 bg-[#0b1120]/90'}`}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="text-xl font-black tracking-tight">Akkauntingiz muvaffaqiyatli yaratildi!</h1>
          <p className={`mt-2 text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Kvartirada yashovchi talaba sifatida tizimga kiritildingiz. Endi email va parolingiz orqali shaxsiy kabinetingizga kirishingiz mumkin.
          </p>
          <Link href="/login" className="mt-6 inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold uppercase tracking-wider shadow-md shadow-blue-500/20 transition-all">
            <ArrowLeft size={16} /> Tizimga kirish
          </Link>
        </div>
        <DeveloperContactLink />
      </main>
    )
  }

  const stepProps = { stepNumber: stepIndex + 1, totalSteps: TOTAL_STEPS }

  return (
    <main className={`min-h-screen px-4 py-8 sm:py-12 flex flex-col items-center justify-center relative overflow-x-hidden ${isLight ? 'bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900' : 'bg-[#020617] text-white'}`}>
      {/* Decorative ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[130px] ${isLight ? 'bg-blue-200/50' : 'bg-blue-600/10'}`} />
        <div className={`absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[130px] ${isLight ? 'bg-indigo-200/50' : 'bg-indigo-600/10'}`} />
      </div>

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-xl mx-auto">
        {/* Academic Header & System Badge */}
        <div className="text-center mb-5 sm:mb-6">
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide uppercase mb-3 border shadow-xs backdrop-blur-md transition-all ${
              isLight
                ? 'bg-blue-50/90 border-blue-200 text-blue-700'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}
          >
            <GraduationCap size={15} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
            <span>OTM Talabalar Axborot Tizimi</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            Kvartira-talaba hisobidan ro‘yxatdan o‘tish
          </h1>
          <p className={`text-xs mt-1.5 max-w-md mx-auto leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Universitet talabalar turar joyi va tashqi ijara monitoringi platformasi
          </p>
        </div>

        {/* Wizard Card */}
        <div className={`w-full rounded-3xl border p-5 sm:p-7 shadow-2xl backdrop-blur-2xl transition-all ${isLight ? 'bg-white/95 border-slate-200 shadow-slate-200/70' : 'border-white/10 bg-[#0b1120]/90 shadow-black/60'}`}>
          {/* Top Bar inside Card */}
          <div className="mb-4 flex items-center justify-between gap-2 pb-3 border-b border-slate-200/60 dark:border-white/5">
            <Link
              href="/ariza-yuborish"
              className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors ${
                isLight ? 'text-slate-600 hover:text-blue-600' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ArrowLeft size={14} /> Toifani o‘zgartirish
            </Link>

            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
              isLight
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            }`}>
              <Home size={12} className="text-emerald-500" />
              <span>Hujjatsiz tezkor ro‘yxat</span>
            </span>
          </div>

          {/* Educational Notice on First Step */}
          {stepIndex === 0 && (
            <div className={`mb-4 flex items-start gap-2.5 p-3 rounded-2xl border text-xs transition-all ${
              isLight ? 'bg-blue-50/80 border-blue-200/80 text-blue-950' : 'bg-blue-950/25 border-blue-500/20 text-blue-200'
            }`}>
              <ShieldCheck size={16} className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <div className="leading-relaxed">
                <p className="font-bold text-[11px] uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Ijarada / kvartirada yashovchi talabalar uchun
                </p>
                <p className="text-[11px] mt-0.5 opacity-90">
                  Ushbu forma orqali yotoqxonada emas, ijarada turuvchi talabalar OTM monitoring tizimiga tezkor kiritiladi.
                </p>
              </div>
            </div>
          )}

          {/* Stepper with Step Names */}
          <StepProgress current={stepIndex + 1} total={TOTAL_STEPS} stepNames={STEP_NAMES} />

          <div className="pt-2">
            <AnimatePresence mode="wait">
              {stepIndex === 0 && (
                <Step1Name key="step1" data={data} onChange={update} onNext={next} {...stepProps} />
              )}
              {stepIndex === 1 && (
                <Step2Contact key="step2" data={data} onChange={update} onNext={next} onBack={back} {...stepProps} />
              )}
              {stepIndex === 2 && (
                <Step3Gender key="step3" data={data} onChange={update} onNext={next} onBack={back} {...stepProps} />
              )}
              {stepIndex === 3 && (
                <Step4Study key="step4" data={data} onChange={update} onNext={next} onBack={back} {...stepProps} />
              )}
              {stepIndex === 4 && (
                <Step5Password
                  key="step5"
                  data={data}
                  password={password}
                  confirmPassword={confirmPassword}
                  onPasswordChange={setPassword}
                  onConfirmPasswordChange={setConfirmPassword}
                  onSubmit={handleSubmit}
                  onBack={back}
                  loading={loading}
                  {...stepProps}
                />
              )}
            </AnimatePresence>
          </div>

          <p className={`mt-5 pt-4 border-t border-slate-200/60 dark:border-white/5 text-center text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Akkauntingiz bormi?{' '}
            <Link href="/login" className="text-blue-600 font-bold hover:underline ml-1">
              Tizimga kirish
            </Link>
          </p>
        </div>
      </div>
      <DeveloperContactLink />
    </main>
  )
}
