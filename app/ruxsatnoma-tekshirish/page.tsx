'use client'

import React, { useCallback, useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search, CheckCircle2, XCircle, CreditCard, Mail,
  HelpCircle, AlertTriangle, ChevronRight, ChevronLeft, House, LogIn
} from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import DeveloperContactLink from '@/components/DeveloperContactLink'
import TelegramPermitConnect from '@/components/TelegramPermitConnect'
import { useThemeStore } from '@/lib/stores/theme-store'
import {
  getForeignIdFormatError,
  getPassportFormatError,
  isValidEmail,
  isValidForeignIdNumber,
  isValidJshshir,
  isValidPassport,
  normalizeForeignIdNumber,
  normalizeJshshir,
  normalizePassport,
} from '@/lib/permit-validation'
import { Skel, SkelForm } from '@/components/ui/skeletons'

type ApplicationType = 'yollanma' | 'imtiyozli'

interface PermitRequest {
  id: string
  passport_series: string
  jshshir: string | null
  full_name: string
  email: string
  permit_url: string
  status: 'pending' | 'approved' | 'rejected' | 'registered'
  room_number: string | null
  reject_reason: string | null
  application_type: ApplicationType
  /** Carried through for the "tahrirlash" prefill — the status endpoint
   *  already returns these so /register can prefill the signup wizard. */
  phone?: string | null
  gender?: 'male' | 'female' | null
  faculty?: string | null
  direction?: string | null
  course?: number | null
  relative_phone?: string | null
  study_type?: string | null
  origin_country?: string | null
  origin_region?: string | null
  /** Only set while status is 'pending' — how many arizalar in the same
   *  faculty were submitted before this one, and the total waiting. */
  queuePosition?: number
  queueTotal?: number
  telegram?: { linked: boolean; url: string | null }
}

function StatusCheckContent() {
  const router = useRouter()
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  // Input states
  const [passportSeries, setPassportSeries] = useState('')
  const [jshshir, setJshshir] = useState('')
  const [email, setEmail] = useState('')
  const [applicationType, setApplicationType] = useState<ApplicationType>('yollanma')
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [result, setResult] = useState<PermitRequest | null>(null)

  // Pull-back / edit of a still-pending application.
  const [confirmMode, setConfirmMode] = useState<null | 'edit' | 'cancel'>(null)
  const [cancelBusy, setCancelBusy] = useState<null | 'edit' | 'cancel'>(null)
  const [cancelledOk, setCancelledOk] = useState(false)

  const showToast = (message: string) => {
    toast.error(message)
  }

  const runCancel = async (then: 'edit' | 'cancel') => {
    if (!result) return
    setCancelBusy(then)
    try {
      const res = await fetch('/api/permit-requests/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passportSeries, jshshir, email, applicationType: result.application_type }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Bekor qilishda xatolik yuz berdi')

      if (then === 'edit') {
        try {
          // The submit form reads this and prefills every field, so the
          // student only re-uploads the document and fixes the typo.
          sessionStorage.setItem('permit_resubmit', JSON.stringify({
            passport: passportSeries,
            jshshir,
            email,
            applicationType: result.application_type,
            fullName: result.full_name,
            phone: result.phone ?? '',
            gender: result.gender ?? '',
            faculty: result.faculty ?? '',
            direction: result.direction ?? '',
            course: result.course != null ? String(result.course) : '',
            relativePhone: result.relative_phone ?? '',
            studyType: result.study_type ?? '',
            originCountry: result.origin_country ?? '',
            originRegion: result.origin_region ?? '',
          }))
        } catch { /* private mode — the student just retypes */ }
        router.push(result.application_type === 'imtiyozli' ? '/imtiyozli-ariza' : '/ruxsatnoma-yuborish')
        return
      }
      setCancelledOk(true)
      setResult(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bekor qilishda xatolik yuz berdi')
    } finally {
      setCancelBusy(null)
      setConfirmMode(null)
    }
  }

  const handleSearch = useCallback(async (passport: string, pin: string, applicantEmail: string, type: ApplicationType) => {
    setLoading(true)
    setSearched(true)
    setResult(null)
    setCancelledOk(false)
    setConfirmMode(null)

    try {
      const cleanPassport = type === 'imtiyozli' ? normalizeForeignIdNumber(passport) : normalizePassport(passport)
      const cleanJshshir = type === 'imtiyozli' ? '' : normalizeJshshir(pin)
      const cleanEmail = applicantEmail.trim().toLowerCase()

      const response = await fetch('/api/permit-requests/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passportSeries: cleanPassport, jshshir: cleanJshshir, email: cleanEmail, applicationType: type }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Qidirishda xatolik yuz berdi')
      const data = payload.data ? { ...payload.data, passport_series: cleanPassport, jshshir: cleanJshshir } : null

      if (data) {
        setResult(data as PermitRequest)
        if (typeof window !== 'undefined') {
          // sessionStorage, not localStorage — see app/page.tsx for why.
          sessionStorage.setItem('student_permit_passport', cleanPassport)
          sessionStorage.setItem('student_permit_email', cleanEmail)
          sessionStorage.setItem('student_permit_type', type)
          if (type === 'imtiyozli') sessionStorage.removeItem('student_permit_jshshir')
          else sessionStorage.setItem('student_permit_jshshir', cleanJshshir)
        }
      } else {
        setResult(null)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Qidirishda xatolik yuz berdi')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Restore only from this tab's session storage. National ID fields never
  // appear in URLs, referrers, browser history or server access logs.
  useEffect(() => {
    const restoreId = window.setTimeout(() => {
      const passportValue = sessionStorage.getItem('student_permit_passport') ?? ''
      const jshshirValue = sessionStorage.getItem('student_permit_jshshir') ?? ''
      const emailValue = sessionStorage.getItem('student_permit_email') ?? ''
      const typeValue: ApplicationType = sessionStorage.getItem('student_permit_type') === 'imtiyozli' ? 'imtiyozli' : 'yollanma'
      if (passportValue && emailValue && (typeValue === 'imtiyozli' || jshshirValue)) {
        setPassportSeries(passportValue)
        setJshshir(jshshirValue)
        setEmail(emailValue)
        setApplicationType(typeValue)
        handleSearch(passportValue, jshshirValue, emailValue, typeValue)
      }
    }, 0)
    return () => window.clearTimeout(restoreId)
  }, [handleSearch])

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!passportSeries || !email || (applicationType === 'yollanma' && !jshshir)) {
      showToast(applicationType === 'imtiyozli' ? "Pasport/ID va emailni kiriting!" : "Pasport, JShSHIR va email ma'lumotlarini kiriting!")
      return
    }
    const passportError = applicationType === 'imtiyozli'
      ? getForeignIdFormatError(passportSeries)
      : getPassportFormatError(passportSeries)
    if (passportError) {
      showToast(passportError)
      return
    }
    if (!isValidEmail(email)) {
      showToast("Email formati noto'g'ri.")
      return
    }
    handleSearch(passportSeries, jshshir, email, applicationType)
  }

  // Back to the form without re-fetching — lets someone fix a typo (wrong
  // passport digit, etc.) without losing what they already typed.
  const handleBackToForm = () => {
    setSearched(false)
    setResult(null)
    setCancelledOk(false)
    setConfirmMode(null)
  }

  // Form and result are two distinct steps, never shown together: the
  // result only replaces the form once a check has actually finished.
  const showResult = searched && !loading

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
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 shadow-xl mb-3.5 p-px">
              <div className={`w-full h-full rounded-full flex items-center justify-center ${isLight ? 'bg-white text-blue-600' : 'bg-[#020617] text-blue-500'}`}>
                <Search className="h-6 w-6" />
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight">Ariza holatini tekshirish</h1>
            <p className={`text-[10px] sm:text-xs font-medium mt-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {showResult
                ? "Arizangizning joriy holati"
                : applicationType === 'imtiyozli'
                  ? "Xorijiy/imtiyozli arizadagi pasport yoki ID va email orqali holatni tekshiring."
                  : "Pasport, JShSHIR va arizada koʻrsatilgan email orqali yoʻllanma holatini tekshiring."}
            </p>
          </div>

          {/* Form and result are two separate steps — never both on screen
              at once. The form (or its loading state) shows until a check
              actually finishes; only then does the result replace it. */}
          <>
            {!showResult ? (
              <form key="form" onSubmit={handleFormSubmit} className="anim-in space-y-4">
            <div className={`grid grid-cols-2 gap-1 rounded-xl border p-1 ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/50 border-white/10'}`}>
              {(['yollanma', 'imtiyozli'] as const).map((type) => (
                <button key={type} type="button" onClick={() => { setApplicationType(type); setSearched(false); setResult(null) }}
                  className={`rounded-lg px-2 py-2 text-[10px] font-black uppercase transition ${applicationType === type ? 'bg-blue-600 text-white shadow' : isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {type === 'yollanma' ? "Yo'llanma" : 'Xorijiy / imtiyozli'}
                </button>
              ))}
            </div>
            {/* Fokusda `.cyber-border` gradient-sweep animatsiyasi — ariza
                yuborish sahifasidagi inputlar bilan bir xil his-tuyg'u. */}
            <div className="space-y-1">
              <div className="flex justify-between items-center ml-2">
                <label className={`text-[9px] font-black uppercase tracking-widest block ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>Pasport Seriyasi & Raqami</label>
                {(applicationType === 'imtiyozli' ? isValidForeignIdNumber(normalizeForeignIdNumber(passportSeries)) : isValidPassport(normalizePassport(passportSeries))) && (
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                )}
              </div>
              <div className={`cyber-border ${focusedField === 'passport' ? 'focused' : ''}`}>
                <div className="cyber-input-inner relative">
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${focusedField === 'passport' ? 'text-blue-400 scale-110 drop-shadow-[0_0_8px_#3b82f6]' : 'text-slate-500'}`}>
                    <CreditCard size={16} />
                  </div>
                  {focusedField === 'passport' && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-blue-500/10 blur-[6px] pointer-events-none" />
                  )}
                  <input
                    type="text"
                    name="passport"
                    autoComplete="off"
                    maxLength={applicationType === 'imtiyozli' ? 16 : 9}
                    value={passportSeries}
                    onFocus={() => setFocusedField('passport')}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => setPassportSeries(applicationType === 'imtiyozli' ? normalizeForeignIdNumber(e.target.value) : normalizePassport(e.target.value))}
                    placeholder={applicationType === 'imtiyozli' ? 'Masalan: A1234567' : 'AA1234567'}
                    className={`w-full bg-transparent py-2.5 sm:py-3 pr-4 pl-12 rounded-xl text-base outline-none transition-colors duration-300 font-sans ${isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-500'}`}
                    required
                  />
                </div>
              </div>
              {(applicationType === 'imtiyozli' ? getForeignIdFormatError(passportSeries) : getPassportFormatError(passportSeries)) ? (
                <p className="px-2 text-[10px] font-semibold leading-relaxed text-rose-500" role="alert">
                  {applicationType === 'imtiyozli' ? getForeignIdFormatError(passportSeries) : getPassportFormatError(passportSeries)}
                </p>
              ) : (
                <p className={`px-2 text-[9px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  {applicationType === 'imtiyozli' ? "4–16 ta harf va raqam; kamida bitta raqam" : "O'zbekiston: AA1234567"}
                </p>
              )}
            </div>
            {applicationType === 'yollanma' && <div className="space-y-1">
              <div className="flex justify-between items-center ml-2">
                <label className={`text-[9px] font-black uppercase tracking-widest block ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>JSHSHIR (14 ta raqam)</label>
                {isValidJshshir(normalizeJshshir(jshshir)) && (
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                )}
              </div>
              <div className={`cyber-border ${focusedField === 'jshshir' ? 'focused' : ''}`}>
                <div className="cyber-input-inner relative">
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${focusedField === 'jshshir' ? 'text-blue-400 scale-110 drop-shadow-[0_0_8px_#3b82f6]' : 'text-slate-500'}`}>
                    <CreditCard size={16} />
                  </div>
                  {focusedField === 'jshshir' && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-blue-500/10 blur-[6px] pointer-events-none" />
                  )}
                  <input
                    type="text"
                    name="jshshir"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={14}
                    value={jshshir}
                    onFocus={() => setFocusedField('jshshir')}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => setJshshir(e.target.value)}
                    placeholder="30102030405060"
                    className={`w-full bg-transparent py-2.5 sm:py-3 pr-4 pl-12 rounded-xl text-base outline-none transition-colors duration-300 font-sans ${isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-500'}`}
                    required
                  />
                </div>
              </div>
            </div>}
            <div className="space-y-1">
              <div className="flex justify-between items-center ml-2">
                <label className={`text-[9px] font-black uppercase tracking-widest block ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>Arizadagi email</label>
                {isValidEmail(email) && (
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                )}
              </div>
              <div className={`cyber-border ${focusedField === 'email' ? 'focused' : ''}`}>
                <div className="cyber-input-inner relative">
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${focusedField === 'email' ? 'text-blue-400 scale-110 drop-shadow-[0_0_8px_#3b82f6]' : 'text-slate-500'}`}>
                    <Mail size={16} />
                  </div>
                  {focusedField === 'email' && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-blue-500/10 blur-[6px] pointer-events-none" />
                  )}
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    maxLength={254}
                    value={email}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="talaba@example.com"
                    className={`w-full bg-transparent py-2.5 sm:py-3 pr-4 pl-12 rounded-xl text-base outline-none transition-colors duration-300 font-sans ${isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-500'}`}
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black uppercase tracking-wider text-xs transition-all active:scale-98 disabled:opacity-50"
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
            ) : (
              <div key="result" className="anim-in space-y-4">
                <button
                  type="button"
                  onClick={handleBackToForm}
                  className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-colors ${isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-white'}`}
                >
                  <ChevronLeft size={14} />
                  <span>Qayta tekshirish</span>
                </button>

                {result ? (
                  <div className="space-y-4">
                    <TelegramPermitConnect
                      url={result.telegram?.url ?? null}
                      linked={result.telegram?.linked === true}
                      isLight={isLight}
                    />
                    {/* 1. Pending Status */}
                    {result.status === 'pending' && (
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-3">
                        <HelpCircle className="mx-auto h-10 w-10 text-amber-400 animate-pulse" />
                        <div className="space-y-1">
                          <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">Ko&apos;rib chiqilmoqda</h3>
                          <p className={`text-[11px] leading-relaxed font-sans ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                            Hurmatli {result.full_name}, siz yuborgan {result.application_type === 'imtiyozli' ? 'xorijiy/imtiyozli' : "yo'llanma"} arizasi hozirda kutilmoqda. Dekan arizani ko&apos;rib chiqqanidan so&apos;ng bu yerda ro&apos;yxatdan o&apos;tish tugmasi ochiladi.
                          </p>
                        </div>
                        {typeof result.queuePosition === 'number' && typeof result.queueTotal === 'number' && (
                          <div className={`mx-auto flex max-w-[220px] items-center justify-between gap-3 rounded-xl border px-4 py-2.5 ${
                            isLight ? 'bg-white border-amber-200' : 'bg-slate-950/40 border-amber-500/20'
                          }`}>
                            <span className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              Navbatdagi o&apos;rningiz
                            </span>
                            <span className="text-sm font-black text-amber-400">
                              {result.queuePosition} / {result.queueTotal}
                            </span>
                          </div>
                        )}

                        {/* Dekan hali ko'rmagan — talaba xatoni tuzatishi
                            yoki arizani butunlay bekor qilishi mumkin. */}
                        {confirmMode ? (
                          <div className={`rounded-xl border p-3 text-left space-y-2.5 ${isLight ? 'bg-white border-amber-200' : 'bg-slate-950/40 border-amber-500/20'}`}>
                            <p className={`text-[11px] leading-relaxed font-sans ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                              {confirmMode === 'edit'
                                ? "Tahrirlash uchun ariza bekor qilinadi, so‘ng forma to‘ldirilgan holda ochiladi — hujjatni qayta yuklab, xatoni tuzatasiz."
                                : "Arizani butunlay bekor qilasizmi? Keyin xohlagan vaqtingizda qaytadan yuborishingiz mumkin."}
                            </p>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setConfirmMode(null)} disabled={cancelBusy !== null}
                                className={`flex-1 rounded-lg py-2 text-[10px] font-black uppercase tracking-wider transition ${isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'} disabled:opacity-50`}>
                                Yo&apos;q
                              </button>
                              <button type="button" onClick={() => runCancel(confirmMode)} disabled={cancelBusy !== null}
                                className="flex-1 rounded-lg py-2 text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white hover:bg-rose-700 transition disabled:opacity-50">
                                {cancelBusy ? '...' : 'Ha, davom etish'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button type="button" onClick={() => setConfirmMode('edit')}
                              className={`flex-1 rounded-lg py-2.5 text-[10px] font-black uppercase tracking-wider border transition ${isLight ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : 'border-amber-500/30 text-amber-300 hover:bg-amber-500/10'}`}>
                              Ma&apos;lumotni tahrirlash
                            </button>
                            <button type="button" onClick={() => setConfirmMode('cancel')}
                              className={`flex-1 rounded-lg py-2.5 text-[10px] font-black uppercase tracking-wider border transition ${isLight ? 'border-rose-300 text-rose-600 hover:bg-rose-50' : 'border-rose-500/30 text-rose-300 hover:bg-rose-500/10'}`}>
                              Arizani bekor qilish
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. Rejected Status */}
                    {result.status === 'rejected' && (
                      <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
                        <XCircle className="mx-auto h-10 w-10 text-rose-400" />
                        <div className="space-y-1">
                          <h3 className="text-xs font-black uppercase tracking-wider text-rose-400">Rad etilgan</h3>
                          <p className={`text-[11px] leading-relaxed font-sans ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                            Arizangiz rad etildi. Sababi: <span className="font-bold text-rose-300">{result.reject_reason || "Hujjat talabga javob bermaydi."}</span>
                          </p>
                        </div>
                        <Link
                          href={result.application_type === 'imtiyozli' ? '/imtiyozli-ariza' : '/ruxsatnoma-yuborish'}
                          onClick={() => {
                            // Carry the identity so the submit form is prefilled and
                            // the server reopens THIS rejected row instead of 409-ing.
                            try {
                              sessionStorage.setItem(
                                'permit_resubmit',
                                JSON.stringify({ passport: passportSeries, jshshir, email, applicationType: result.application_type }),
                              )
                            } catch { /* private mode — user just retypes */ }
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-500 hover:underline"
                        >
                          <span>Tuzatib qayta yuborish</span>
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
                            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 font-sans">Ariza Tasdiqlangan!</h3>
                            <p className={`text-xs leading-relaxed font-sans ${isLight ? 'text-slate-600' : 'text-slate-200'}`}>
                              Tabriklaymiz, arizangiz tasdiqlandi! Endi <b>ro&apos;yxatdan o&apos;tishingiz</b> mumkin.
                              Xona ro&apos;yxatdan o&apos;tganingizdan so&apos;ng biriktiriladi va bu haqda sizga
                              email orqali xabar yuboriladi.
                            </p>
                          </div>
                        </div>

                        {/* Big CTA button to register */}
                        <button
                          onClick={() => router.push('/register')}
                          className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 text-white font-black uppercase tracking-wider text-xs active:scale-98 transition-all"
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
                          <h3 className="text-xs font-black uppercase tracking-wider text-blue-400">Akkaunt Yaratilgan</h3>
                          <p className={`text-[11px] leading-relaxed font-sans ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
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
                ) : cancelledOk ? (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                    <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">Ariza bekor qilindi</h3>
                    <p className={`text-[10px] leading-relaxed font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Arizangiz o&apos;chirildi. Xohlagan vaqtingizda qaytadan yuborishingiz mumkin.
                    </p>
                    <div className="pt-2">
                      <Link href={applicationType === 'imtiyozli' ? '/imtiyozli-ariza' : '/ruxsatnoma-yuborish'} className="text-xs font-bold text-blue-500 hover:underline">
                        {applicationType === 'imtiyozli' ? 'Qaytadan xorijiy ariza yuborish →' : "Qaytadan yo'llanma yuborish →"}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-950/40 border border-white/5 text-center space-y-2">
                    <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">Ariza topilmadi</h3>
                    <p className={`text-[10px] leading-relaxed font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Kiritilgan pasport/ID ({passportSeries.toUpperCase()}){applicationType === 'yollanma' ? " va JShSHIR" : ''} bo&apos;yicha hech qanday ariza topilmadi. Ma&apos;lumotlar to&apos;g&apos;ri ekanini qayta tekshiring yoki yangi ariza yuboring.
                    </p>
                    <div className="pt-2">
                      <Link href={applicationType === 'imtiyozli' ? '/imtiyozli-ariza' : '/ruxsatnoma-yuborish'} className="text-xs font-bold text-blue-500 hover:underline">
                        {applicationType === 'imtiyozli' ? 'Xorijiy ariza yuborish →' : "Yo'llanma yuklash →"}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>

          {/* Footer Navigation */}
          <div className="flex justify-between items-center mt-6 border-t border-slate-700/20 dark:border-white/5 pt-4 text-xs font-bold">
            <Link href="/" className="text-slate-500 hover:text-white flex items-center gap-1">
              <House size={14} />
              <span>Bosh sahifa</span>
            </Link>
            <Link href={applicationType === 'imtiyozli' ? '/imtiyozli-ariza' : '/ruxsatnoma-yuborish'} className="text-blue-500 hover:underline flex items-center gap-0.5">
              <span>{applicationType === 'imtiyozli' ? 'Xorijiy ariza' : "Yo'llanma yuborish"}</span>
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
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200/70 bg-white/55 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <Skel className="h-6 w-40" />
          <Skel className="h-3 w-56 max-w-full" />
          <SkelForm fields={3} />
        </div>
      </div>
    }>
      <StatusCheckContent />
      <DeveloperContactLink />
    </Suspense>
  )
}
