'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { GraduationCap, ArrowLeft, CheckCircle2, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { getPasswordPolicyError } from '@/lib/password-policy'
import ThemeToggle from '@/components/theme/ThemeToggle'
import DeveloperContactLink from '@/components/DeveloperContactLink'
import EmailProofDialog from '@/components/auth/EmailProofDialog'
import { fetchWithEmailProof } from '@/features/email-verification/client'
import { useThemeStore } from '@/lib/stores/theme-store'
import { KvStepper } from '@/components/kv-register/ui'
import Step1Name from '@/components/kv-register/Step1Name'
import Step2Contact from '@/components/kv-register/Step2Contact'
import Step3Gender from '@/components/kv-register/Step3Gender'
import Step4Study from '@/components/kv-register/Step4Study'
import Step5Password from '@/components/kv-register/Step5Password'
import { initialKvData, KvRegisterData } from '@/components/kv-register/types'

const TOTAL_STEPS = 5
const STEP_NAMES = ['F.I.Sh', 'Aloqa', 'Jinsi', "O'qish", 'Parol']

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
      // The account is active immediately, so the email must be the student's
      // own — a code goes to it before the account is created.
      const email = data.email.trim().toLowerCase()
      const response = await fetchWithEmailProof(email, (emailProof) => fetch('/api/kv-talaba/register', {
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
          emailProof,
        }),
      }))
      if (!response) return
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
            Endi email va parolingiz bilan kabinetingizga kirishingiz mumkin.
          </p>
          <Link prefetch={false} href="/login" className="mt-6 inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold uppercase tracking-wider shadow-md shadow-blue-500/20 transition-all">
            <ArrowLeft size={16} /> Tizimga kirish
          </Link>
        </div>
        <DeveloperContactLink />
      </main>
    )
  }

  return (
    <main className={`relative min-h-screen overflow-x-hidden px-4 pb-24 pt-4 sm:py-10 ${isLight ? 'bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900' : 'bg-[#020617] text-white'}`}>
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={`absolute left-[-10%] top-[-15%] h-[50%] w-[50%] rounded-full blur-[130px] ${isLight ? 'bg-blue-200/50' : 'bg-blue-600/10'}`} />
        <div className={`absolute bottom-[-15%] right-[-10%] h-[50%] w-[50%] rounded-full blur-[130px] ${isLight ? 'bg-indigo-200/50' : 'bg-indigo-600/10'}`} />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-md">
        {/* Top row: back link + theme toggle (in flow, so they never overlap the title) */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link
            prefetch={false}
            href="/ariza-yuborish"
            className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-colors ${
              isLight ? 'text-slate-600 hover:text-blue-600' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowLeft size={16} /> Orqaga
          </Link>
          <ThemeToggle />
        </div>

        <div className="mb-5 text-center">
          <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg ${isLight ? 'shadow-blue-500/30' : 'shadow-blue-900/50'}`}>
            <GraduationCap size={26} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-balance">Kvartira-talaba ro‘yxati</h1>
          <p className={`mt-1 text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Ijarada yashovchi talabalar uchun · hujjatsiz
          </p>
        </div>

        <div className={`w-full rounded-3xl border p-5 shadow-2xl backdrop-blur-2xl sm:p-7 ${isLight ? 'border-slate-200 bg-white/95 shadow-slate-300/50' : 'border-white/10 bg-[#0b1120]/90 shadow-black/60'}`}>
          <KvStepper current={stepIndex + 1} names={STEP_NAMES} isLight={isLight} />

          {stepIndex === 0 && (
            <div className={`mb-5 flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed ${
              isLight ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
            }`}>
              <Info size={16} className="mt-0.5 shrink-0 text-amber-500" />
              <p>
                <span className="font-bold">Yotoqxonaga ariza berganmisiz? Bu forma siz uchun emas.</span>{' '}
                Tasdiqlangach{' '}
                <Link prefetch={false} href="/register" className="font-bold underline underline-offset-2">Ro‘yxatdan o‘tish</Link>
                {' '}sahifasidan o‘ting.
              </p>
            </div>
          )}

          <AnimatePresence mode="wait">
            {stepIndex === 0 && <Step1Name key="step1" data={data} onChange={update} onNext={next} />}
            {stepIndex === 1 && <Step2Contact key="step2" data={data} onChange={update} onNext={next} onBack={back} />}
            {stepIndex === 2 && <Step3Gender key="step3" data={data} onChange={update} onNext={next} onBack={back} />}
            {stepIndex === 3 && <Step4Study key="step4" data={data} onChange={update} onNext={next} onBack={back} />}
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
              />
            )}
          </AnimatePresence>
        </div>

        <p className={`mt-5 text-center text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
          Akkauntingiz bormi?{' '}
          <Link prefetch={false} href="/login" className="font-bold text-blue-600 hover:underline">
            Tizimga kirish
          </Link>
        </p>
      </div>
      <DeveloperContactLink />
      <EmailProofDialog />
    </main>
  )
}
