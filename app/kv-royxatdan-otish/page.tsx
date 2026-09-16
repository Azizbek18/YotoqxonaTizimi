'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { Home, ArrowLeft, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { getPasswordPolicyError } from '@/lib/password-policy'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { useThemeStore } from '@/lib/stores/theme-store'
import StepProgress from '@/components/register/StepProgress'
import Step1Name from '@/components/kv-register/Step1Name'
import Step2Contact from '@/components/kv-register/Step2Contact'
import Step3Gender from '@/components/kv-register/Step3Gender'
import Step4Study from '@/components/kv-register/Step4Study'
import Step5Password from '@/components/kv-register/Step5Password'
import { initialKvData, KvRegisterData } from '@/components/kv-register/types'

const TOTAL_STEPS = 5

// KV-talaba (off-campus student) self-registration — deliberately its own
// standalone page, not a step in the /register wizard: that wizard's whole
// step machine assumes an approved permit_requests row exists somewhere,
// which a KV-talaba never has. No document upload here, no dekan approval
// gate either — the account lands active immediately (see
// api/kv-talaba/register's comment) and this page auto-signs the student in
// and drops them straight on their dashboard, same as app/register does.
// Split into one-field-per-step (components/kv-register/*) mirroring
// components/register's wizard shape, rather than one long form — a
// committed applicant mid-flow, same class of page as /register, so
// framer-motion here is fine (see mobile-perf-pass memory: it's kept out of
// the pre-registration entry pages only).
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
      <main className={`min-h-screen px-4 py-8 flex items-center justify-center relative ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100 text-slate-900' : 'bg-[#020617] text-white'}`}>
        <div className="absolute top-4 right-4 z-20">
          <ThemeToggle />
        </div>
        <div className={`mx-auto w-full max-w-md rounded-3xl border p-8 text-center shadow-2xl ${isLight ? 'bg-white/90 border-slate-200' : 'border-white/10 bg-[#0b1120]/85'}`}>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="text-lg font-black">Akkauntingiz yaratildi</h1>
          <p className={`mt-2 text-sm leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Endi shu email va parolingiz bilan tizimga kirishingiz mumkin.
          </p>
          <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-500 hover:underline">
            <ArrowLeft size={14} /> Kirish sahifasiga o&apos;tish
          </Link>
        </div>
      </main>
    )
  }

  const stepProps = { stepNumber: stepIndex + 1, totalSteps: TOTAL_STEPS }

  return (
    <main className={`min-h-screen px-4 py-6 flex items-center justify-center relative ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100 text-slate-900' : 'bg-[#020617] text-white'}`}>
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div className={`mx-auto w-full max-w-md rounded-3xl border p-5 shadow-2xl ${isLight ? 'bg-white/90 border-slate-200' : 'border-white/10 bg-[#0b1120]/85'}`}>
        <div className="mb-2 flex items-center gap-2.5">
          <Link href="/ariza-yuborish" className={`inline-flex items-center gap-1.5 text-xs font-bold ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}>
            <ArrowLeft size={14} /> Orqaga
          </Link>
          <span className={isLight ? 'text-slate-300' : 'text-slate-700'}>•</span>
          <div className={`flex items-center gap-1.5 text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            <Home size={13} className="text-emerald-500" /> KV-talaba ro&apos;yxatdan o&apos;tishi
          </div>
        </div>

        {stepIndex === 0 && (
          <p className={`mb-3 text-[11px] leading-snug ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Ijarada/kvartirada turadigan talabalar uchun — hujjat kerak emas.
          </p>
        )}

        <StepProgress current={stepIndex + 1} total={TOTAL_STEPS} />

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

        <p className={`mt-3 text-center text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Akkauntingiz bormi?{' '}
          <Link href="/login" className="text-emerald-500 hover:underline">
            Kirish sahifasi
          </Link>
        </p>
      </div>
    </main>
  )
}
