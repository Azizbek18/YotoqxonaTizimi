'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertTriangle, FileSignature } from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import DeveloperContactLink from '@/components/DeveloperContactLink'
import { useThemeStore } from '@/lib/stores/theme-store'
import { appFont as baloo2 } from '@/lib/app-font'

import StepProgress from '@/components/register/StepProgress'
import Step1Passport from '@/components/register/Step1Passport'
import Step2Name from '@/components/register/Step2Name'
import Step3Gender from '@/components/register/Step3Gender'
import Step4Study from '@/components/register/Step4Study'
import Step5Address from '@/components/register/Step5Address'
import Step6Family from '@/components/register/Step6Family'
import Step7Date from '@/components/register/Step7Date'
import Step8Room from '@/components/register/Step8Room'      // Yangi qo'shildi
import Step9Password from '@/components/register/Step9Password'
import { initialData, RegisterData } from '@/components/register/types'

const TOTAL = 9 // Jami qadamlar 9 taga yetdi

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<RegisterData>(initialData)
  const [loading, setLoading] = useState(false)
  const [applicationType, setApplicationType] = useState<'yollanma' | 'imtiyozli'>('yollanma')

  // The approved applicant's Ariza + Tilxat, rebuilt from the permit row so
  // they can reprint the signed paper here if they lost the copy they
  // downloaded when submitting. Null until the approved permit loads (and
  // stays null for old permits that predate the Ariza/Tilxat step).
  // Just a flag now: the signed Ariza + Tilxat is no longer downloaded here —
  // it is generated server-side and delivered (Telegram/email) once the dekan
  // assigns a room. We only show an informational note for new-style permits.
  const [hasArizaTilxat, setHasArizaTilxat] = useState(false)

  useEffect(() => {
    const restoreId = window.setTimeout(() => {
      const passportSeries = sessionStorage.getItem('student_permit_passport') ?? ''
      const jshshir = sessionStorage.getItem('student_permit_jshshir') ?? ''
      const email = sessionStorage.getItem('student_permit_email') ?? ''
      const restoredType = sessionStorage.getItem('student_permit_type') === 'imtiyozli' ? 'imtiyozli' : 'yollanma'
      setApplicationType(restoredType)
      if (passportSeries || jshshir || email) {
        setData((current) => ({ ...current, passportSeries, jshshir, email }))
      }

      // Everything below was already typed once, in the yo'llanma form —
      // pull the approved permit back via the same lookup the status-check
      // page uses, and prefill the rest of the wizard from it so the
      // student never retypes F.I.Sh, phone, fakultet, yo'nalish or kurs.
      // Also matters functionally: /api/student/register rejects a
      // faculty/name mismatch against the permit, so prefilling avoids a
      // silent rejection from a student picking something different here.
      // An imtiyozli (foreign) applicant has no JShSHIR, so when one isn't
      // in this tab's storage — a closed tab loses it — look them up as
      // imtiyozli rather than falling back to a yo'llanma the wizard would
      // then wrongly demand a JShSHIR and patronymic for.
      const lookupType: 'yollanma' | 'imtiyozli' =
        restoredType === 'imtiyozli' || !jshshir ? 'imtiyozli' : 'yollanma'
      if (passportSeries && email) {
        fetch('/api/permit-requests/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passportSeries, jshshir, email, applicationType: lookupType }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((payload) => {
            const permit = payload?.data
            if (!permit || permit.status !== 'approved') return

            // The permit row is the source of truth for the application
            // type — trust it over the (losable) sessionStorage hint.
            if (permit.application_type === 'imtiyozli' || permit.application_type === 'yollanma') {
              setApplicationType(permit.application_type)
            }

            const nameParts = String(permit.full_name ?? '').trim().split(/\s+/).filter(Boolean)
            const [lastName = '', firstName = '', ...rest] = nameParts
            const middleName = rest.join(' ')
            const phone = String(permit.phone ?? '').replace(/\D/g, '').slice(-9)

            setData((current) => ({
              ...current,
              lastName: lastName || current.lastName,
              firstName: firstName || current.firstName,
              middleName: current.noMiddleName ? '' : (middleName || current.middleName),
              noMiddleName: current.noMiddleName
                || (permit.application_type === 'imtiyozli' && !middleName),
              phone: phone || current.phone,
              gender: (permit.gender === 'male' || permit.gender === 'female') ? permit.gender : current.gender,
              faculty: permit.faculty || current.faculty,
              direction: permit.direction || current.direction,
              course: permit.course ? String(permit.course) : current.course,
              room_number: permit.room_number || current.room_number,
            }))

            // Both flows generate an Ariza + Tilxat; new-style permits (with
            // study/origin data) get the "it will be delivered automatically"
            // note. Old permits predate the Ariza/Tilxat step — nothing to say.
            if (permit.study_type || permit.origin_region) {
              setHasArizaTilxat(true)
            }
          })
          .catch(() => {
            // Prefill is a convenience, not a requirement — the student can
            // still fill every step by hand if this lookup fails.
          })
      }
    }, 0)
    return () => window.clearTimeout(restoreId)
  }, [])

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
    setLoading(true)
    try {
      const userEmail = data.email.trim().toLowerCase()
      const passportSeriesClean = data.passportSeries.toUpperCase().replace(/\s/g, '')
      const jshshirClean = data.jshshir.trim()

      const response = await fetch('/api/student/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, email: userEmail, passportSeries: passportSeriesClean, jshshir: jshshirClean, applicationType }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Ro'yxatdan o'tishda xatolik")

      // Xat serverdan yuboriladi, brauzerdan emas: brauzerdagi PKCE oqimi
      // code verifier'ni shu brauzerda qoldiradi va xat boshqa qurilmada
      // ochilsa havola ishlamaydi. Batafsil: app/api/auth/recovery/route.ts
      const emailResponse = await fetch('/api/auth/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      })
      if (!emailResponse.ok) {
        throw new Error("Akkaunt tayyorlandi, ammo tasdiqlash emailini yuborib bo'lmadi. Birozdan keyin qayta urinib ko'ring.")
      }

      show3DToast('success', "Tasdiqlash havolasi emailingizga yuborildi!")

      setTimeout(() => router.push('/login?verification=sent'), 2500)

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
    <main className={`baloo-scope min-h-screen flex items-center justify-center p-2 sm:p-6 overflow-hidden relative ${isLight ? 'bg-linear-to-br from-slate-50 to-slate-100' : 'bg-[#020617]'}`} style={{ fontFamily: baloo2.style.fontFamily }}>
      {/* Every step component (Step1Passport..Step9Password) uses a
          `font-sans` wrapper and plain <h2> headings, both of which resolve
          through the global --app-font-sans / --app-font-display custom
          properties. Overriding those two variables here — instead of
          editing all 9 step files — cascades Baloo 2 through the whole
          registration flow for free, since CSS custom properties inherit. */}
      <style dangerouslySetInnerHTML={{ __html: `
        .baloo-scope {
          --app-font-sans: ${baloo2.style.fontFamily};
          --app-font-display: ${baloo2.style.fontFamily};
        }
      `}} />
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
            <div className="flex gap-2.5 mb-4">
              <Link href="/login" className={`flex-1 py-1.5 sm:py-3 text-center text-[10px] sm:text-sm font-bold rounded-xl border transition-colors ${isLight ? 'text-slate-500 hover:text-slate-700 bg-white border-slate-200' : 'text-slate-400 bg-white/5 border-white/10'}`}>Kirish</Link>
              <button type="button" className={`flex-1 py-1.5 sm:py-3 text-center text-[10px] sm:text-sm font-bold rounded-xl border text-white bg-blue-600 ${isLight ? 'border-blue-700' : 'border-blue-500'}`}>Ro&apos;yxatdan o&apos;tish</button>
            </div>

            <div className="w-full overflow-x-auto no-scrollbar py-2">
              <div className="min-w-max px-2">
                <StepProgress current={step} total={TOTAL} />
              </div>
            </div>
          </div>

          <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 sm:px-8 py-2 ${isLight ? '' : ''}`}>
            {hasArizaTilxat && (
              <div className={`mt-3 flex items-start gap-3 rounded-2xl border p-3 ${
                isLight ? 'border-emerald-200 bg-emerald-50' : 'border-emerald-500/25 bg-emerald-500/10'
              }`}>
                <div className={`shrink-0 mt-0.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                  <FileSignature size={16} />
                </div>
                <p className={`min-w-0 flex-1 text-[11px] leading-relaxed font-medium ${isLight ? 'text-emerald-800' : 'text-emerald-200'}`}>
                  Imzolangan <span className="font-bold">Ariza va Tilxat</span> siz uchun avtomatik tayyorlangan.
                  Dekan xona biriktirgach, u Telegram yoki emailingizga yuboriladi — hech narsa chop etish shart emas.
                </p>
              </div>
            )}
            <div className="min-h-70 flex flex-col justify-start py-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  {step === 1 && <Step1Passport {...stepProps} requiresJshshir={applicationType === 'yollanma'} />}
                  {step === 2 && <Step2Name {...stepProps} requiresMiddleName={applicationType === 'yollanma'} />}
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
      <DeveloperContactLink />
    </main>
  )
}
