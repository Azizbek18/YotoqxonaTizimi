'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, User, Mail, Phone, ArrowLeft, CheckCircle2, CreditCard,
  ShieldAlert, ShieldCheck, Pencil, ChevronRight, ChevronLeft, FileText, Globe2
} from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import CustomSelect from '@/components/ui/CustomSelect'
import DeveloperContactLink from '@/components/DeveloperContactLink'
import TelegramPermitConnect from '@/components/TelegramPermitConnect'
import PushNotificationCard from '@/components/pwa/PushNotificationCard'
import ArizaTilxatDocument from '@/components/documents/ArizaTilxatDocument'
import SignaturePad from '@/components/applications/SignaturePad'
import { useThemeStore } from '@/lib/stores/theme-store'
import { PERMIT_FACULTIES, permitFacultyLabel } from '@/lib/faculties'
import { directionsForFaculty } from '@/lib/directions'
import { prepareUploadFile } from '@/lib/prepare-upload'
import {
  buildFullName,
  getForeignIdFormatError,
  getNamePartError,
  isPlausibleInternationalPhone,
  isValidEmail,
  isValidForeignIdNumber,
  normalizeForeignIdNumber,
} from '@/lib/permit-validation'
import { cyrillicToLatin } from '@/lib/transliterate'

const STUDY_TYPES = [
  { value: 'grant', label: "Davlat granti" },
  { value: 'kontrakt', label: "To'lov-shartnoma" },
]

export default function ImtiyozliAriza() {
  const router = useRouter()
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const [showWarning, setShowWarning] = useState(true)
  const [formStep, setFormStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [telegramLink, setTelegramLink] = useState<string | null>(null)
  const [telegramLinked, setTelegramLinked] = useState(false)
  const [permitRequestId, setPermitRequestId] = useState<string | null>(null)

  // Step 1
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  // Some countries have no patronymic — a foreign applicant can opt out.
  const [noMiddleName, setNoMiddleName] = useState(false)
  const fullName = buildFullName({ lastName, firstName, middleName: noMiddleName ? '' : middleName })
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [relativePhone, setRelativePhone] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | ''>('')

  // Step 2
  const [faculty, setFaculty] = useState<string>(PERMIT_FACULTIES[0].value)
  const [direction, setDirection] = useState('')
  const [course, setCourse] = useState('1')
  const [studyType, setStudyType] = useState('')

  // Step 3
  const [originCountry, setOriginCountry] = useState('')
  const [originRegion, setOriginRegion] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [passportPhoto, setPassportPhoto] = useState<File | null>(null)
  const [preparingPhoto, setPreparingPhoto] = useState(false)
  // Set when the applicant arrived via "Ma'lumotni tahrirlash" on a still-
  // pending application — the same row is updated in place (queue position
  // kept) and the passport photo is optional.
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    try {
      const editRaw = sessionStorage.getItem('permit_edit')
      const raw = editRaw ?? sessionStorage.getItem('permit_resubmit')
      if (!raw) return
      const saved = JSON.parse(raw) as {
        passport?: unknown; email?: unknown; applicationType?: unknown
        fullName?: unknown; phone?: unknown; gender?: unknown; faculty?: unknown; direction?: unknown; course?: unknown
        relativePhone?: unknown; studyType?: unknown; originCountry?: unknown; originRegion?: unknown
      }
      if (saved.applicationType !== 'imtiyozli') return
      setIdNumber(normalizeForeignIdNumber(saved.passport))
      setEmail(String(saved.email ?? '').trim().toLowerCase().slice(0, 254))
      // Pulled back to edit — prefill the rest so only the passport photo
      // needs re-uploading.
      const parts = String(saved.fullName ?? '').trim().split(/\s+/).filter(Boolean)
      if (parts[0]) setLastName(cyrillicToLatin(parts[0]))
      if (parts[1]) setFirstName(cyrillicToLatin(parts[1]))
      if (parts.length > 2) setMiddleName(cyrillicToLatin(parts.slice(2).join(' ')))
      else if (parts.length === 2) setNoMiddleName(true)
      const phone = String(saved.phone ?? '').replace(/\D/g, '').slice(-9)
      if (phone) setPhone(phone)
      if (saved.gender === 'male' || saved.gender === 'female') setGender(saved.gender)
      const fac = String(saved.faculty ?? '')
      if (PERMIT_FACULTIES.some((f) => f.value === fac)) setFaculty(fac)
      if (saved.direction) setDirection(String(saved.direction))
      const course = String(saved.course ?? '')
      if (/^[1-6]$/.test(course)) setCourse(course)
      if (saved.relativePhone) setRelativePhone(String(saved.relativePhone).replace(/[^\d+\s()-]/g, '').slice(0, 24))
      if (saved.studyType === 'grant' || saved.studyType === 'kontrakt') setStudyType(saved.studyType)
      if (saved.originCountry) setOriginCountry(String(saved.originCountry).slice(0, 120))
      if (saved.originRegion) setOriginRegion(String(saved.originRegion).slice(0, 120))
      if (editRaw) setEditMode(true)
      // Keep permit_edit until a successful save (mid-edit reload resumes);
      // the one-shot resubmit prefill is consumed immediately.
      else sessionStorage.removeItem('permit_resubmit')
    } catch {
      sessionStorage.removeItem('permit_resubmit')
    }
  }, [])

  // Dekan-configured dormitory number/name (Sozlamalar) — fetched publicly
  // since the applicant isn't logged in yet. Empty until the dekan sets
  // it; the document then shows a literal blank rather than a guess.
  const [ttjName, setTtjName] = useState('')
  useEffect(() => {
    let active = true
    // The dorm building number is per-faculty — ask for the one the
    // applicant picked, so the Ariza/Tilxat preview matches what that
    // faculty's dekan will see.
    fetch(`/api/public/ttj-name?faculty=${encodeURIComponent(faculty)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (active && data?.ttjName) setTtjName(data.ttjName) })
      .catch(() => {})
    return () => { active = false }
  }, [faculty])

  const acknowledgeWarning = () => setShowWarning(false)

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    e.target.value = '' // let the same file be re-picked after an error
    if (!selected) return

    setPreparingPhoto(true)
    try {
      // Converts iPhone HEIC → JPEG and shrinks oversized camera shots so
      // the server's format/size check doesn't reject an honest photo.
      const prepared = await prepareUploadFile(selected, { allowPdf: true, maxDimension: 2200 })
      if (!prepared.ok) {
        toast.error(prepared.message)
        return
      }
      setPassportPhoto(prepared.file)
      if (prepared.changed) toast.success('Rasm yuklashga tayyorlandi')
    } finally {
      setPreparingPhoto(false)
    }
  }

  const validateStep1 = () => {
    const nameError = getNamePartError(lastName, 'Familiya')
      || getNamePartError(firstName, 'Ism')
      || (noMiddleName ? null : getNamePartError(middleName, 'Otasining ismi'))
    if (nameError) {
      toast.error(nameError)
      return false
    }
    if (!isValidEmail(email)) {
      toast.error('To‘g‘ri email manzilini kiriting!')
      return false
    }
    if (phone.replace(/\D/g, '').length !== 9) {
      toast.error("+998 dan keyin 9 ta raqam kiriting!")
      return false
    }
    if (!isPlausibleInternationalPhone(relativePhone)) {
      toast.error("Yaqin qarindoshingizning telefon raqamini kiriting!")
      return false
    }
    if (!gender) {
      toast.error('Jinsingizni tanlang!')
      return false
    }
    return true
  }

  const validateStep2 = () => {
    if (!direction) {
      toast.error("Yo'nalishni tanlang!")
      return false
    }
    if (!studyType) {
      toast.error("Ta'lim shaklini tanlang!")
      return false
    }
    return true
  }

  const validateStep3 = () => {
    if (!originCountry.trim() || !originRegion.trim()) {
      toast.error("Qaysi davlat/viloyatdan kelganingizni kiriting!")
      return false
    }
    if (!isValidForeignIdNumber(normalizeForeignIdNumber(idNumber))) {
      toast.error(getForeignIdFormatError(idNumber) ?? "Pasport/ID hujjat raqamini kiriting!")
      return false
    }
    if (preparingPhoto) {
      toast.error('Rasm hali tayyorlanmoqda — biroz kuting.')
      return false
    }
    // In edit mode the photo already on file is kept unless a new one is picked.
    if (!editMode && !passportPhoto) {
      toast.error("Pasportingiz rasmini yuklang!")
      return false
    }
    return true
  }

  const handleNextStep = () => {
    if (formStep === 1 && validateStep1()) setFormStep(2)
    else if (formStep === 2 && validateStep2()) setFormStep(3)
    else if (formStep === 3 && validateStep3()) setFormStep(4)
  }

  const handlePrevStep = () => setFormStep((s) => Math.max(1, s - 1))

  const facultyLabel = permitFacultyLabel(faculty)

  const [signatureImage, setSignatureImage] = useState<string | null>(null)
  const [attested, setAttested] = useState(false)

  const handleSubmit = async () => {
    // In edit mode the passport photo already on file may be kept.
    if (!validateStep1() || !validateStep2() || !validateStep3()) return
    if (!editMode && !passportPhoto) return
    if (!editMode && (!signatureImage || !attested)) {
      toast.error('Ariza va Tilxatni imzolang va tasdiqlang.')
      return
    }

    setLoading(true)
    try {
      const submission = new FormData()
      if (passportPhoto) submission.append('file', passportPhoto)
      if (editMode) submission.append('mode', 'edit')
      submission.append('idNumber', normalizeForeignIdNumber(idNumber))
      submission.append('lastName', lastName.trim())
      submission.append('firstName', firstName.trim())
      submission.append('middleName', noMiddleName ? '' : middleName.trim())
      submission.append('noMiddleName', noMiddleName ? 'true' : 'false')
      submission.append('fullName', fullName)
      submission.append('email', email.trim().toLowerCase())
      submission.append('phone', `+998${phone.replace(/\D/g, '')}`)
      submission.append('relativePhone', relativePhone.trim())
      submission.append('gender', gender)
      submission.append('faculty', faculty)
      submission.append('direction', direction)
      submission.append('course', course)
      submission.append('studyType', studyType)
      submission.append('originCountry', originCountry.trim())
      submission.append('originRegion', originRegion.trim())
      if (signatureImage) submission.append('studentSignature', signatureImage)

      const response = await fetch('/api/imtiyozli-requests', { method: 'POST', body: submission })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Arizani saqlashda xatolik yuz berdi')

      setTelegramLink(result.telegram?.url ?? null)
      setTelegramLinked(result.telegram?.linked === true)
      setPermitRequestId(typeof result.permitRequestId === 'string' ? result.permitRequestId : null)

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('student_permit_passport', normalizeForeignIdNumber(idNumber))
        sessionStorage.setItem('student_permit_email', email.trim().toLowerCase())
        sessionStorage.setItem('student_permit_type', 'imtiyozli')
        sessionStorage.removeItem('student_permit_jshshir')
        sessionStorage.removeItem('permit_edit')
      }

      setSubmitted(true)
      toast.success(result.edited
        ? "Ma'lumotlaringiz yangilandi — ariza o'z o'rnida qoldi."
        : "Arizangiz ko'rib chiqish uchun yuborildi!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik yuz berdi')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // The generated Ariza + Tilxat — shared between the on-screen preview and
  // the print/PDF output, so what the student downloads is exactly what
  // they reviewed on screen. Same component the dekan's read-only viewer
  // uses (app/dekan/hujjat), so both sides see the identical document.
  const renderDocuments = () => (
    <ArizaTilxatDocument
      data={{ fullName, facultyLabel, course, studyType, originCountry, originRegion, phone, relativePhone, ttjName }}
    />
  )

  if (submitted) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden ${isLight ? 'bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900' : 'bg-[#020617] text-white'}`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className={`backdrop-blur-3xl border rounded-3xl max-w-md w-full p-6 sm:p-10 shadow-2xl text-center space-y-6 ${
            isLight ? 'bg-white/85 border-slate-200' : 'bg-[#0b1120]/80 border-white/10'
          }`}
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-emerald-400">Muvaffaqiyatli yuborildi!</h2>
            <p className={`text-xs leading-relaxed font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Arizangiz va tilxatingiz imzoingiz bilan qabul qilindi. Dekan xona biriktirgach, imzolangan Ariza va Tilxat Telegram yoki emailingizga avtomatik yuboriladi — hech narsa chop etish shart emas.
            </p>
          </div>
          <TelegramPermitConnect url={telegramLink} linked={telegramLinked} isLight={isLight} />
          {permitRequestId ? (
            <PushNotificationCard
              isLight={isLight}
              permitBinding={{
                id: permitRequestId,
                passport: normalizeForeignIdNumber(idNumber),
                email: email.trim().toLowerCase(),
              }}
            />
          ) : null}
          <button
            onClick={() => router.push('/')}
            className="w-full p-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95"
          >
            Bosh sahifa
          </button>
        </motion.div>
        <DeveloperContactLink />
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-3 sm:px-6 py-16 relative overflow-x-hidden ${isLight ? 'bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900' : 'bg-[#020617] text-white'}`}>
      {/* Orbs in a fixed clipped layer so a tall form still scrolls on phones. */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none print:hidden">
        <div className="absolute top-[-20%] left-[-15%] w-[55%] h-[55%] bg-blue-500/10 rounded-full blur-[130px]" />
        <div className="absolute bottom-[-20%] right-[-15%] w-[55%] h-[55%] bg-amber-500/10 rounded-full blur-[130px]" />
      </div>

      {/* Data-accuracy warning — same standing rule as the Yo'llanma flow */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md print:hidden"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="warning-border shadow-2xl shadow-rose-950/40 max-w-md w-full"
            >
              <div className={`rounded-[27px] p-6 sm:p-8 text-center space-y-5 backdrop-blur-3xl ${isLight ? 'bg-white' : 'bg-[#0b1120]'}`}>
                <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/30">
                  <ShieldAlert className="text-white" size={30} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-rose-500">Diqqat, muhim ogohlantirish!</h2>
                  <p className={`text-xs sm:text-[13px] leading-relaxed font-sans ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    Hurmatli talaba, kiritilayotgan ma&apos;lumotlar <span className="font-black text-amber-500">100%</span>{' '}
                    to&apos;g&apos;ri ekaniga ishonch hosil qiling.
                  </p>
                </div>
                <div className={`rounded-2xl border p-4 text-left flex gap-3 items-start ${isLight ? 'bg-rose-50 border-rose-200' : 'bg-rose-500/10 border-rose-500/20'}`}>
                  <ShieldCheck className="text-rose-500 shrink-0 mt-0.5" size={18} />
                  <p className={`text-[11px] sm:text-xs leading-relaxed font-sans font-medium ${isLight ? 'text-rose-700' : 'text-rose-300'}`}>
                    Mas&apos;ullar tomonidan tekshirilganda kiritilgan ma&apos;lumotlar hujjatga (pasportga) mos kelmasa, arizangiz <span className="font-black">bekor qilinadi</span>.
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={acknowledgeWarning}
                  className="w-full flex items-center justify-center gap-2 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 hover:brightness-110 text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-rose-500/25"
                >
                  <ShieldCheck size={16} />
                  <span>Tushundim, davom etaman</span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-4 right-4 z-20 print:hidden">
        <ThemeToggle />
      </div>
      <div className="absolute top-4 left-4 z-20 print:hidden">
        <Link href="/ariza-yuborish" className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all border ${isLight ? 'bg-white/80 border-slate-200 text-slate-700 hover:bg-slate-100 shadow-xs' : 'bg-[#0f172a]/80 border-white/5 text-slate-400 hover:bg-white/5'}`}>
          <ArrowLeft size={14} /> <span>Orqaga</span>
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-2xl print:my-0 print:max-w-none">
        <div className={`backdrop-blur-3xl border rounded-3xl p-4 sm:p-8 shadow-2xl print:hidden ${isLight ? 'bg-white/90 border-slate-200' : 'bg-[#0b1120]/80 border-white/10'}`}>
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-600/25 mb-3">
              <Globe2 size={22} />
            </div>
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight">Ariza va Tilxat</h1>
            <p className={`text-[10px] sm:text-xs font-medium mt-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Xorijlik va imtiyozli talabalar uchun — Yo&apos;llanma o&apos;rniga
            </p>
          </div>

          {/* Wizard Tabs */}
          <div className="relative p-1 rounded-xl bg-slate-950/20 dark:bg-slate-950/60 border border-slate-200/10 dark:border-white/5 flex justify-between items-center gap-1 mb-5">
            {[
              { step: 1, label: 'Shaxsiy' },
              { step: 2, label: "O'qish" },
              { step: 3, label: 'Hujjat' },
              { step: 4, label: 'Tasdiq' },
            ].map((s) => {
              const isActive = formStep === s.step
              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => {
                    if (s.step < formStep) setFormStep(s.step)
                    else if (s.step === 2 && formStep === 1 && validateStep1()) setFormStep(2)
                    else if (s.step === 3 && formStep === 2 && validateStep1() && validateStep2()) setFormStep(3)
                    else if (s.step === 4 && formStep === 3 && validateStep1() && validateStep2() && validateStep3()) setFormStep(4)
                  }}
                  className={`flex-1 min-w-0 py-2 px-1 text-center rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wide relative transition-all duration-300 z-10 ${
                    isActive
                      ? 'text-white'
                      : isLight ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="imtiyozliActiveTab"
                      className="absolute inset-0 bg-gradient-to-r from-amber-500/70 to-orange-600/70 rounded-lg -z-10"
                      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    />
                  )}
                  {s.step}. {s.label}
                </button>
              )
            })}
          </div>

          <AnimatePresence mode="wait">
            {formStep === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} className="space-y-3.5">
                {(() => {
                  const nameInputCls = `w-full border p-3 pl-11 rounded-xl text-sm outline-none transition-all ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200' : 'bg-slate-900/30 border-white/15 text-white focus:border-amber-500/50'}`
                  const nameLabelCls = `text-[10px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`
                  return (
                    <div className="space-y-3.5">
                      <div className="space-y-1">
                        <label className={nameLabelCls}>Familiya</label>
                        <div className="relative">
                          <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input type="text" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(cyrillicToLatin(e.target.value))} placeholder="Familiya" className={nameInputCls} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label className={nameLabelCls}>Ism</label>
                          <div className="relative">
                            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input type="text" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(cyrillicToLatin(e.target.value))} placeholder="Ism" className={nameInputCls} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className={nameLabelCls}>Otasining ismi</label>
                          <div className="relative">
                            <User size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 ${noMiddleName ? 'text-slate-600' : 'text-slate-500'}`} />
                            <input type="text" autoComplete="additional-name" disabled={noMiddleName} value={noMiddleName ? '' : middleName} onChange={(e) => setMiddleName(cyrillicToLatin(e.target.value))} placeholder={noMiddleName ? '—' : 'Sharif'} className={`${nameInputCls} disabled:opacity-50`} />
                          </div>
                        </div>
                      </div>
                      <label className={`flex items-center gap-2 ml-2 text-[11px] font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        <input type="checkbox" checked={noMiddleName} onChange={(e) => setNoMiddleName(e.target.checked)} />
                        Hujjatimda otasining ismi yo‘q (xorijiy pasport)
                      </label>
                      <p className={`ml-2 text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        Ismni pasportdagidek yozing. Kirilcha yozsangiz avtomatik lotinga o‘giriladi.
                      </p>
                    </div>
                  )
                })()}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Email</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="talaba@example.com"
                        className={`w-full border p-3 pl-11 rounded-xl text-sm outline-none transition-all ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200' : 'bg-slate-900/30 border-white/15 text-white focus:border-amber-500/50'}`} />
                    </div>
                    {email && !isValidEmail(email) && <p className="ml-2 text-[10px] font-bold text-rose-500">Email formati noto‘g‘ri.</p>}
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Telefon raqamingiz</label>
                    <div className="relative flex items-center">
                      <div className="absolute left-4 flex items-center gap-1.5 pointer-events-none border-r pr-2 border-slate-300 dark:border-white/10">
                        <Phone size={14} className="text-slate-500" />
                        <span className="text-sm font-bold text-slate-400">+998</span>
                      </div>
                      <input type="tel" inputMode="numeric" maxLength={9} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="901234567"
                        className={`w-full border p-3 pl-24 rounded-xl text-sm outline-none transition-all ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200' : 'bg-slate-900/30 border-white/15 text-white focus:border-amber-500/50'}`} />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Yaqin qarindoshingizning telefon raqami</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="tel" maxLength={24} value={relativePhone} onChange={(e) => setRelativePhone(e.target.value.replace(/[^\d+\s()-]/g, '').slice(0, 24))} placeholder="+993 65 123456"
                      className={`w-full border p-3 pl-11 rounded-xl text-sm outline-none transition-all ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200' : 'bg-slate-900/30 border-white/15 text-white focus:border-amber-500/50'}`} />
                  </div>
                  {relativePhone && !isPlausibleInternationalPhone(relativePhone) && <p className="ml-2 text-[10px] font-bold text-rose-500">7–15 ta raqam kiriting.</p>}
                </div>
                <div className="space-y-1">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Jinsi</label>
                  <div className="flex gap-3">
                    {(['male', 'female'] as const).map((g) => (
                      <button key={g} type="button" onClick={() => setGender(g)}
                        className={`flex-1 py-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all ${
                          gender === g
                            ? g === 'male' ? 'bg-blue-500/15 border-blue-500/40 text-blue-500' : 'bg-pink-500/15 border-pink-500/40 text-pink-500'
                            : isLight ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-slate-400'
                        }`}
                      >
                        {g === 'male' ? 'Erkak' : 'Ayol'}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={handleNextStep} className="w-full flex items-center justify-center gap-1.5 p-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-white font-black uppercase tracking-widest text-xs transition-all active:scale-95">
                  <span>Keyingi</span> <ChevronRight size={14} />
                </button>
              </motion.div>
            )}

            {formStep === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Fakultet</label>
                    <CustomSelect
                      value={faculty}
                      onChange={(val) => { setFaculty(val); setDirection((prev) => directionsForFaculty(val).some((o) => o.value === prev) ? prev : '') }}
                      options={[...PERMIT_FACULTIES]}
                      className={`border p-3 rounded-xl text-sm font-bold ${isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900/30 border-white/15 text-white'}`}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Yo&apos;nalish</label>
                    <CustomSelect
                      value={direction}
                      onChange={setDirection}
                      placeholder="Yo'nalishni tanlang"
                      options={directionsForFaculty(faculty).map((o) => ({ value: o.value, label: o.label }))}
                      className={`border p-3 rounded-xl text-sm ${isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900/30 border-white/15 text-white'}`}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Kurs</label>
                  <div className="flex gap-2">
                    {['1', '2', '3', '4'].map((c) => (
                      <button key={c} type="button" onClick={() => setCourse(c)}
                        className={`flex-1 py-3 rounded-xl border text-sm font-black transition-all ${
                          course === c ? 'bg-amber-500 border-amber-500 text-white' : isLight ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-slate-400'
                        }`}
                      >
                        {c}-kurs
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Ta&apos;lim shakli</label>
                  <CustomSelect
                    value={studyType}
                    onChange={setStudyType}
                    placeholder="Tanlang"
                    options={STUDY_TYPES}
                    className={`border p-3 rounded-xl text-sm font-bold ${isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900/30 border-white/15 text-white'}`}
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={handlePrevStep} title="Orqaga" aria-label="Orqaga"
                    className={`shrink-0 w-12 rounded-xl border flex items-center justify-center transition-all active:scale-95 ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 hover:bg-white/5 text-slate-300'}`}>
                    <ChevronLeft size={18} />
                  </button>
                  <button type="button" onClick={handleNextStep} className="flex-1 flex items-center justify-center gap-1.5 p-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-white font-black uppercase tracking-widest text-xs transition-all active:scale-95">
                    <span>Keyingi</span> <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            )}

            {formStep === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Davlat (kelib chiqqan)</label>
                    <input type="text" value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} placeholder="masalan: Tojikiston"
                      className={`w-full border p-3 rounded-xl text-sm outline-none transition-all ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200' : 'bg-slate-900/30 border-white/15 text-white focus:border-amber-500/50'}`} />
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Viloyat</label>
                    <input type="text" value={originRegion} onChange={(e) => setOriginRegion(e.target.value)} placeholder="masalan: Xatlon"
                      className={`w-full border p-3 rounded-xl text-sm outline-none transition-all ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200' : 'bg-slate-900/30 border-white/15 text-white focus:border-amber-500/50'}`} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Pasport / ID hujjat raqami</label>
                  <div className="relative">
                    <CreditCard size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="text" autoCapitalize="characters" maxLength={16} value={idNumber} onChange={(e) => setIdNumber(normalizeForeignIdNumber(e.target.value))} placeholder="Masalan: A1234567"
                      className={`w-full border p-3 pl-11 rounded-xl text-sm outline-none transition-all ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200' : 'bg-slate-900/30 border-white/15 text-white focus:border-amber-500/50'}`} />
                  </div>
                  {getForeignIdFormatError(idNumber) ? (
                    <p className="ml-2 text-[10px] font-bold leading-relaxed text-rose-500" role="alert">{getForeignIdFormatError(idNumber)}</p>
                  ) : (
                    <p className={`ml-2 text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>4–16 ta harf va raqam. Bo‘sh joy yoki chiziq avtomatik olib tashlanadi.</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className={`text-[10px] font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {editMode ? 'Pasport rasmi (ixtiyoriy)' : 'Pasport rasmi'}
                  </label>
                  {editMode && !passportPhoto && (
                    <p className={`ml-2 text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Avvalgi rasm saqlanadi. Almashtirmoqchi bo&apos;lsangiz — yangi rasm tanlang.</p>
                  )}
                  <div className={`relative border border-dashed rounded-xl p-4 text-center transition-all ${passportPhoto ? 'border-emerald-500/40 bg-emerald-500/5' : isLight ? 'border-slate-300 hover:bg-slate-50' : 'border-white/10 hover:bg-white/5'}`}>
                    <input type="file" accept=".pdf,image/*" onChange={handlePhotoChange} disabled={preparingPhoto} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait" />
                    <div className="flex flex-col items-center gap-1">
                      {preparingPhoto ? (
                        <>
                          <div className="h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs font-black">Rasm tayyorlanmoqda…</span>
                          <span className="text-[10px] text-slate-500">iPhone rasmi biroz vaqt olishi mumkin</span>
                        </>
                      ) : (
                        <>
                          <Upload className={`h-6 w-6 ${passportPhoto ? 'text-emerald-500' : 'text-slate-500'}`} />
                          <span className="text-xs font-black">{passportPhoto ? passportPhoto.name : 'Rasmni tanlang'}</span>
                          <span className="text-[10px] text-slate-500">PDF, PNG, JPG (Maks. 4 MB) — iPhone rasmi ham bo‘ladi</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={handlePrevStep} title="Orqaga" aria-label="Orqaga"
                    className={`shrink-0 w-12 rounded-xl border flex items-center justify-center transition-all active:scale-95 ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 hover:bg-white/5 text-slate-300'}`}>
                    <ChevronLeft size={18} />
                  </button>
                  <button type="button" onClick={handleNextStep} className="flex-1 flex items-center justify-center gap-1.5 p-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-white font-black uppercase tracking-widest text-xs transition-all active:scale-95">
                    <span>Imzoga o&apos;tish</span> <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            )}

            {formStep === 4 && (
              <motion.div key="s4" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <div className="text-center space-y-1">
                  <h3 className={`text-sm font-black uppercase tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>Ariza va Tilxatni imzolang</h3>
                  <p className={`text-[10px] sm:text-[11px] font-medium leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Hujjatlar ma&apos;lumotlaringiz bilan avtomatik tayyorlanadi. Bu yerda faqat imzo qo&apos;yasiz. Dekan xona biriktirgach, imzolangan Ariza va Tilxat Telegram yoki emailingizga yuboriladi.
                  </p>
                </div>

                <details className={`rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/[0.03]'}`}>
                  <summary className={`flex cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                    <span className="flex items-center gap-1.5"><FileText size={13} /> Hujjat matnini ko&apos;rish</span>
                    <span className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setFormStep(1) }}
                        className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white"
                      >
                        <Pencil size={10} /> Tahrirlash
                      </button>
                      <ChevronRight size={13} />
                    </span>
                  </summary>
                  <div className="max-h-[46vh] overflow-y-auto border-t border-slate-200/60 dark:border-white/10">
                    {renderDocuments()}
                  </div>
                </details>

                <div className={`rounded-2xl border p-3.5 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/[0.03]'}`}>
                  <p className={`mb-2 text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Imzoingiz</p>
                  <SignaturePad isLight={isLight} height={170} onChange={setSignatureImage} />
                </div>

                <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[11px] font-semibold leading-relaxed ${
                  attested
                    ? (isLight ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200')
                    : (isLight ? 'border-slate-200 text-slate-600' : 'border-white/10 text-slate-300')
                }`}>
                  <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600" />
                  <span>Ariza va Tilxatdagi ma&apos;lumotlar to&apos;g&apos;ri. Elektron imzomni tasdiqlayman.</span>
                </label>

                {!editMode && (!signatureImage || !attested) && (
                  <p className={`text-center text-[11px] font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Yuborish uchun imzo qo&apos;ying va tasdiqlang.
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={handlePrevStep} title="Orqaga" aria-label="Orqaga"
                    className={`shrink-0 w-12 rounded-xl border flex items-center justify-center transition-all active:scale-95 ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 hover:bg-white/5 text-slate-300'}`}>
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading || (!editMode && (!signatureImage || !attested))}
                    className="flex-1 flex items-center justify-center gap-2 p-3.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 hover:brightness-110 text-white font-black uppercase tracking-widest text-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        <span>{editMode ? "O‘zgarishlarni saqlash" : 'Tasdiqlayman, Yuborish'}</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-center pt-4 mt-4 border-t border-slate-700/10 dark:border-white/5">
            <Link href="/ruxsatnoma-tekshirish" className="text-xs font-black uppercase tracking-wider text-blue-500 hover:underline flex items-center justify-center gap-1.5">
              <FileText size={12} />
              <span>Ariza holatini tekshirish</span>
            </Link>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .warning-border {
          background: linear-gradient(120deg, #f43f5e, #f59e0b, #f43f5e, #fb7185);
          background-size: 300% 300%;
          animation: warningSweep 4s ease infinite;
          padding: 1.5px;
          border-radius: 28px;
        }
        @keyframes warningSweep {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}} />
      <DeveloperContactLink />
    </div>
  )
}
