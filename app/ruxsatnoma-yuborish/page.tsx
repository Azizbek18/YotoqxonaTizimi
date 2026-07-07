'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, User, Mail, Phone, Volume2, VolumeX,
  ChevronRight, ChevronLeft, ArrowLeft, CheckCircle2, CreditCard, GraduationCap
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { useThemeStore } from '@/lib/stores/theme-store'

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
  const [faculty, setFaculty] = useState('amit')
  const [direction, setDirection] = useState('')
  const [course, setCourse] = useState('1')
  const [file, setFile] = useState<File | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

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

  // Programmatic Sound Synthesis
  const playSound = (type: 'keypress' | 'success' | 'focus' | 'tab' | 'gender') => {
    if (typeof window === 'undefined') return
    const currentMuted = localStorage.getItem('dorm_sound_muted') === 'true'
    if (currentMuted) return

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext
      if (!AudioContextClass) return
      const ctx = new AudioContextClass()
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0]
      if (selected.size > 5 * 1024 * 1024) {
        showToast('error', "Fayl o'lchami 5MB dan oshmasligi kerak!")
        return
      }
      setFile(selected)
      playSound('success')
    }
  }

  const validateStep1 = () => {
    if (!fullName.trim()) {
      showToast('error', 'F.I.Sh kiriting!')
      return false
    }
    if (!email.trim() || !email.includes('@')) {
      showToast('error', 'To‘g‘ri email manzilini kiriting!')
      return false
    }
    if (!phone.trim()) {
      showToast('error', 'Telefon raqamini kiriting!')
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

    if (formStep !== 3) return

    if (!passportSeries || !jshshir || !file) {
      showToast('error', "Iltimos, pasport ma'lumotlarini to'ldiring va faylni yuklang!")
      return
    }

    if (jshshir.length !== 14 || !/^\d+$/.test(jshshir)) {
      showToast('error', "JShSHIR 14 ta raqamdan iborat bo'lishi lozim!")
      return
    }

    setLoading(true)

    try {
      const cleanPassport = passportSeries.toUpperCase().replace(/\s/g, '')
      const cleanJshshir = jshshir.trim()
      const cleanEmail = email.trim().toLowerCase()

      // 1. Check duplicate
      const { data: existingRequest, error: checkError } = await supabase
        .from('permit_requests')
        .select('id, passport_series, jshshir, email')
        .or(`passport_series.eq.${cleanPassport},jshshir.eq.${cleanJshshir},email.eq.${cleanEmail}`)
        .maybeSingle()

      if (checkError) throw new Error(checkError.message)

      if (existingRequest) {
        if (existingRequest.passport_series === cleanPassport) {
          throw new Error("Ushbu Pasport seriyasi bilan yo'llanma yuborilgan!")
        }
        if (existingRequest.jshshir === cleanJshshir) {
          throw new Error("Ushbu JShSHIR bilan yo'llanma yuborilgan!")
        }
        if (existingRequest.email === cleanEmail) {
          throw new Error("Ushbu Email manzili bilan yo'llanma yuborilgan!")
        }
      }

      // 2. Upload file
      const fileExt = file.name.split('.').pop()
      const filePath = `permits/temp/${cleanPassport}_${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('avatar')
        .upload(filePath, file)

      if (uploadError) {
        throw new Error("Faylni yuklashda xatolik yuz berdi: " + uploadError.message)
      }

      const { data: { publicUrl } } = supabase.storage.from('avatar').getPublicUrl(filePath)

      // 3. Insert into permit_requests
      const { error: dbError } = await supabase
        .from('permit_requests')
        .insert({
          passport_series: cleanPassport,
          jshshir: cleanJshshir,
          full_name: fullName.trim(),
          email: cleanEmail,
          phone: phone.trim(),
          gender,
          faculty,
          direction: direction.trim(),
          course: Number(course),
          permit_url: publicUrl,
          status: 'pending'
        })

      if (dbError) throw new Error(dbError.message)

      if (typeof window !== 'undefined') {
        localStorage.setItem('student_permit_passport', cleanPassport)
        localStorage.setItem('student_permit_jshshir', cleanJshshir)
      }

      setSubmitted(true)
      playSound('success')
      showToast('success', "Yo'llanma ko'rib chiqish uchun yuborildi!")
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Xatolik yuz berdi')
      console.error(err)
    } finally {
      setLoading(false)
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
    <div className={`min-h-screen flex items-center justify-center p-3 sm:p-4 relative overflow-hidden ${isLight ? 'bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900' : 'bg-[#020617] text-white'}`}>
      
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
      `}} />

      {/* Floating 3D Orbs / Spheres */}
      <div className="absolute top-[-25%] left-[-25%] w-[65%] h-[65%] bg-blue-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-25%] right-[-25%] w-[65%] h-[65%] bg-purple-500/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-5xl my-1">
        
        {/* Navigation and Sound settings */}
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <Link 
            href="/"
            onClick={() => playSound('tab')}
            className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all duration-300 border ${
              isLight 
                ? 'bg-white/80 border-slate-200 text-slate-700 hover:bg-slate-100 shadow-xs' 
                : 'bg-[#0f172a]/80 border-white/5 text-slate-350 hover:bg-white/5 shadow-md shadow-black/30'
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
                  : 'bg-[#0f172a]/80 border-white/5 text-slate-350 hover:bg-white/5'
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
                
                {/* COLUMN 1: Interactive Floating 3D Student ID Card Preview - HIDDEN ON MOBILE */}
                <div className="hidden md:block md:col-span-5 [perspective:1200px] select-none w-full">
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
                          {fullName.trim() || "F.I.Sh (Ism Familiya)"}
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
                        <p className="text-[7px] sm:text-[8px] font-black text-slate-455 uppercase tracking-widest leading-none">Hujjatlar</p>
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
                        <span className="text-[7px] sm:text-[8px] font-black text-slate-455 uppercase tracking-widest leading-none">KURS</span>
                        <p className="text-[9px] sm:text-xs font-black uppercase text-indigo-400 leading-none">
                          {course}-kurs • {faculty.toUpperCase()}
                        </p>
                      </div>

                    </div>
                  </div>
                </div>

                {/* COLUMN 2: Form Wizard */}
                <div className="md:col-span-7 md:col-start-6 space-y-3.5 w-full">
                  
                  {/* 3D Premium Wizard Tabs */}
                  <div className="relative p-1 rounded-xl bg-slate-950/20 dark:bg-slate-950/60 border border-slate-200/10 dark:border-white/5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)] flex justify-between items-center gap-1 overflow-hidden">
                    {[
                      { step: 1, label: 'Shaxsiy' },
                      { step: 2, label: 'O‘qish' },
                      { step: 3, label: 'Hujjat' }
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
                          }}
                          className={`flex-1 py-1.5 sm:py-2 text-center rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider relative transition-all duration-300 z-10 ${
                            isActive
                              ? 'text-white font-bold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {/* Active Tab sliding backplate */}
                          {isActive && (
                            <motion.div
                              layoutId="activeWizardTab"
                              className="absolute inset-0 bg-gradient-to-r from-blue-600/35 to-indigo-650/35 dark:from-blue-500/25 dark:to-indigo-500/25 border border-indigo-500/30 rounded-lg shadow-[0_0_12px_rgba(99,102,241,0.2)] active-tab-3d"
                              transition={{ type: "spring", stiffness: 350, damping: 25 }}
                            />
                          )}
                          <span className="relative z-20">{s.step}. {s.label}</span>
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
                            <label className={`text-[10px] sm:text-xs font-black uppercase tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>F.I.Sh (Ism Familiya)</label>
                            {fullName.trim().length > 5 && (
                              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                            )}
                          </div>
                          <div className={`cyber-border ${focusedField === 'fullName' ? 'focused' : ''}`}>
                            <div className="cyber-input-inner relative">
                              <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${focusedField === 'fullName' ? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_#6366f1]' : 'text-slate-455'}`}>
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
                                onChange={(e) => handleInputChange(e, setFullName, 'fullName')}
                                placeholder="Ismoilov Jasur Baxtiyorovich"
                                className={`w-full bg-transparent py-2.5 sm:py-3 pr-4 pl-12 rounded-xl text-sm sm:text-base outline-none transition-colors duration-300 ${
                                  isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-500'
                                }`}
                                required
                              />
                            </div>
                          </div>
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
                                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${focusedField === 'email' ? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_#6366f1]' : 'text-slate-455'}`}>
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
                                  className={`w-full bg-transparent py-2.5 sm:py-3 pr-4 pl-12 rounded-xl text-sm sm:text-base outline-none transition-colors duration-300 ${
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
                              {phone.trim().length > 8 && (
                                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                              )}
                            </div>
                            <div className={`cyber-border ${focusedField === 'phone' ? 'focused' : ''}`}>
                              <div className="cyber-input-inner relative">
                                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${focusedField === 'phone' ? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_#6366f1]' : 'text-slate-455'}`}>
                                  <Phone size={16} />
                                </div>

                                {focusedField === 'phone' && (
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-indigo-500/10 blur-[6px] pointer-events-none" />
                                )}

                                <input
                                  type="tel"
                                  value={phone}
                                  onFocus={() => {
                                    setFocusedField('phone')
                                    playSound('focus')
                                  }}
                                  onBlur={() => setFocusedField(null)}
                                  onChange={(e) => handleInputChange(e, setPhone, 'phone')}
                                  placeholder="+998901234567"
                                  className={`w-full bg-transparent py-2.5 sm:py-3 pr-4 pl-12 rounded-xl text-sm sm:text-base outline-none transition-colors duration-300 ${
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
                                    ? 'bg-white border-slate-250 hover:bg-slate-50 text-slate-700' 
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
                                    ? 'bg-white border-slate-250 hover:bg-slate-50 text-slate-700' 
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
                                <select
                                  value={faculty}
                                  onFocus={() => {
                                    setFocusedField('faculty')
                                    playSound('focus')
                                  }}
                                  onBlur={() => setFocusedField(null)}
                                  onChange={(e) => handleInputChange(e, setFaculty, 'faculty')}
                                  className={`w-full bg-transparent p-2.5 sm:p-3 rounded-xl text-sm sm:text-base outline-none font-black uppercase tracking-wider transition-colors duration-300 ${
                                    isLight ? 'text-slate-900' : 'text-white'
                                  }`}
                                >
                                  <option value="amit" className="bg-[#0f172a] text-white">AMIT</option>
                                  <option value="tarix" className="bg-[#0f172a] text-white">Tarix</option>
                                  <option value="fizika" className="bg-[#0f172a] text-white">Fizika</option>
                                  <option value="kimyo" className="bg-[#0f172a] text-white">Kimyo</option>
                                  <option value="biologiya" className="bg-[#0f172a] text-white">Biologiya</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Direction */}
                          <div className="space-y-1 sm:col-span-2">
                            <div className="flex justify-between items-center ml-2">
                              <label className={`text-[10px] sm:text-xs font-black uppercase tracking-widest block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Yo&apos;nalish / Guruh</label>
                              {direction.trim().length > 3 && (
                                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                              )}
                            </div>
                            <div className={`cyber-border ${focusedField === 'direction' ? 'focused' : ''}`}>
                              <div className="cyber-input-inner relative">
                                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${focusedField === 'direction' ? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_#6366f1]' : 'text-slate-455'}`}>
                                  <GraduationCap size={16} />
                                </div>

                                {focusedField === 'direction' && (
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-indigo-500/10 blur-[6px] pointer-events-none" />
                                )}

                                <input
                                  type="text"
                                  value={direction}
                                  onFocus={() => {
                                    setFocusedField('direction')
                                    playSound('focus')
                                  }}
                                  onBlur={() => setFocusedField(null)}
                                  onChange={(e) => handleInputChange(e, setDirection, 'direction')}
                                  placeholder="Dasturiy muhandislik, 301-guruh"
                                  className={`w-full bg-transparent py-2.5 sm:py-3 pr-4 pl-12 rounded-xl text-sm sm:text-base outline-none transition-colors duration-300 ${
                                    isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-500'
                                  }`}
                                  required
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
                                    ? 'bg-indigo-600 border-indigo-650 text-white shadow-md shadow-indigo-600/20 ring-2 ring-indigo-500/15'
                                    : isLight 
                                      ? 'bg-white border-slate-250 text-slate-700 hover:bg-slate-100' 
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
                              {passportSeries.trim().length >= 7 && (
                                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                              )}
                            </div>
                            <div className={`cyber-border ${focusedField === 'passport' ? 'focused' : ''}`}>
                              <div className="cyber-input-inner relative">
                                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${focusedField === 'passport' ? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_#6366f1]' : 'text-slate-455'}`}>
                                  <CreditCard size={16} />
                                </div>

                                {focusedField === 'passport' && (
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-indigo-500/10 blur-[6px] pointer-events-none" />
                                )}

                                <input
                                  type="text"
                                  value={passportSeries}
                                  onFocus={() => {
                                    setFocusedField('passport')
                                    playSound('focus')
                                  }}
                                  onBlur={() => setFocusedField(null)}
                                  onChange={(e) => handleInputChange(e, setPassportSeries, 'passport')}
                                  placeholder="AA1234567"
                                  className={`w-full bg-transparent py-2.5 sm:py-3 pr-4 pl-12 rounded-xl text-sm sm:text-base outline-none transition-colors duration-300 ${
                                    isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-500'
                                  }`}
                                  required
                                />
                              </div>
                            </div>
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
                                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${focusedField === 'jshshir' ? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_#6366f1]' : 'text-slate-455'}`}>
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
                                  className={`w-full bg-transparent py-2.5 sm:py-3 pr-4 pl-12 rounded-xl text-sm sm:text-base outline-none transition-colors duration-300 ${
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
                                  ? 'border-slate-350 hover:bg-slate-50 shadow-inner' 
                                  : 'border-white/10 hover:bg-white/5'
                            }`}
                          >
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              onChange={handleFileChange}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              required
                            />
                            <div className="flex flex-col items-center justify-center gap-1">
                              <Upload className={`h-6 w-6 transition-all duration-300 ${file ? 'text-emerald-400 scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'text-slate-455'}`} />
                              <span className="text-xs font-black tracking-wide">
                                {file ? file.name : "Ruxsatnoma faylini tanlang"}
                              </span>
                              <span className="text-[10px] text-slate-455 font-sans">
                                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF, PNG, JPG (Maks. 5MB)"}
                              </span>
                            </div>
                          </motion.div>
                        </div>
                      </motion.div>
                    )}

                    {/* Form Action Navigation */}
                    <div className="flex gap-4 pt-1">
                      {formStep > 1 && (
                        <button
                          type="button"
                          onClick={handlePrevStep}
                          className={`flex-1 py-3 rounded-xl border font-black text-xs uppercase tracking-widest text-center flex items-center justify-center gap-1.5 transition-all duration-300 active:scale-95 ${
                            isLight 
                              ? 'border-slate-300 text-slate-700 hover:bg-slate-100 shadow-xs' 
                              : 'border-white/10 hover:bg-white/5 text-slate-300'
                          }`}
                        >
                          <ChevronLeft size={14} /> <span>Orqaga</span>
                        </button>
                      )}
                      
                      {formStep < 3 ? (
                        <button
                          type="button"
                          onClick={handleNextStep}
                          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-700 hover:to-indigo-750 text-white font-black uppercase tracking-widest text-xs flex items-center justify-center gap-1.5 transition-all duration-300 shadow-md shadow-indigo-600/15 active:scale-95"
                        >
                          <span>Keyingi</span> <ChevronRight size={14} />
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-650 to-indigo-650 hover:from-blue-700 hover:to-indigo-750 text-white font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-indigo-655/25 active:scale-95 disabled:opacity-50"
                        >
                          {loading ? (
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <span>Yo&apos;llanmani Yuborish</span>
                              <ChevronRight size={14} />
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
                      <span>Ariza statusini tekshirish</span>
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
                isLight ? 'bg-white/85 border-slate-250 shadow-slate-300/40' : 'bg-[#0b1120]/80 border-white/10 shadow-black/80'
              }`}
            >
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 animate-bounce">
                <CheckCircle2 size={32} />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-emerald-400">Muvaffaqiyatli yuborildi!</h2>
                <p className={`text-xs leading-relaxed font-sans ${isLight ? 'text-slate-655' : 'text-slate-400'}`}>
                  Sizning yotoqxona ruxsatnoma yo&apos;llanmangiz ko&apos;rib chiqish uchun qabul qilindi. Hujjat Zamdekan tomonidan tasdiqlanganidan so&apos;ng sizga xona biriktiriladi va tizimda to&apos;liq ro&apos;yxatdan o&apos;tishingiz mumkin bo&apos;ladi.
                </p>
              </div>

              <div className="bg-slate-950/40 rounded-2xl p-5 text-left border border-white/5 font-sans space-y-3 shadow-inner">
                <p className="text-[10px] text-slate-450 uppercase font-black tracking-widest">Ma&apos;lumotlaringiz</p>
                <div className="text-xs space-y-2 text-slate-300">
                  <p className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-455">Talaba:</span> 
                    <span className="font-bold text-white">{fullName}</span>
                  </p>
                  <p className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-455">Pasport:</span> 
                    <span className="font-mono font-bold text-white">{passportSeries.toUpperCase()}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-455">Fakultet:</span> 
                    <span className="font-bold text-indigo-400">{faculty.toUpperCase()}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => {
                    playSound('tab')
                    router.push(`/ruxsatnoma-tekshirish?passport=${passportSeries}&jshshir=${jshshir}`)
                  }}
                  className="flex-1 p-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest transition-all duration-300 active:scale-95 shadow-lg shadow-blue-500/20"
                >
                  Statusni Tekshirish
                </button>
                <button
                  onClick={() => {
                    playSound('tab')
                    router.push('/')
                  }}
                  className={`flex-1 p-4 rounded-xl border text-xs font-black uppercase tracking-widest transition-all duration-300 active:scale-95 ${
                    isLight 
                      ? 'border-slate-300 text-slate-700 hover:bg-slate-100 shadow-sm' 
                      : 'border-white/10 hover:bg-white/5 text-slate-350'
                  }`}
                >
                  Bosh sahifa
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
