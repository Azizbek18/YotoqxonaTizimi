'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, User, Mail, Phone, Volume2, VolumeX,
  ChevronRight, ChevronLeft, ArrowLeft, CheckCircle2, CreditCard, GraduationCap,
  ShieldAlert, ShieldCheck, Pencil, RotateCw, BookOpen, FileText
} from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import CustomSelect from '@/components/ui/CustomSelect'
import DeveloperContactLink from '@/components/DeveloperContactLink'
import TelegramPermitConnect from '@/components/TelegramPermitConnect'
import { useThemeStore } from '@/lib/stores/theme-store'
import { PERMIT_FACULTIES } from '@/lib/faculties'
import { directionsForFaculty } from '@/lib/directions'
import { getPassportFormatError, isValidJoinedFullName, isValidJshshir, isValidPassport, normalizeJshshir, normalizePassport } from '@/lib/permit-validation'
import { cyrillicToLatin } from '@/lib/transliterate'
import { prepareUploadFile } from '@/lib/prepare-upload'

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  alpha: number
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

async function postWithOneNetworkRetry(url: string, buildBody: () => FormData): Promise<Response> {
  try {
    return await fetch(url, { method: 'POST', body: buildBody() })
  } catch {
    // A single retry covers brief 4G handovers and Android in-app browser
    // upload interruptions. This endpoint only analyzes a file and does not
    // create a database row, so retrying it cannot duplicate an application.
    await wait(900)
    return fetch(url, { method: 'POST', body: buildBody() })
  }
}

function submissionErrorMessage(error: unknown): string {
  if (error instanceof TypeError && /fetch|network|load/i.test(error.message)) {
    return "Faylni serverga yuborib bo‘lmadi. Internetni tekshiring yoki Telegram ichki brauzeri o‘rniga Chrome’da ochib, qayta urinib ko‘ring."
  }
  return error instanceof Error ? error.message : 'Xatolik yuz berdi'
}

export default function RuxsatnomaYuborish() {
  const router = useRouter()
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  // Wizard Step State
  const [formStep, setFormStep] = useState(1)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  // Form states
  const [fullName, setFullName] = useState('')
  const [passportSeries, setPassportSeries] = useState('')
  const [jshshir, setJshshir] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | ''>('')
  const [faculty, setFaculty] = useState<string>(PERMIT_FACULTIES[0].value)
  const [direction, setDirection] = useState('')
  const [course, setCourse] = useState('1')
  const [file, setFile] = useState<File | null>(null)
  const [preparingFile, setPreparingFile] = useState(false)

  const [loading, setLoading] = useState(false)
  const [submissionStage, setSubmissionStage] = useState<'idle' | 'ai' | 'saving'>('idle')
  const [submitted, setSubmitted] = useState(false)
  const [telegramLink, setTelegramLink] = useState<string | null>(null)
  const [telegramLinked, setTelegramLinked] = useState(false)

  // Shown before the student can touch the form — must be acknowledged
  // every visit, since it's a warning about THIS submission's accuracy,
  // not something that only needs saying once per browser.
  const [showWarning, setShowWarning] = useState(true)

  // Set when the applicant arrived via "Tuzatib qayta yuborish" from the
  // status page after a rejection — the identity fields are prefilled and
  // the server reopens their existing row instead of rejecting a duplicate.
  const [resubmitMode, setResubmitMode] = useState(false)

  // Step 4's review card — front holds identity/course, back holds
  // contact/document — flips in place instead of stacking a second card.
  const [cardFlipped, setCardFlipped] = useState(false)

  // 3D Card Parallax Coordinates
  const [cardRotateX, setCardRotateX] = useState(0)
  const [cardRotateY, setCardRotateY] = useState(0)
  const [cardShineX, setCardShineX] = useState(50)
  const [cardShineY, setCardShineY] = useState(50)

  // Sound and Mute State
  const [isMuted, setIsMuted] = useState(false)

  // Particle System State
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMuted = localStorage.getItem('dorm_sound_muted') === 'true'
      setIsMuted(savedMuted)
    }
  }, [])

  // Prefill when resubmitting: a rejected application (identity only) or a
  // pending one the student pulled back to edit (every field, so they just
  // re-upload the document and fix the typo).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('permit_resubmit')
      if (!raw) return
      sessionStorage.removeItem('permit_resubmit')
      const saved = JSON.parse(raw) as {
        passport?: string; jshshir?: string; email?: string
        fullName?: string; phone?: string; gender?: string; faculty?: string; direction?: string; course?: string
      }
      if (saved.passport) setPassportSeries(saved.passport)
      if (saved.jshshir) setJshshir(saved.jshshir)
      if (saved.email) setEmail(saved.email)
      if (saved.fullName) setFullName(cyrillicToLatin(saved.fullName))
      if (saved.phone) setPhone(String(saved.phone).replace(/\D/g, '').slice(-9))
      if (saved.gender === 'male' || saved.gender === 'female') setGender(saved.gender)
      if (saved.faculty && PERMIT_FACULTIES.some((f) => f.value === saved.faculty)) setFaculty(saved.faculty)
      if (saved.direction) setDirection(saved.direction)
      if (saved.course && /^[1-6]$/.test(saved.course)) setCourse(saved.course)
      setResubmitMode(true)
    } catch { /* ignore malformed / unavailable storage */ }
  }, [])

  // Particle animation loop
  useEffect(() => {
    if (particles.length === 0) return
    let active = true
    const update = () => {
      if (!active) return
      setParticles((prev) => 
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.08, // mild gravity
            alpha: p.alpha - 0.02,
            size: Math.max(0, p.size - 0.05)
          }))
          .filter((p) => p.alpha > 0 && p.size > 0.5)
      )
      requestAnimationFrame(update)
    }
    requestAnimationFrame(update)
    return () => {
      active = false
    }
  }, [particles.length])

  // One shared AudioContext for the whole page. The old code built a
  // fresh `new AudioContext()` on every keystroke — each construction
  // costs tens of ms, and browsers cap concurrent contexts (~6) after
  // which creation stalls, so the sound always lagged behind typing.
  // Reusing a single context makes playback effectively instant.
  const audioCtxRef = useRef<AudioContext | null>(null)

  const getAudioContext = (): AudioContext | null => {
    if (typeof window === 'undefined') return null
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext
      if (!AudioContextClass) return null
      audioCtxRef.current = new AudioContextClass()
    }
    // Autoplay policy parks a new context in "suspended" until a user
    // gesture; resume() is a cheap no-op once it's already running.
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume()
    }
    return audioCtxRef.current
  }

  useEffect(() => {
    return () => {
      void audioCtxRef.current?.close()
      audioCtxRef.current = null
    }
  }, [])

  // Programmatic Sound Synthesis
  const playSound = (type: 'keypress' | 'success' | 'focus' | 'tab' | 'gender') => {
    if (typeof window === 'undefined') return
    const currentMuted = localStorage.getItem('dorm_sound_muted') === 'true'
    if (currentMuted) return

    try {
      const ctx = getAudioContext()
      if (!ctx) return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)

      if (type === 'keypress') {
        osc.type = 'sine'
        osc.frequency.setValueAtTime(450 + Math.random() * 150, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.06)
        gain.gain.setValueAtTime(0.03, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06)
        osc.start()
        osc.stop(ctx.currentTime + 0.06)
      } else if (type === 'focus') {
        osc.type = 'sine'
        osc.frequency.setValueAtTime(220, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.1)
        gain.gain.setValueAtTime(0.02, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
        osc.start()
        osc.stop(ctx.currentTime + 0.1)
      } else if (type === 'tab') {
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(320, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.15)
        gain.gain.setValueAtTime(0.04, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
        osc.start()
        osc.stop(ctx.currentTime + 0.15)
      } else if (type === 'gender') {
        osc.type = 'sine'
        osc.frequency.setValueAtTime(350, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.2)
        gain.gain.setValueAtTime(0.05, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
        osc.start()
        osc.stop(ctx.currentTime + 0.2)
      } else if (type === 'success') {
        // High premium chime
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08) // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16) // G5
        gain.gain.setValueAtTime(0.06, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
        osc.start()
        osc.stop(ctx.currentTime + 0.35)
      }
    } catch (e) {
      console.warn('Audio synthesis warning:', e)
    }
  }

  const toggleMute = () => {
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    if (typeof window !== 'undefined') {
      localStorage.setItem('dorm_sound_muted', String(nextMuted))
    }
  }

  const acknowledgeWarning = () => {
    setShowWarning(false)
    playSound('tab')
  }

  // Trigger keyboard particles relative to the input element
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    setter: (val: string) => void,
    fieldName: string
  ) => {
    const val = e.target.value
    setter(val)
    playSound('keypress')

    const target = e.currentTarget
    const rect = target.getBoundingClientRect()

    const colors: Record<string, string[]> = {
      fullName: ['#818cf8', '#6366f1', '#4f46e5'],
      email: ['#38bdf8', '#0ea5e9', '#0284c7'],
      phone: ['#34d399', '#10b981', '#059669'],
      direction: ['#fbbf24', '#f59e0b', '#d97706'],
      passport: ['#ec4899', '#db2777', '#c11574'],
      jshshir: ['#a855f7', '#8b5cf6', '#7c3aed']
    }

    const fieldColors = colors[fieldName] || ['#6366f1', '#3b82f6', '#10b981']
    const newParticles: Particle[] = []

    for (let i = 0; i < 4; i++) {
      newParticles.push({
        id: Math.random(),
        x: rect.width / 2 + (Math.random() - 0.5) * (rect.width * 0.9),
        y: rect.height - 2, // bottom of the input slot
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2 - 1.5,
        color: fieldColors[Math.floor(Math.random() * fieldColors.length)],
        size: Math.random() * 3 + 2,
        alpha: 1
      })
    }

    setParticles((prev) => [...prev, ...newParticles].slice(-40))
  }

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const midX = rect.width / 2
    const midY = rect.height / 2
    
    // Rotate max 18 degrees
    const rotX = -((y - midY) / midY) * 18
    const rotY = ((x - midX) / midX) * 18
    
    const shinePercX = (x / rect.width) * 100
    const shinePercY = (y / rect.height) * 100

    setCardRotateX(rotX)
    setCardRotateY(rotY)
    setCardShineX(shinePercX)
    setCardShineY(shinePercY)
  }

  const handleCardMouseLeave = () => {
    setCardRotateX(0)
    setCardRotateY(0)
    setCardShineX(50)
    setCardShineY(50)
  }
  const showToast = (type: 'success' | 'error', message: string) => {
    if (type === 'success') {
      toast.success(message)
    } else {
      toast.error(message)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    e.target.value = '' // let the same file be re-picked after an error
    if (!selected) return

    setPreparingFile(true)
    try {
      // iPhone HEIC → JPEG, plus a downscale for oversized camera shots, so
      // an honest yo'llanma photo isn't bounced by the server format/size check.
      const prepared = await prepareUploadFile(selected, { allowPdf: true, maxDimension: 2200 })
      if (!prepared.ok) {
        showToast('error', prepared.message)
        return
      }
      setFile(prepared.file)
      playSound('success')
      if (prepared.changed) showToast('success', 'Rasm yuklashga tayyorlandi')
    } finally {
      setPreparingFile(false)
    }
  }

  const validateStep1 = () => {
    if (!isValidJoinedFullName(fullName, 3)) {
      showToast('error', "F.I.Sh to'liq kiriting: Familiya, Ism va Otasining ismi (kamida 3 so'z).")
      return false
    }
    if (!email.trim() || !email.includes('@')) {
      showToast('error', 'To‘g‘ri email manzilini kiriting!')
      return false
    }
    if (!/^\d{9}$/.test(phone.trim())) {
      showToast('error', "Telefon raqamini to'liq kiriting! (9 ta raqam)")
      return false
    }
    if (!gender) {
      showToast('error', 'Jinsingizni tanlang!')
      return false
    }
    return true
  }

  const validateStep2 = () => {
    if (!direction.trim()) {
      showToast('error', 'Yo‘nalish / Guruh maydonini kiriting!')
      return false
    }
    return true
  }

  const validateStep3 = () => {
    if (preparingFile) {
      showToast('error', 'Rasm hali tayyorlanmoqda — biroz kuting.')
      return false
    }
    if (!passportSeries || !jshshir || !file) {
      showToast('error', "Iltimos, pasport ma'lumotlarini to'ldiring va faylni yuklang!")
      return false
    }
    // Same rules the server checks at submission — catching a malformed
    // passport here (not just JShSHIR) means the student sees a clear
    // error right away, instead of reaching the review card and only
    // finding out when the final submit gets rejected.
    const passportError = getPassportFormatError(passportSeries)
    if (passportError) {
      showToast('error', passportError)
      return false
    }
    if (!isValidJshshir(normalizeJshshir(jshshir))) {
      showToast('error', "JShSHIR 14 ta raqamdan iborat bo'lishi lozim!")
      return false
    }
    return true
  }

  const handleNextStep = () => {
    if (formStep === 1) {
      if (validateStep1()) {
        setFormStep(2)
        playSound('tab')
      }
    } else if (formStep === 2) {
      if (validateStep2()) {
        setFormStep(3)
        playSound('tab')
      }
    } else if (formStep === 3) {
      if (validateStep3()) {
        setCardFlipped(false)
        setFormStep(4)
        playSound('tab')
      }
    }
  }

  const handlePrevStep = () => {
    if (formStep > 1) {
      setFormStep(formStep - 1)
      playSound('tab')
    }
  }

  const selectGender = (type: 'male' | 'female') => {
    setGender(type)
    playSound('gender')

    // Spawn massive particle burst
    const burstColors = type === 'male' ? ['#3b82f6', '#60a5fa', '#93c5fd'] : ['#ec4899', '#f472b6', '#fbcfe8']
    const newParticles: Particle[] = []
    for (let i = 0; i < 20; i++) {
      newParticles.push({
        id: Math.random(),
        x: 100 + Math.random() * 200,
        y: 80,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 5 - 2,
        color: burstColors[Math.floor(Math.random() * burstColors.length)],
        size: Math.random() * 4 + 3,
        alpha: 1
      })
    }
    setParticles((prev) => [...prev, ...newParticles].slice(-50))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formStep !== 4) return
    if (!validateStep3() || !file) return

    setLoading(true)
    setSubmissionStage('ai')

    try {
      const cleanPassport = passportSeries.toUpperCase().replace(/\s/g, '')
      const cleanJshshir = jshshir.trim()
      const cleanEmail = email.trim().toLowerCase()

      // 1. AI orqali yo'llanma hujjatini tekshirish — hujjat rasmiy
      // my.gov.uz namunasiga mosligi va undagi FISH/JSHSHIR/pasport
      // ma'lumotlari formada kiritilgan ma'lumotlar bilan mosligini
      // tasdiqlaydi. Fayl saqlanishidan oldin ishlaydi.
      const buildAiFormData = () => {
        const aiFormData = new FormData()
        aiFormData.append('file', file)
        aiFormData.append('fullName', fullName.trim())
        aiFormData.append('jshshir', cleanJshshir)
        aiFormData.append('passportSeries', cleanPassport)
        return aiFormData
      }

      const aiResponse = await postWithOneNetworkRetry('/api/ai/yollanma-tekshiruv', buildAiFormData)
      const aiResult = await aiResponse.json()

      if (!aiResponse.ok) {
        throw new Error(aiResult.error || "Hujjatni tekshirishda xatolik yuz berdi")
      }
      if (!aiResult.valid) {
        const reason = Array.isArray(aiResult.mismatches) && aiResult.mismatches.length > 0
          ? aiResult.mismatches.join(' ')
          : "Yuklangan hujjat rasmiy Yo'llanma namunasiga mos kelmadi."
        throw new Error(reason)
      }
      if (!aiResult.claim) {
        throw new Error("Yo‘llanma AI tekshiruvidan tasdiq olinmadi. Qayta urinib ko‘ring.")
      }

      // 2. Server tekshiradi, private storage'ga yuklaydi va bazaga yozadi.
      setSubmissionStage('saving')
      const submission = new FormData()
      submission.append('file', file)
      submission.append('passportSeries', cleanPassport)
      submission.append('jshshir', cleanJshshir)
      submission.append('fullName', fullName.trim())
      submission.append('email', cleanEmail)
      submission.append('phone', `+998${phone.trim()}`)
      submission.append('gender', gender)
      submission.append('faculty', faculty)
      submission.append('direction', direction.trim())
      submission.append('course', String(course))
      submission.append('aiClaim', aiResult.claim)

      const submitResponse = await fetch('/api/permit-requests', {
        method: 'POST',
        body: submission,
      })
      const submitResult = await submitResponse.json()
      if (!submitResponse.ok) {
        throw new Error(submitResult.error || 'Arizani saqlashda xatolik yuz berdi')
      }

      setTelegramLink(submitResult.telegram?.url ?? null)
      setTelegramLinked(submitResult.telegram?.linked === true)

      if (typeof window !== 'undefined') {
        // sessionStorage, not localStorage — these are sensitive national ID
        // fields (passport/JShSHIR); persisting them indefinitely would leave
        // them readable by the next person on a shared/public device.
        sessionStorage.setItem('student_permit_passport', cleanPassport)
        sessionStorage.setItem('student_permit_jshshir', cleanJshshir)
        sessionStorage.setItem('student_permit_email', cleanEmail)
      }

      setSubmitted(true)
      playSound('success')
      showToast(
        'success',
        submitResult.resubmitted
          ? "Tuzatilgan yo'llanma qayta ko'rib chiqish uchun yuborildi!"
          : "Yo'llanma ko'rib chiqish uchun yuborildi!",
      )
    } catch (err) {
      showToast('error', submissionErrorMessage(err))
      console.error(err)
    } finally {
      setLoading(false)
      setSubmissionStage('idle')
    }
  }

  // Dynamic Barcode line generator for ID card
  const renderBarcode = () => {
    const characters = jshshir || "30102030405060"
    return (
      <div className="flex gap-[1.5px] items-end h-4 sm:h-5 opacity-40">
        {characters.split('').map((char, index) => {
          const width = (Number(char) % 3) + 1
          return (
            <div 
              key={index} 
              className={`h-full ${isLight ? 'bg-slate-800' : 'bg-slate-200'}`} 
              style={{ width: `${width}px` }} 
            />
          )
        })}
      </div>
    )
  }

  // The 3D student ID preview — lives permanently in the desktop side
  // column, and gets reused (mobile-only) inside Step 4's review, since
  // that's the one place a mobile visitor needs to see it too.
  const renderIdCard = () => (
    <div
      onMouseMove={handleCardMouseMove}
      onMouseLeave={handleCardMouseLeave}
      style={{
        transform: `rotateX(${cardRotateX}deg) rotateY(${cardRotateY}deg)`,
        transformStyle: 'preserve-3d',
      }}
      className="pass-card-3d pass-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between min-h-[140px] sm:min-h-[180px] relative overflow-hidden cursor-pointer transform-gpu transition-all duration-200"
    >
      {/* Holographic light reflect overlay */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at ${cardShineX}% ${cardShineY}%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 65%)`,
        }}
      />

      {/* Neon radial glow according to gender selection */}
      {gender === 'male' && (
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
      )}
      {gender === 'female' && (
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />
      )}

      {/* Scanning laser line on passport focus */}
      {focusedField === 'passport' && (
        <motion.div
          initial={{ y: 0 }}
          animate={{ y: [0, 130, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#22d3ee] z-20 pointer-events-none"
        />
      )}

      {/* Top card section */}
      <div className="flex justify-between items-start" style={{ transform: 'translateZ(30px)' }}>
        <div>
          <span className={`text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded border ${
            gender === 'male'
              ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
              : gender === 'female'
                ? 'text-pink-400 bg-pink-500/10 border-pink-500/20'
                : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
          }`}>
            SMARTDORM • TALABA ID
          </span>
          <h3 className={`text-xs sm:text-base font-black uppercase tracking-wide mt-2 font-sans leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {fullName.trim() || "F.I.Sh (Familiya Ism Sharif)"}
          </h3>
        </div>

        {/* Glowing holographic chip */}
        <div className="relative w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-amber-400/80 to-yellow-600/80 border border-amber-300/30 shadow-[0_0_12px_rgba(245,158,11,0.2)] overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:4px_4px]" />
        </div>
      </div>

      {/* Bottom section */}
      <div className="flex justify-between items-end pt-3 border-t border-slate-700/10 dark:border-white/5 mt-3" style={{ transform: 'translateZ(20px)' }}>

        <div className="space-y-1 sm:space-y-1.5">
          <p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Hujjatlar</p>
          <p className={`text-[9px] sm:text-xs font-mono leading-none font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            {passportSeries.toUpperCase() || "AAXXXXXXX"} • {jshshir || "30102030405060"}
          </p>

          {/* Interactive Barcode */}
          {renderBarcode()}
        </div>

        <div className="text-right flex flex-col items-end gap-1">
          {/* Interactive gender hologram avatar box */}
          <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl bg-slate-950/20 dark:bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 overflow-hidden relative shadow-inner">
            {gender === 'male' ? (
              <motion.div animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="text-blue-400 filter drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                </svg>
              </motion.div>
            ) : gender === 'female' ? (
              <motion.div animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="text-pink-400 filter drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]">
                <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"/>
                  <path d="M18 21a6 6 0 0 0-12 0"/>
                </svg>
              </motion.div>
            ) : (
              <User className="w-4 h-4 sm:w-5 sm:h-5 opacity-30" />
            )}
          </div>
          <span className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">KURS</span>
          <p className="text-[9px] sm:text-xs font-black uppercase text-indigo-400 leading-none">
            {course}-kurs • {faculty.toUpperCase()}
          </p>
        </div>

      </div>
    </div>
  )

  // A single icon+label+value line on the review card's back face — flags
  // an empty value in rose instead of rendering a blank, so a skipped
  // field is obvious before the student ever hits submit.
  const cardFieldRow = (Icon: React.ComponentType<{ size?: number }>, label: string, value: string) => (
    <div className="flex items-center gap-2.5">
      <div className={`shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'}`}>
        <Icon size={12} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-slate-500 leading-none">{label}</p>
        <p className={`text-[10px] sm:text-xs font-bold truncate mt-0.5 ${
          value ? (isLight ? 'text-slate-800' : 'text-slate-200') : 'text-rose-400 italic'
        }`}>
          {value || 'Kiritilmagan'}
        </p>
      </div>
    </div>
  )

  // Animated sound waves
  const renderSoundwave = () => {
    if (isMuted) {
      return (
        <div className="flex items-center gap-[2px] h-4">
          <div className="w-[2px] h-1 bg-slate-400 dark:bg-slate-600 rounded-xs" />
          <div className="w-[2px] h-1 bg-slate-400 dark:bg-slate-600 rounded-xs" />
          <div className="w-[2px] h-1 bg-slate-400 dark:bg-slate-600 rounded-xs" />
        </div>
      )
    }
    return (
      <div className="flex items-center gap-[2px] h-4">
        <div className="soundwave-bar rounded-xs" />
        <div className="soundwave-bar rounded-xs" style={{ animationDelay: '0.2s' }} />
        <div className="soundwave-bar rounded-xs" style={{ animationDelay: '0.4s' }} />
        <div className="soundwave-bar rounded-xs" style={{ animationDelay: '0.1s' }} />
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-3 sm:px-4 py-14 relative overflow-x-hidden ${isLight ? 'bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900' : 'bg-[#020617] text-white'}`}>
      
      {/* 3D Premium Custom CSS Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        .pass-card-3d {
          transform-style: preserve-3d;
          transition: transform 0.15s ease-out;
        }
        .pass-card {
          backdrop-filter: blur(25px);
          border: 1.5px solid rgba(255, 255, 255, 0.08);
          box-shadow: 
            inset 0 1px 1px rgba(255, 255, 255, 0.2), 
            0 15px 30px -10px rgba(0,0,0,0.3),
            0 0 20px rgba(99, 102, 241, 0.06);
          background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
        }
        .light .pass-card {
          border: 1.5px solid rgba(15, 23, 42, 0.08);
          box-shadow: 
            inset 0 1px 2px rgba(255, 255, 255, 0.8), 
            0 10px 20px rgba(15,23,42,0.04),
            0 0 15px rgba(99, 102, 241, 0.02);
          background: linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.65) 100%);
        }
        
        .active-tab-3d {
          box-shadow: 
            0 -2px 0 rgba(255, 255, 255, 0.1) inset,
            0 4px 8px rgba(99, 102, 241, 0.15),
            0 0 10px rgba(99, 102, 241, 0.2);
          transform: translateZ(4px);
          border-color: rgba(99, 102, 241, 0.4) !important;
        }

        /* Border Sweep Animation */
        @keyframes sweep {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .cyber-border {
          background: linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
          padding: 1px;
          border-radius: 12px;
          transition: all 0.35s ease;
        }
        .cyber-border.focused {
          background: linear-gradient(90deg, #6366f1, #3b82f6, #ec4899, #6366f1);
          background-size: 200% 200%;
          animation: sweep 2s linear infinite;
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.15);
        }
        .light .cyber-border.focused {
          box-shadow: 0 0 8px rgba(99, 102, 241, 0.08);
        }

        .cyber-input-inner {
          background: rgba(11, 17, 32, 0.75);
          backdrop-filter: blur(15px);
          border-radius: 11px;
          transition: all 0.3s ease;
        }
        .light .cyber-input-inner {
          background: rgba(255, 255, 255, 0.95);
        }

        .icon-pulse {
          animation: iconPulse 2s infinite ease-in-out;
        }
        @keyframes iconPulse {
          0%, 100% { transform: scale(1) translateZ(0); filter: drop-shadow(0 0 0px transparent); }
          50% { transform: scale(1.1) translateZ(10px); filter: drop-shadow(0 0 6px rgba(99, 102, 241, 0.6)); }
        }

        /* Soundwave animation */
        @keyframes soundwave {
          0%, 100% { height: 4px; }
          50% { height: 14px; }
        }
        .soundwave-bar {
          width: 2px;
          background-color: #6366f1;
          animation: soundwave 1s ease-in-out infinite;
        }

        /* Warning modal — sweeping amber/rose gradient border */
        @keyframes warningSweep {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .warning-border {
          background: linear-gradient(120deg, #f43f5e, #f59e0b, #f43f5e, #fb7185);
          background-size: 300% 300%;
          animation: warningSweep 4s ease infinite;
          padding: 1.5px;
          border-radius: 28px;
        }
        @keyframes warningRingPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.35); }
          70% { box-shadow: 0 0 0 14px rgba(244, 63, 94, 0); }
        }
        .warning-ring {
          animation: warningRingPulse 2.2s ease-out infinite;
        }
      `}} />

      {/* Ma'lumotlar aniqligi haqida ogohlantirish — forma bilan hech qachon
          birga ko'rinmaydi, faqat tasdiqlangandan so'ng forma ochiladi. */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            key="warning-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="warning-border shadow-2xl shadow-rose-950/40 max-w-md w-full"
            >
              <div className={`rounded-[27px] p-6 sm:p-8 text-center space-y-5 backdrop-blur-3xl ${
                isLight ? 'bg-white' : 'bg-[#0b1120]'
              }`}>
                {/* Icon badge with pulsing danger ring */}
                <div className="relative mx-auto w-16 h-16">
                  <div className="warning-ring absolute inset-0 rounded-full" />
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/30">
                    <ShieldAlert className="text-white" size={30} />
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-rose-500">
                    Diqqat, muhim ogohlantirish!
                  </h2>
                  <p className={`text-xs sm:text-[13px] leading-relaxed font-sans ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    Hurmatli talaba, kiritilayotgan ma&apos;lumotlar <span className="font-black text-amber-500">100%</span>{' '}
                    to&apos;g&apos;ri ekaniga ishonch hosil qiling.
                  </p>
                </div>

                <div className={`rounded-2xl border p-4 text-left flex gap-3 items-start ${
                  isLight ? 'bg-rose-50 border-rose-200' : 'bg-rose-500/10 border-rose-500/20'
                }`}>
                  <ShieldCheck className="text-rose-500 shrink-0 mt-0.5" size={18} />
                  <p className={`text-[11px] sm:text-xs leading-relaxed font-sans font-medium ${isLight ? 'text-rose-700' : 'text-rose-300'}`}>
                    Mas&apos;ullar tomonidan tekshirilganda kiritilgan ma&apos;lumotlar (F.I.Sh, pasport, JShSHIR) hujjatga mos kelmasa,
                    yo&apos;llanmangiz <span className="font-black">bekor qilinadi</span>.
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

      {/* Floating 3D Orbs — fixed clipped layer so the tall form still scrolls on phones. */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-25%] left-[-25%] w-[65%] h-[65%] bg-blue-500/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-25%] right-[-25%] w-[65%] h-[65%] bg-purple-500/5 rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl">
        
        {/* Navigation and Sound settings */}
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <Link 
            href="/"
            onClick={() => playSound('tab')}
            className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all duration-300 border ${
              isLight 
                ? 'bg-white/80 border-slate-200 text-slate-700 hover:bg-slate-100 shadow-xs' 
                : 'bg-[#0f172a]/80 border-white/5 text-slate-400 hover:bg-white/5 shadow-md shadow-black/30'
            }`}
          >
            <ArrowLeft size={14} />
            <span>Bosh sahifa</span>
          </Link>

          <div className="flex items-center gap-2">
            {/* Interactive Audio Toggle with visual Equalizer */}
            <button
              onClick={toggleMute}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300 ${
                isLight 
                  ? 'bg-white/80 border-slate-200 text-slate-700 hover:bg-slate-100' 
                  : 'bg-[#0f172a]/80 border-white/5 text-slate-400 hover:bg-white/5'
              }`}
              title={isMuted ? "Tovushni yoqish" : "Tovushni o'chirish"}
            >
              {isMuted ? <VolumeX size={14} className="text-slate-400" /> : <Volume2 size={14} className="text-indigo-400" />}
              {renderSoundwave()}
            </button>
            <ThemeToggle />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div
              key="form-container"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`backdrop-blur-3xl border rounded-2xl p-3.5 sm:p-5 shadow-lg relative overflow-visible ${
                isLight ? 'bg-white/90 border-slate-200/80 shadow-slate-300/20' : 'bg-[#0b1120]/80 border-white/10 shadow-black/50'
              }`}
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-8 items-center">
                
                {/* COLUMN 1: Interactive Floating 3D Student ID Card Preview -
                    HIDDEN ON MOBILE, and hidden on Step 4 too since the
                    review step shows its own (bigger, flippable) card. */}
                {formStep < 4 && (
                  <div className="hidden md:block md:col-span-5 [perspective:1200px] select-none w-full">
                    {renderIdCard()}
                  </div>
                )}

                {/* COLUMN 2: Form Wizard — spans the full width on Step 4,
                    since there's no side-column card to share space with. */}
                <div className={`space-y-3.5 w-full ${formStep === 4 ? 'md:col-span-12' : 'md:col-span-7 md:col-start-6'}`}>

                  {resubmitMode && (
                    <div className={`flex items-start gap-2.5 rounded-xl border p-3 ${
                      isLight ? 'border-blue-200 bg-blue-50' : 'border-blue-500/25 bg-blue-500/10'
                    }`}>
                      <RotateCw size={15} className={`mt-0.5 shrink-0 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                      <p className={`text-[11px] leading-relaxed font-sans ${isLight ? 'text-blue-800' : 'text-blue-200'}`}>
                        Rad etilgan arizangizni <span className="font-bold">tuzatib qayta yuboryapsiz</span>.
                        Pasport, JShSHIR va emailni o&apos;zgartirmang — faqat to&apos;g&apos;ri hujjatni yuklang.
                        Ariza qaytadan ko&apos;rib chiqish navbatiga tushadi.
                      </p>
                    </div>
                  )}

                  {/* 3D Premium Wizard Tabs */}
                  <div className="relative p-1 rounded-xl bg-slate-950/20 dark:bg-slate-950/60 border border-slate-200/10 dark:border-white/5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)] flex justify-between items-center gap-1 overflow-hidden">
                    {[
                      { step: 1, label: 'Shaxsiy' },
                      { step: 2, label: 'O‘qish' },
                      { step: 3, label: 'Hujjat' },
                      { step: 4, label: 'Tasdiq' }
                    ].map((s) => {
                      const isActive = formStep === s.step
                      return (
                        <button
                          key={s.step}
                          type="button"
                          onClick={() => {
                            playSound('tab')
                            if (s.step < formStep) setFormStep(s.step)
                            else if (s.step === 2 && formStep === 1 && validateStep1()) setFormStep(2)
                            else if (s.step === 3 && formStep === 2 && validateStep1() && validateStep2()) setFormStep(3)
                            else if (s.step === 4 && formStep === 3 && validateStep1() && validateStep2() && validateStep3()) { setCardFlipped(false); setFormStep(4) }
                          }}
                          className={`flex-1 min-w-0 py-1.5 sm:py-2 px-1 text-center rounded-lg border text-[10px] sm:text-xs font-black uppercase tracking-wide sm:tracking-wider relative transition-all duration-300 z-10 ${
                            isActive
                              ? 'text-white font-bold border-transparent'
                              : isLight
                                ? 'text-slate-500 border-slate-200 hover:text-slate-700 hover:bg-slate-50'
                                : 'text-slate-400 border-white/5 hover:text-slate-200 hover:bg-white/5'
                          }`}
                        >
                          {/* Active Tab sliding backplate */}
                          {isActive && (
                            <motion.div
                              layoutId="activeWizardTab"
                              className="absolute inset-0 bg-gradient-to-r from-blue-600/35 to-indigo-600/35 dark:from-blue-500/25 dark:to-indigo-500/25 border border-indigo-500/30 rounded-lg shadow-[0_0_12px_rgba(99,102,241,0.2)] active-tab-3d"
                              transition={{ type: "spring", stiffness: 350, damping: 25 }}
                            />
                          )}
                          <span className="relative z-20 block truncate">{s.step}. {s.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Form Content Wrapper */}
                  <form onSubmit={handleSubmit} className="space-y-3.5 relative">
                    
                    {/* Floating dynamic typing particles */}
                    <div className="absolute inset-0 pointer-events-none overflow-visible z-50">
                      {particles.map((p) => (
                        <div
                          key={p.id}
                          className="absolute rounded-full"
                          style={{
                            left: p.x,
                            top: p.y,
                            width: `${p.size}px`,
                            height: `${p.size}px`,
                            backgroundColor: p.color,
                            boxShadow: `0 0 8px ${p.color}, 0 0 16px ${p.color}`,
                            opacity: p.alpha,
                            transition: 'transform 0.05s linear'
                          }}
                        />
                      ))}
                    </div>

                    {/* STEP 1: Personal Info */}
                    {formStep === 1 && (
                      <motion.div
                        initial={{ opacity: 0, x: 15 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-3"
                      >
                        {/* Full Name */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center ml-2">
                            <label className={`text-[10px] sm:text-xs font-black uppercase tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>F.I.Sh (Familiya Ism Sharif)</label>
                            {fullName.trim().length > 5 && (
                              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                            )}
                          </div>
                          <div className={`cyber-border ${focusedField === 'fullName' ? 'focused' : ''}`}>
                            <div className="cyber-input-inner relative">
                              <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${focusedField === 'fullName' ? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_#6366f1]' : 'text-slate-500'}`}>
                                <User size={16} />
                              </div>
                              
                              {/* Inner glow emitter */}
                              {focusedField === 'fullName' && (
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-indigo-500/10 blur-[6px] pointer-events-none" />
                              )}

                              <input
                                type="text"
                                value={fullName}
                                onFocus={() => {
                                  setFocusedField('fullName')
                                  playSound('focus')
                                }}
                                onBlur={() => setFocusedField(null)}
                                onChange={(e) => handleInputChange(e, (v) => setFullName(cyrillicToLatin(v)), 'fullName')}
                                placeholder="Familiya Ism Sharif"
                                className={`w-full bg-transparent py-2.5 sm:py-3 pr-4 pl-12 rounded-xl text-base outline-none transition-colors duration-300 ${
                                  isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-500'
                                }`}
                                required
                              />
                            </div>
                          </div>
                          <p className={`px-2 text-[9px] leading-relaxed ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                            To&apos;liq yozing: Familiya, Ism va Otasining ismi — 3 ta so&apos;z. Kirilcha yozsangiz avtomatik lotinga o&apos;giriladi.
                          </p>
                        </div>

                        {/* Email & Phone */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {/* Email */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center ml-2">
                              <label className={`text-[10px] sm:text-xs font-black uppercase tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Email Manzil</label>
                              {email.includes('@') && email.length > 5 && (
                                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                              )}
                            </div>
                            <div className={`cyber-border ${focusedField === 'email' ? 'focused' : ''}`}>
                              <div className="cyber-input-inner relative">
                                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${focusedField === 'email' ? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_#6366f1]' : 'text-slate-500'}`}>
                                  <Mail size={16} />
                                </div>

                                {focusedField === 'email' && (
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-indigo-500/10 blur-[6px] pointer-events-none" />
                                )}

                                <input
                                  type="email"
                                  value={email}
                                  onFocus={() => {
                                    setFocusedField('email')
                                    playSound('focus')
                                  }}
                                  onBlur={() => setFocusedField(null)}
                                  onChange={(e) => handleInputChange(e, setEmail, 'email')}
                                  placeholder="misol@gmail.com"
                                  className={`w-full bg-transparent py-2.5 sm:py-3 pr-4 pl-12 rounded-xl text-base outline-none transition-colors duration-300 ${
                                    isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-500'
                                  }`}
                                  required
                                />
                              </div>
                            </div>
                          </div>

                          {/* Phone */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center ml-2">
                              <label className={`text-[10px] sm:text-xs font-black uppercase tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Telefon raqam</label>
                              {phone.length === 9 && (
                                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                              )}
                            </div>
                            <div className={`cyber-border ${focusedField === 'phone' ? 'focused' : ''}`}>
                              <div className="cyber-input-inner relative flex items-center">
                                <div className={`absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none border-r pr-2 transition-all duration-300 ${
                                  focusedField === 'phone' ? 'text-indigo-400 border-indigo-500/30' : `text-slate-500 ${isLight ? 'border-slate-200' : 'border-white/10'}`
                                }`}>
                                  <Phone size={16} />
                                  <span className="text-base font-bold">+998</span>
                                </div>

                                {focusedField === 'phone' && (
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-indigo-500/10 blur-[6px] pointer-events-none" />
                                )}

                                <input
                                  type="tel"
                                  inputMode="numeric"
                                  value={phone}
                                  maxLength={9}
                                  onFocus={() => {
                                    setFocusedField('phone')
                                    playSound('focus')
                                  }}
                                  onBlur={() => setFocusedField(null)}
                                  onChange={(e) => handleInputChange(e, (val) => setPhone(val.replace(/\D/g, '').slice(0, 9)), 'phone')}
                                  placeholder="901234567"
                                  className={`w-full bg-transparent py-2.5 sm:py-3 pr-4 pl-28 rounded-xl text-base outline-none transition-colors duration-300 ${
                                    isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-500'
                                  }`}
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Interactive 3D Gender Selector Pods */}
                        <div className="space-y-1">
                          <label className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Jinsi</label>
                          <div className="flex gap-3">
                            
                            {/* Male selection pod */}
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.01, y: -0.5 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => selectGender('male')}
                              className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-500 relative overflow-hidden min-h-[75px] sm:min-h-[90px] ${
                                gender === 'male'
                                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-400 shadow-[0_6px_15px_rgba(59,130,246,0.1)] ring-2 ring-blue-500/15'
                                  : isLight 
                                    ? 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700' 
                                    : 'bg-[#0f172a]/70 border-white/5 text-slate-400 hover:bg-white/5'
                              }`}
                            >
                              <div className={`h-7 w-7 rounded-full flex items-center justify-center mb-1 transition-all duration-300 ${
                                gender === 'male' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20 scale-105' : 'bg-slate-100 dark:bg-white/5'
                              }`}>
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="8" r="4"/>
                                  <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                                </svg>
                              </div>
                              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider">Erkak</span>
                              
                              {gender === 'male' && (
                                <motion.span 
                                  layoutId="genderCheck"
                                  className="absolute top-1 right-2 text-[6px] font-black text-blue-400 uppercase tracking-widest"
                                >
                                  ✓ Tanlandi
                                </motion.span>
                              )}
                            </motion.button>

                            {/* Female selection pod */}
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.01, y: -0.5 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => selectGender('female')}
                              className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-500 relative overflow-hidden min-h-[75px] sm:min-h-[90px] ${
                                gender === 'female'
                                  ? 'bg-pink-500/15 border-pink-500/40 text-pink-400 shadow-[0_6px_15px_rgba(236,72,153,0.1)] ring-2 ring-pink-500/15'
                                  : isLight 
                                    ? 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700' 
                                    : 'bg-[#0f172a]/70 border-white/5 text-slate-400 hover:bg-white/5'
                              }`}
                            >
                              <div className={`h-7 w-7 rounded-full flex items-center justify-center mb-1 transition-all duration-300 ${
                                gender === 'female' ? 'bg-pink-500 text-white shadow-md shadow-pink-500/20 scale-105' : 'bg-slate-100 dark:bg-white/5'
                              }`}>
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"/>
                                  <path d="M18 21a6 6 0 0 0-12 0"/>
                                </svg>
                              </div>
                              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider">Ayol</span>
                              
                              {gender === 'female' && (
                                <motion.span 
                                  layoutId="genderCheck"
                                  className="absolute top-1 right-2 text-[6px] font-black text-pink-400 uppercase tracking-widest"
                                >
                                  ✓ Tanlandi
                                </motion.span>
                              )}
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* STEP 2: Academic Details */}
                    {formStep === 2 && (
                      <motion.div
                        initial={{ opacity: 0, x: 15 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-4"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                          {/* Faculty */}
                          <div className="space-y-1">
                            <label className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Fakultet</label>
                            <div className={`cyber-border ${focusedField === 'faculty' ? 'focused' : ''}`}>
                              <div className="cyber-input-inner relative">
                                <CustomSelect
                                  value={faculty}
                                  onFocus={() => {
                                    setFocusedField('faculty')
                                    playSound('focus')
                                  }}
                                  onBlur={() => setFocusedField(null)}
                                  onChange={(val) => {
                                    setFaculty(val)
                                    // Yo'nalishlar fakultetga bog'liq — eskisi
                                    // yangi fakultetda mavjud bo'lmasligi mumkin
                                    setDirection((prev) =>
                                      directionsForFaculty(val).some((option) => option.value === prev) ? prev : ''
                                    )
                                    playSound('keypress')
                                  }}
                                  options={[...PERMIT_FACULTIES]}
                                  className={`bg-transparent p-2.5 sm:p-3 rounded-xl text-base font-black uppercase tracking-wider transition-colors duration-300 ${
                                    isLight ? 'text-slate-900' : 'text-white'
                                  }`}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Direction */}
                          <div className="space-y-1 sm:col-span-2">
                            <div className="flex justify-between items-center ml-2">
                              <label className={`text-[10px] sm:text-xs font-black uppercase tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Yo&apos;nalish / Guruh</label>
                              {direction.trim().length > 0 && (
                                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                              )}
                            </div>
                            <div className={`cyber-border ${focusedField === 'direction' ? 'focused' : ''}`}>
                              <div className="cyber-input-inner relative">
                                <div className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none transition-all duration-300 ${focusedField === 'direction' ? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_#6366f1]' : 'text-slate-500'}`}>
                                  <GraduationCap size={16} />
                                </div>

                                {focusedField === 'direction' && (
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-indigo-500/10 blur-[6px] pointer-events-none" />
                                )}

                                {/* Erkin matn emas, ro'yxatdan tanlash: "Amaliy
                                    matematika" va "amaliy-matematika" bir xil
                                    yo'nalish sifatida saqlanishi uchun */}
                                <CustomSelect
                                  value={direction}
                                  onFocus={() => {
                                    setFocusedField('direction')
                                    playSound('focus')
                                  }}
                                  onBlur={() => setFocusedField(null)}
                                  onChange={(val) => {
                                    setDirection(val)
                                    playSound('keypress')
                                  }}
                                  placeholder="Yo'nalishni tanlang"
                                  options={directionsForFaculty(faculty).map((option) => ({
                                    value: option.value,
                                    label: option.label,
                                  }))}
                                  className={`w-full bg-transparent py-2.5 sm:py-3 pr-4 pl-12 rounded-xl text-base transition-colors duration-300 ${
                                    isLight ? 'text-slate-900' : 'text-white'
                                  }`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Course Selection Buttons */}
                        <div className="space-y-1">
                          <label className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Kurs</label>
                          <div className="flex gap-2">
                            {['1', '2', '3', '4'].map((c) => (
                              <motion.label
                                key={c}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={`flex-1 py-2.5 sm:py-3 rounded-xl border flex items-center justify-center cursor-pointer select-none text-xs sm:text-sm font-black transition-all duration-300 ${
                                  course === c
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-2 ring-indigo-500/15'
                                    : isLight 
                                      ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100' 
                                      : 'bg-[#0f172a]/70 border-white/5 text-slate-400 hover:bg-white/5'
                                }`}
                              >
                                <input 
                                  type="radio" 
                                  name="course" 
                                  value={c} 
                                  checked={course === c} 
                                  onChange={() => {
                                    setCourse(c)
                                    playSound('keypress')
                                  }} 
                                  className="hidden" 
                                />
                                {c}-kurs
                              </motion.label>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* STEP 3: Passport & Documents */}
                    {formStep === 3 && (
                      <motion.div
                        initial={{ opacity: 0, x: 15 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-4"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {/* Passport */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center ml-2">
                              <label className={`text-[10px] sm:text-xs font-black uppercase tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Pasport Seriya & Raqam</label>
                              {isValidPassport(normalizePassport(passportSeries)) && (
                                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                              )}
                            </div>
                            <div className={`cyber-border ${focusedField === 'passport' ? 'focused' : ''}`}>
                              <div className="cyber-input-inner relative">
                                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${focusedField === 'passport' ? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_#6366f1]' : 'text-slate-500'}`}>
                                  <CreditCard size={16} />
                                </div>

                                {focusedField === 'passport' && (
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-indigo-500/10 blur-[6px] pointer-events-none" />
                                )}

                                <input
                                  type="text"
                                  maxLength={9}
                                  value={passportSeries}
                                  onFocus={() => {
                                    setFocusedField('passport')
                                    playSound('focus')
                                  }}
                                  onBlur={() => setFocusedField(null)}
                                  onChange={(e) => handleInputChange(
                                    e,
                                    (value) => setPassportSeries(normalizePassport(value)),
                                    'passport',
                                  )}
                                  placeholder="AA1234567"
                                  className={`w-full bg-transparent py-2.5 sm:py-3 pr-4 pl-12 rounded-xl text-base outline-none transition-colors duration-300 ${
                                    isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-500'
                                  }`}
                                  required
                                />
                              </div>
                            </div>
                            {getPassportFormatError(passportSeries) ? (
                              <p className="px-2 text-[10px] font-semibold leading-relaxed text-rose-500" role="alert">
                                {getPassportFormatError(passportSeries)}
                              </p>
                            ) : (
                              <p className={`px-2 text-[9px] leading-relaxed ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                O&apos;zbekiston yo&apos;llanmasi: AA1234567 · xorijiy talabalar alohida ariza turidan foydalanadi
                              </p>
                            )}
                          </div>

                          {/* JSHSHIR */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center ml-2">
                              <label className={`text-[10px] sm:text-xs font-black uppercase tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>JSHSHIR (14 ta raqam)</label>
                              {jshshir.trim().length === 14 && (
                                <motion.span 
                                  animate={{ scale: [1, 1.3, 1] }}
                                  className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" 
                                />
                              )}
                            </div>
                            <div className={`cyber-border ${focusedField === 'jshshir' ? 'focused' : ''}`}>
                              <div className="cyber-input-inner relative">
                                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${focusedField === 'jshshir' ? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_#6366f1]' : 'text-slate-500'}`}>
                                  <CreditCard size={16} />
                                </div>

                                {focusedField === 'jshshir' && (
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-indigo-500/10 blur-[6px] pointer-events-none" />
                                )}

                                <input
                                  type="text"
                                  maxLength={14}
                                  value={jshshir}
                                  onFocus={() => {
                                    setFocusedField('jshshir')
                                    playSound('focus')
                                  }}
                                  onBlur={() => setFocusedField(null)}
                                  onChange={(e) => handleInputChange(e, setJshshir, 'jshshir')}
                                  placeholder="30102030405060"
                                  className={`w-full bg-transparent py-2.5 sm:py-3 pr-4 pl-12 rounded-xl text-base outline-none transition-colors duration-300 ${
                                    isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-500'
                                  }`}
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* File Upload Permit */}
                        <div className="space-y-1">
                          <label className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ml-2 block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Yo&apos;llanma Hujjatini Yuklash (PDF yoki Rasm)</label>
                          <motion.div 
                            whileHover={{ scale: 1.01, y: -0.5 }}
                            className={`relative border border-dashed rounded-xl p-3 sm:p-4 text-center cursor-pointer transition-all duration-300 ${
                              file 
                                ? 'border-emerald-500/40 bg-emerald-500/5' 
                                : isLight 
                                  ? 'border-slate-300 hover:bg-slate-50 shadow-inner' 
                                  : 'border-white/10 hover:bg-white/5'
                            }`}
                          >
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              onChange={handleFileChange}
                              disabled={preparingFile}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait"
                              required
                            />
                            <div className="flex flex-col items-center justify-center gap-1">
                              {preparingFile ? (
                                <>
                                  <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                  <span className="text-xs font-black tracking-wide">Rasm tayyorlanmoqda…</span>
                                  <span className="text-[10px] text-slate-500 font-sans">iPhone rasmi biroz vaqt olishi mumkin</span>
                                </>
                              ) : (
                                <>
                                  <Upload className={`h-6 w-6 transition-all duration-300 ${file ? 'text-emerald-400 scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'text-slate-500'}`} />
                                  <span className="text-xs font-black tracking-wide">
                                    {file ? file.name : "Ruxsatnoma faylini tanlang"}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-sans">
                                    {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF, PNG, JPG (Maks. 4 MB) — iPhone rasmi ham bo‘ladi"}
                                  </span>
                                </>
                              )}
                            </div>
                          </motion.div>
                          <p className={`flex items-start gap-1.5 px-2 text-[10px] leading-relaxed font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            <ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                            Faqat my.gov.uz yo‘llanmasining to‘liq sahifasini yuklang. Sarlavha, talaba ma’lumotlari va QR kod aniq ko‘rinishi kerak — fayl yuborishdan oldin AI orqali tekshiriladi.
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {/* STEP 4: Review & Confirm — the one card holds
                        everything: front + back, flipped in place. */}
                    {formStep === 4 && (
                      <motion.div
                        initial={{ opacity: 0, x: 15 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-4"
                      >
                        <div className="text-center space-y-1">
                          <h3 className={`text-sm sm:text-base font-black uppercase tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            Ma&apos;lumotlaringizni tekshiring
                          </h3>
                          <p className={`text-[10px] sm:text-[11px] font-medium leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            Kartani aylantirib orqa tomonini ham ko&apos;ring. Xato bo&apos;lsa, kartaning burchagidagi tugmadan tahrirlang.
                          </p>
                        </div>

                        <div className="relative mx-auto w-full max-w-[300px] sm:max-w-[360px] [perspective:1600px] select-none pt-3 pr-3">
                          {/* Edit button — pinned at the card's corner, stays
                              put while the card itself flips underneath it. */}
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.06 }}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => { playSound('tab'); setFormStep(1) }}
                            className="absolute top-0 right-0 z-20 flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/30 ring-2 ring-white dark:ring-[#0b1120]"
                          >
                            <Pencil size={11} />
                            <span>Tahrirlash</span>
                          </motion.button>

                          <motion.div
                            animate={{ rotateY: cardFlipped ? 180 : 0 }}
                            transition={{ duration: 0.65, type: 'spring', stiffness: 210, damping: 26 }}
                            style={{ transformStyle: 'preserve-3d' }}
                            className="relative w-full min-h-[220px] sm:min-h-[250px]"
                          >
                            {/* FRONT — identity, hujjat, o'qish */}
                            <div
                              style={{ backfaceVisibility: 'hidden' }}
                              className="pass-card absolute inset-0 rounded-2xl p-4 sm:p-5 flex flex-col overflow-hidden"
                            >
                              <div className="flex justify-between items-start">
                                <span className={`text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded border ${
                                  gender === 'male'
                                    ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                                    : gender === 'female'
                                      ? 'text-pink-400 bg-pink-500/10 border-pink-500/20'
                                      : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
                                }`}>
                                  SMARTDORM • TALABA ID
                                </span>
                                <div className="relative w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-amber-400/80 to-yellow-600/80 border border-amber-300/30 shadow-[0_0_12px_rgba(245,158,11,0.2)] overflow-hidden shrink-0">
                                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:4px_4px]" />
                                </div>
                              </div>

                              <div className="mt-3">
                                <p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">F.I.Sh</p>
                                <h3 className={`text-sm sm:text-lg font-black uppercase tracking-wide mt-1 font-sans leading-tight truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                  {fullName.trim() || "Kiritilmagan"}
                                </h3>
                              </div>

                              <div className="flex justify-between items-end pt-3 border-t border-slate-700/10 dark:border-white/5 mt-auto">
                                <div className="space-y-1 sm:space-y-1.5 min-w-0">
                                  <p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Hujjatlar</p>
                                  <p className={`text-[9px] sm:text-xs font-mono leading-none font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                                    {passportSeries.toUpperCase() || "AAXXXXXXX"} • {jshshir || "30102030405060"}
                                  </p>
                                  {renderBarcode()}
                                </div>

                                <div className="text-right flex flex-col items-end gap-1 shrink-0 pl-2">
                                  <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl bg-slate-950/20 dark:bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 overflow-hidden relative shadow-inner">
                                    {gender === 'male' ? (
                                      <div className="text-blue-400 filter drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                                        <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <circle cx="12" cy="8" r="4"/>
                                          <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                                        </svg>
                                      </div>
                                    ) : gender === 'female' ? (
                                      <div className="text-pink-400 filter drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]">
                                        <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"/>
                                          <path d="M18 21a6 6 0 0 0-12 0"/>
                                        </svg>
                                      </div>
                                    ) : (
                                      <User className="w-4 h-4 sm:w-5 sm:h-5 opacity-30" />
                                    )}
                                  </div>
                                  <span className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">KURS</span>
                                  <p className="text-[9px] sm:text-xs font-black uppercase text-indigo-400 leading-none truncate max-w-[110px]">
                                    {course}-kurs • {(PERMIT_FACULTIES.find((f) => f.value === faculty)?.label ?? faculty).toUpperCase()}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* BACK — aloqa va yo'nalish */}
                            <div
                              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                              className="pass-card absolute inset-0 rounded-2xl p-4 sm:p-5 flex flex-col overflow-hidden"
                            >
                              <div className="flex justify-between items-start">
                                <span className="text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded border text-indigo-400 bg-indigo-500/10 border-indigo-500/20">
                                  SMARTDORM • ALOQA
                                </span>
                                <FileText size={16} className="text-slate-500 shrink-0" />
                              </div>

                              <div className="mt-4 space-y-3 flex-1">
                                {cardFieldRow(Mail, 'Email', email)}
                                {cardFieldRow(Phone, 'Telefon', phone ? `+998 ${phone}` : '')}
                                {cardFieldRow(BookOpen, "Yo'nalish", directionsForFaculty(faculty).find((d) => d.value === direction)?.label ?? direction)}
                                {cardFieldRow(Upload, 'Fayl', file?.name ?? '')}
                              </div>

                              <p className="text-[7px] sm:text-[8px] font-black text-slate-600 uppercase tracking-widest text-center pt-2 border-t border-slate-700/10 dark:border-white/5">
                                Old tomonga qaytish uchun pastdagi tugmani bosing
                              </p>
                            </div>
                          </motion.div>
                        </div>

                        {/* Flip toggle */}
                        <div className="flex justify-center">
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { setCardFlipped((f) => !f); playSound('tab') }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                              isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            <RotateCw size={13} />
                            <span>{cardFlipped ? 'Old tomonini ko‘rish' : 'Orqa tomonini ko‘rish'}</span>
                          </motion.button>
                        </div>
                      </motion.div>
                    )}

                    {/* Form Action Navigation */}
                    <div className="flex gap-4 pt-1">
                      {formStep > 1 && (
                        <button
                          type="button"
                          onClick={handlePrevStep}
                          title="Orqaga"
                          aria-label="Orqaga"
                          className={`shrink-0 w-12 py-3 rounded-xl border flex items-center justify-center transition-all duration-300 active:scale-95 ${
                            isLight
                              ? 'border-slate-300 text-slate-700 hover:bg-slate-100 shadow-xs'
                              : 'border-white/10 hover:bg-white/5 text-slate-300'
                          }`}
                        >
                          <ChevronLeft size={18} />
                        </button>
                      )}

                      {formStep < 4 ? (
                        <button
                          type="button"
                          onClick={handleNextStep}
                          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black uppercase tracking-widest text-xs flex items-center justify-center gap-1.5 transition-all duration-300 active:scale-95"
                        >
                          <span>Keyingi</span> <ChevronRight size={14} />
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 text-white font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 disabled:opacity-50"
                        >
                          {loading ? (
                            <>
                              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>{submissionStage === 'ai' ? 'AI yo‘llanmani tekshirmoqda…' : 'Ariza yuborilmoqda…'}</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={14} />
                              <span>Tasdiqlayman, Yuborish</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </form>

                  {/* Status checking block link */}
                  <div className="text-center pt-2.5 border-t border-slate-700/10 dark:border-white/5">
                    <Link 
                      href="/ruxsatnoma-tekshirish" 
                      onClick={() => playSound('tab')}
                      className="text-xs font-black uppercase tracking-wider text-blue-500 hover:text-blue-600 flex items-center justify-center gap-1.5 transition-all duration-300"
                    >
                      <span>Ariza holatini tekshirish</span>
                      <ChevronRight size={12} />
                    </Link>
                  </div>
                </div>

              </div>
            </motion.div>
          ) : (
            <motion.div
              key="success-container"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={`backdrop-blur-3xl border rounded-3xl max-w-md mx-auto p-6 sm:p-10 shadow-2xl text-center space-y-6 ${
                isLight ? 'bg-white/85 border-slate-200 shadow-slate-300/40' : 'bg-[#0b1120]/80 border-white/10 shadow-black/80'
              }`}
            >
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 animate-bounce">
                <CheckCircle2 size={32} />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-emerald-400">Muvaffaqiyatli yuborildi!</h2>
                <p className={`text-xs leading-relaxed font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Sizning yotoqxona ruxsatnoma yo&apos;llanmangiz ko&apos;rib chiqish uchun qabul qilindi. Hujjat Dekan tomonidan tasdiqlanganidan so&apos;ng sizga xona biriktiriladi va tizimda to&apos;liq ro&apos;yxatdan o&apos;tishingiz mumkin bo&apos;ladi.
                </p>
              </div>

              <div className="bg-slate-950/40 rounded-2xl p-5 text-left border border-white/5 font-sans space-y-3 shadow-inner">
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Ma&apos;lumotlaringiz</p>
                <div className="text-xs space-y-2 text-slate-300">
                  <p className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-500">Talaba:</span> 
                    <span className="font-bold text-white">{fullName}</span>
                  </p>
                  <p className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-500">Pasport:</span> 
                    <span className="font-mono font-bold text-white">{passportSeries.toUpperCase()}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-500">Fakultet:</span> 
                    <span className="font-bold text-indigo-400">{faculty.toUpperCase()}</span>
                  </p>
                </div>
              </div>

              <TelegramPermitConnect url={telegramLink} linked={telegramLinked} isLight={isLight} />

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => {
                    playSound('tab')
                    router.push('/ruxsatnoma-tekshirish')
                  }}
                  className="flex-1 p-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest transition-all duration-300 active:scale-95"
                >
                  Ariza holatini tekshirish
                </button>
                <button
                  onClick={() => {
                    playSound('tab')
                    router.push('/')
                  }}
                  className={`flex-1 p-4 rounded-xl border text-xs font-black uppercase tracking-widest transition-all duration-300 active:scale-95 ${
                    isLight 
                      ? 'border-slate-300 text-slate-700 hover:bg-slate-100 shadow-sm' 
                      : 'border-white/10 hover:bg-white/5 text-slate-400'
                  }`}
                >
                  Bosh sahifa
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <DeveloperContactLink />
    </div>
  )
}
