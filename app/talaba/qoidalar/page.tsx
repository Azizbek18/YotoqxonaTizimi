'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ChevronDown,
  Home,
  Shield,
  Zap,
  Gavel,
  Info,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Award,
  Sparkles,
  BookOpen
} from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'
import PageSkeleton from '@/components/ui/PageSkeleton'
import { supabase } from '@/lib/supabase'
import { getSafeUser } from '@/lib/auth-session'
import toast, { Toaster } from 'react-hot-toast'

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface Profile {
  id: string
  full_name: string
  email: string
  phone_number?: string
  faculty?: string
  role?: string
  room_number?: string
  course?: string | number
  group?: string | number
  avatar_url?: string
  is_floor_captain?: boolean
  assigned_floor?: number
  gender?: string
  warning_count?: number
  blacklisted?: boolean
  direction?: string
}

interface QoidaItem {
  id: string
  sarlavha: string
  icon: React.ElementType
  soni: string
  colorKey: 'blue' | 'purple' | 'amber' | 'rose'
  bandlar: { id: string; text: string }[]
}

// ─── STATIC RULES DATA ───────────────────────────────────────────────────────
const qoidalarData: QoidaItem[] = [
  {
    id: "yashash",
    sarlavha: "Yashash tartibi",
    icon: Home,
    soni: "4 ta qoida",
    colorKey: "blue",
    bandlar: [
      { id: "yashash_1", text: "Kirish-chiqish vaqti: 06:00 dan 23:00 gacha." },
      { id: "yashash_2", text: "Xonalarni har kuni soat 09:00 gacha tozalash shart." },
      { id: "yashash_3", text: "Begona shaxslarni olib kirish taqiqlanadi." },
      { id: "yashash_4", text: "Haftalik umumiy tozalik ishlarida qatnashish majburiy." },
    ],
  },
  {
    id: "intizom",
    sarlavha: "Intizom & Xulq-atvor",
    icon: Shield,
    soni: "3 ta qoida",
    colorKey: "purple",
    bandlar: [
      { id: "intizom_1", text: "Sukunat vaqti: 22:00 dan 07:00 gacha." },
      { id: "intizom_2", text: "Alkogol va tamaki mahsulotlari qat'iyan man etiladi." },
      { id: "intizom_3", text: "Jamoat joylarida baland ovozda gaplashish taqiqlanadi." },
    ],
  },
  {
    id: "kommunal",
    sarlavha: "Kommunal xizmatlar",
    icon: Zap,
    soni: "3 ta qoida",
    colorKey: "amber",
    bandlar: [
      { id: "kommunal_1", text: "Elektr energiyasini tejash va chiroqni o'chirib yurish." },
      { id: "kommunal_2", text: "Suvdan oqilona foydalanish shart." },
      { id: "kommunal_3", text: "Nosozliklar haqida darhol ma'muriyatga xabar bering." },
    ],
  },
  {
    id: "jazo",
    sarlavha: "Jazo choralari",
    icon: Gavel,
    soni: "3 ta qoida",
    colorKey: "rose",
    bandlar: [
      { id: "jazo_1", text: "Birinchi qoidabuzarlik: rasmiy ogohlantirish taqdim etiladi." },
      { id: "jazo_2", text: "Ikkinchi qoidabuzarlik: reytingdan 30 ball chegiriladi." },
      { id: "jazo_3", text: "Takroriy holatda: yotoqxonadan qat'iy chetlatish chorasi qo'llaniladi." },
    ],
  },
]

// ─── 3D TILT CARD COMPONENT ──────────────────────────────────────────────────
interface TiltCardProps {
  children: React.ReactNode
  className?: string
}

function TiltCard({ children, className = '' }: TiltCardProps) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget
    const box = card.getBoundingClientRect()
    const x = e.clientX - box.left - box.width / 2
    const y = e.clientY - box.top - box.height / 2
    setTilt({
      x: (y / (box.height / 2)) * 6, // max 6 degrees tilt
      y: -(x / (box.width / 2)) * 6
    })
  }

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 })
  }

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transformStyle: 'preserve-3d',
      }}
      className={`transition-all duration-100 ease-out ${className}`}
    >
      <div style={{ transform: 'translateZ(15px)' }} className="h-full w-full">
        {children}
      </div>
    </motion.div>
  )
}

// ─── SVG CIRCULAR DISCIPLINE GAUGE ──────────────────────────────────────────
function DisciplineGauge({ score, isLight }: { score: number; isLight: boolean }) {
  const radius = 55
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  let strokeColor = 'stroke-emerald-500'
  let textColor = 'text-emerald-500'

  if (score < 40) {
    strokeColor = 'stroke-rose-500'
    textColor = 'text-rose-500'
  } else if (score < 80) {
    strokeColor = 'stroke-amber-500'
    textColor = 'text-amber-500'
  }

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      {/* Glowing background behind gauge */}
      <div className={`absolute w-28 h-28 rounded-full blur-xl opacity-30 ${
        score >= 80 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-rose-500'
      }`} />

      <svg className="w-full h-full transform -rotate-90 relative z-10">
        <circle
          cx="72"
          cy="72"
          r={radius}
          className={`${isLight ? 'stroke-slate-100' : 'stroke-white/5'} fill-none`}
          strokeWidth="10"
        />
        <motion.circle
          cx="72"
          cy="72"
          r={radius}
          className={`${strokeColor} fill-none`}
          strokeWidth="10"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center z-20">
        <motion.span
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
          className={`text-2xl font-black tracking-tight ${textColor}`}
        >
          {score}%
        </motion.span>
        <span className={`text-[8px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Salomatlik
        </span>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function QoidalarPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>("yashash")
  const [acknowledgedRules, setAcknowledgedRules] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        // 1. Fetch User Profile
        const user = await getSafeUser()
        if (user) {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()
          if (!error && data) {
            setProfile(data as Profile)
          }
        }

        // 2. Load acknowledged rules from localStorage
        const saved = localStorage.getItem('acknowledged_rules')
        if (saved) {
          try {
            setAcknowledgedRules(JSON.parse(saved))
          } catch (e) {
            console.error(e)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) return <PageSkeleton />

  const warningCount = profile?.warning_count || 0
  const isBlacklisted = profile?.blacklisted || false

  // Discipline rating calculation
  let disciplineScore = 100
  let statusText = "A'lo"
  let statusColor = "text-emerald-400"
  let statusDesc = "Sizda hech qanday qoidabuzarlik yo'q. Ajoyib ko'rsatkich!"

  if (isBlacklisted) {
    disciplineScore = 0
    statusText = "Qora Ro'yxat"
    statusColor = "text-rose-500 animate-pulse"
    statusDesc = "Tizim qoidalarini qo'pol ravishda buzganligingiz sababli qora ro'yxatdasiz!"
  } else if (warningCount === 1) {
    disciplineScore = 75
    statusText = "Yaxshi"
    statusColor = "text-emerald-500"
    statusDesc = "Ehtiyot bo'ling. 1 ta ogohlantirishingiz bor. Yana qoidabuzarlik reytingga ta'sir qiladi."
  } else if (warningCount === 2) {
    disciplineScore = 40
    statusText = "Qoniqarli"
    statusColor = "text-amber-500"
    statusDesc = "Muhim ogohlantirish! 2 ta faol ogohlantirish bor. Navbatdagi xato chetlatilishga sabab bo'ladi!"
  } else if (warningCount >= 3) {
    disciplineScore = 10
    statusText = "Kritik Xavf"
    statusColor = "text-rose-500 animate-pulse"
    statusDesc = "Chetlatilish yoqasida! Zudlik bilan ma'muriyat bilan bog'lanib masalani hal qiling."
  }

  const toggleRuleAcknowledge = (ruleId: string) => {
    const updated = {
      ...acknowledgedRules,
      [ruleId]: !acknowledgedRules[ruleId]
    }
    setAcknowledgedRules(updated)
    localStorage.setItem('acknowledged_rules', JSON.stringify(updated))

    if (updated[ruleId]) {
      toast.success("Qoida qabul qilindi!", {
        icon: '🛡️',
        duration: 1500,
        style: {
          borderRadius: '12px',
          background: isLight ? '#fff' : '#0f172a',
          color: isLight ? '#0f172a' : '#fff',
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)'
        }
      })
    }
  }

  const getColorClasses = (colorKey: string) => {
    switch (colorKey) {
      case 'blue':
        return isLight
          ? { text: 'text-blue-600', bg: 'bg-blue-50/50', border: 'border-blue-200/80', glow: 'from-blue-400/10 to-cyan-400/10', iconBg: 'bg-blue-100/80 text-blue-600' }
          : { text: 'text-cyan-400', bg: 'bg-cyan-500/[0.02]', border: 'border-cyan-500/20', glow: 'from-cyan-500/10 to-blue-500/10', iconBg: 'bg-cyan-500/20 text-cyan-400' }
      case 'purple':
        return isLight
          ? { text: 'text-purple-600', bg: 'bg-purple-50/50', border: 'border-purple-200/80', glow: 'from-purple-400/10 to-fuchsia-400/10', iconBg: 'bg-purple-100/80 text-purple-600' }
          : { text: 'text-purple-400', bg: 'bg-purple-500/[0.02]', border: 'border-purple-500/20', glow: 'from-purple-500/10 to-fuchsia-500/10', iconBg: 'bg-purple-500/20 text-purple-400' }
      case 'amber':
        return isLight
          ? { text: 'text-amber-600', bg: 'bg-amber-50/50', border: 'border-amber-200/80', glow: 'from-amber-400/10 to-orange-400/10', iconBg: 'bg-amber-100/80 text-amber-600' }
          : { text: 'text-amber-400', bg: 'bg-amber-500/[0.02]', border: 'border-amber-500/20', glow: 'from-amber-500/10 to-orange-500/10', iconBg: 'bg-amber-500/20 text-amber-400' }
      case 'rose':
        return isLight
          ? { text: 'text-rose-600', bg: 'bg-rose-50/50', border: 'border-rose-200/80', glow: 'from-rose-400/10 to-red-400/10', iconBg: 'bg-rose-100/80 text-rose-600' }
          : { text: 'text-rose-400', bg: 'bg-rose-500/[0.02]', border: 'border-rose-500/20', glow: 'from-rose-500/10 to-red-500/10', iconBg: 'bg-rose-500/20 text-rose-400' }
      default:
        return isLight
          ? { text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', glow: 'from-slate-400/10 to-slate-300/10', iconBg: 'bg-slate-100 text-slate-600' }
          : { text: 'text-slate-400', bg: 'bg-slate-500/[0.02]', border: 'border-slate-500/20', glow: 'from-slate-500/10 to-slate-400/10', iconBg: 'bg-slate-500/20 text-slate-400' }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative min-h-[85vh] w-full pb-24 font-sans"
    >

      {/* 3D Background Glow Containers */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className={`absolute top-[10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[140px] opacity-40 ${isLight ? 'bg-blue-300/30' : 'bg-cyan-500/5'}`} />
        <div className={`absolute bottom-[10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[140px] opacity-40 ${isLight ? 'bg-purple-300/30' : 'bg-purple-500/5'}`} />
      </div>

      <div className="max-w-5xl mx-auto space-y-10">
        
        {/* Premium Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="flex items-center gap-2 mb-2.5">
              <div className={`flex items-center justify-center p-1.5 rounded-lg border ${
                isLight ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-blue-500/10 border-blue-500/20 text-cyan-400'
              }`}>
                <ShieldAlert size={16} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>
                Intizom Tizimi
              </span>
            </div>
            <h1 className={`text-3xl sm:text-5xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Yotoqxona <span className="bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 bg-clip-text text-transparent">Tartib Qoidalari</span>
            </h1>
            <p className={`mt-3 text-xs sm:text-sm max-w-xl font-medium leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              {"Bino tinchligi, osoyishtaligi va xavfsizligini ta'minlash maqsadida barcha talabalar belgilangan tartibga rioya qilishlari talab etiladi."}
            </p>
          </motion.div>
        </div>

        {/* 3D Dynamic Info Panels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* LEFT: 3D Gauge Card */}
          <div className="md:col-span-1">
            <TiltCard className="h-full">
              <div className={`h-full relative overflow-hidden p-6 rounded-[28px] border backdrop-blur-2xl transition-all duration-300 flex flex-col items-center text-center justify-between ${
                isLight
                  ? 'bg-white/80 border-slate-200 shadow-[0_15px_30px_-10px_rgba(0,0,0,0.06)]'
                  : 'bg-slate-900/40 border-white/10 shadow-[0_15px_30px_-10px_rgba(0,0,0,0.4)]'
              }`}>
                <div className="w-full flex items-center justify-between border-b pb-4 mb-4 border-dashed border-slate-200/50 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <Award size={16} className={isLight ? 'text-blue-600' : 'text-cyan-400'} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Intizom Reytingi</span>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                    isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-slate-300'
                  }`}>
                    {statusText}
                  </span>
                </div>

                <DisciplineGauge score={disciplineScore} isLight={isLight} />

                <div className="mt-4 space-y-2.5">
                  <h3 className={`text-sm font-black tracking-tight ${statusColor}`}>
                    Disiplina Holati: {statusText}
                  </h3>
                  <p className={`text-[11px] leading-relaxed font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    {statusDesc}
                  </p>
                </div>
              </div>
            </TiltCard>
          </div>

          {/* RIGHT: Warning Details & Notice (2-columns wide) */}
          <div className="md:col-span-2 grid grid-cols-1 gap-6">
            
            {/* Warning details and rules summary */}
            <TiltCard>
              <div className={`h-full relative overflow-hidden p-6 rounded-[28px] border backdrop-blur-2xl transition-all duration-300 flex flex-col justify-between ${
                isLight
                  ? 'bg-gradient-to-br from-rose-50/50 to-orange-50/30 border-rose-200/80 shadow-[0_15px_30px_-10px_rgba(225,29,72,0.08)]'
                  : 'bg-gradient-to-br from-rose-500/[0.04] to-orange-500/[0.02] border-rose-500/20 shadow-[0_15px_30px_-10px_rgba(225,29,72,0.15)]'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-2xl shrink-0 border ${
                    isLight ? 'bg-rose-100/80 border-rose-200 text-rose-600 shadow-inner' : 'bg-rose-500/15 border-rose-500/20 text-rose-400'
                  }`}>
                    <AlertTriangle size={24} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className={`text-base font-black tracking-tight mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      Qoidabuzarlik va Ogohlantirishlar
                    </h3>
                    <p className={`text-xs leading-relaxed font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      {"Sizda joriy o'quv yilida "}
                      <span className={`font-black ${warningCount > 0 ? 'text-rose-500' : ''}`}>{warningCount} {" ta faol ogohlantirish "}</span>
                      {"aniqlangan. 3 tadan ko'p ogohlantirish olish yotoqxonadan chiqarilishga to'g'ridan-to'g'ri sabab bo'ladi."}
                    </p>
                  </div>
                </div>

                <div className={`mt-5 p-4 rounded-2xl border ${
                  isLight ? 'bg-white/90 border-rose-100 text-slate-700' : 'bg-slate-950/40 border-rose-500/10 text-slate-300'
                } text-xs font-semibold leading-relaxed space-y-2`}>
                  <div className="flex items-center gap-1.5 font-bold text-rose-500">
                    <Info size={13} />
                    <span>Intizom eslatmasi:</span>
                  </div>
                  <p>
                    {"Qoidalarni buzish nafaqat yotoqxona, balki universitet ichki tartib reytingingizga va stipendiya olish imkoniyatiga salbiy ta'sir ko'rsatadi."}
                  </p>
                </div>
              </div>
            </TiltCard>

            {/* Quick action info helper */}
            <TiltCard>
              <div className={`h-full relative overflow-hidden p-6 rounded-[28px] border backdrop-blur-2xl transition-all duration-300 flex flex-col justify-between ${
                isLight
                  ? 'bg-white/80 border-slate-200 shadow-[0_15px_30px_-10px_rgba(0,0,0,0.06)]'
                  : 'bg-slate-900/40 border-white/10 shadow-[0_15px_30px_-10px_rgba(0,0,0,0.4)]'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-2xl shrink-0 border ${
                    isLight ? 'bg-blue-100/80 border-blue-200 text-blue-600 shadow-inner' : 'bg-blue-500/15 border-blue-500/20 text-cyan-400'
                  }`}>
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h3 className={`text-base font-black tracking-tight mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {"Qoidalarni o'qib tasdiqlash"}
                    </h3>
                    <p className={`text-xs leading-relaxed font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      {"Har bir qoida bandining yonidagi tasdiqlash tugmasini bosib, qoidalarni o'qib chiqqaningiz va qabul qilganingizni tasdiqlang. Bu sizning tizimdagi faolligingizni ko'rsatadi!"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-dashed border-slate-200 dark:border-white/5 pt-3">
                  <span className="text-[10px] font-black uppercase tracking-wider opacity-60">
                    Siz tomondan qabul qilingan qoidalar:
                  </span>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                    isLight ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/20 text-cyan-400'
                  }`}>
                    {Object.values(acknowledgedRules).filter(Boolean).length} / 13
                  </span>
                </div>
              </div>
            </TiltCard>
          </div>
        </div>

        {/* Rules Categories Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-dashed border-slate-200 dark:border-white/5 pb-3">
            <BookOpen size={18} className={isLight ? 'text-blue-600' : 'text-cyan-400'} />
            <h2 className="text-lg font-black tracking-tight uppercase">Qoida toifalari</h2>
          </div>

          <div className="space-y-4">
            {qoidalarData.map((item, index) => {
              const isOpen = openId === item.id
              const colors = getColorClasses(item.colorKey)
              const Icon = item.icon

              return (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 * index }}
                  key={item.id}
                >
                  <div
                    className={`group relative rounded-[24px] border backdrop-blur-2xl transition-all duration-500 overflow-hidden ${
                      isOpen
                        ? `${colors.bg} ${colors.border} shadow-[0_20px_40px_-10px_rgba(0,0,0,0.06)]`
                        : isLight
                          ? 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
                          : 'bg-[#0f172a]/40 border-white/5 hover:border-white/10 hover:bg-[#0f172a]/60'
                    }`}
                  >
                    {/* Glow Background */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className={`absolute inset-0 bg-gradient-to-br ${colors.glow} opacity-50 -z-10`}
                        />
                      )}
                    </AnimatePresence>

                    {/* Accordion Header */}
                    <div
                      onClick={() => setOpenId(isOpen ? null : item.id)}
                      className="p-5 sm:p-6 flex items-center justify-between cursor-pointer z-10 relative"
                    >
                      <div className="flex items-center gap-4 sm:gap-5">
                        <div className="relative">
                          <div className={`absolute inset-0 blur-md opacity-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'} ${colors.bg}`} />
                          <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-500 border border-transparent ${colors.iconBg} ${isOpen ? 'scale-110 border-current/10' : 'group-hover:scale-105'}`}>
                            <Icon size={22} strokeWidth={2.5} />
                          </div>
                        </div>

                        <div>
                          <h3 className={`text-base sm:text-lg font-black tracking-tight mb-1 transition-colors ${isOpen ? (isLight ? 'text-slate-900' : 'text-white') : (isLight ? 'text-slate-800' : 'text-slate-200')}`}>
                            {item.sarlavha}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors border ${
                            isOpen
                              ? isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-black/20 border-white/10 ' + colors.text
                              : isLight ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-white/5 border-white/10 text-slate-400'
                          }`}>
                            {item.soni}
                          </span>
                        </div>
                      </div>

                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isOpen
                          ? `${colors.iconBg}`
                          : isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500'
                      }`}>
                        <ChevronDown
                          className={`transition-transform duration-500 ease-[cubic-bezier(0.87,0,0.13,1)] ${isOpen ? 'rotate-180' : ''}`}
                          size={16}
                        />
                      </div>
                    </div>

                    {/* Accordion Body */}
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: [0.04, 0.62, 0.23, 0.98] }}
                        >
                          <div className={`px-5 pb-6 sm:px-6 pt-2 border-t ${isLight ? 'border-slate-200/50' : 'border-white/5'}`}>
                            <div className="pl-0 sm:pl-[68px]">
                              <ul className="space-y-3.5">
                                {item.bandlar.map((band, idx) => {
                                  const isAcknowledged = acknowledgedRules[band.id]
                                  return (
                                    <motion.li
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ duration: 0.25, delay: idx * 0.08 }}
                                      key={band.id}
                                      onClick={() => toggleRuleAcknowledge(band.id)}
                                      className={`flex items-start gap-3.5 group/item cursor-pointer p-2.5 rounded-xl border transition-all ${
                                        isAcknowledged
                                          ? isLight
                                            ? 'bg-emerald-50/40 border-emerald-200/60 shadow-xs'
                                            : 'bg-emerald-500/[0.04] border-emerald-500/20'
                                          : 'bg-transparent border-transparent hover:bg-slate-100/30 dark:hover:bg-white/[0.02]'
                                      }`}
                                    >
                                      <div className={`mt-0.5 p-1 rounded-full shrink-0 border transition-all ${
                                        isAcknowledged
                                          ? 'bg-emerald-500 border-transparent text-white scale-110'
                                          : isLight
                                            ? 'bg-slate-50 border-slate-300 text-slate-400 group-hover/item:border-slate-400 group-hover/item:bg-slate-100'
                                            : 'bg-white/5 border-white/10 text-slate-500 group-hover/item:border-white/20 group-hover/item:bg-white/10'
                                      }`}>
                                        {isAcknowledged ? (
                                          <ShieldCheck size={12} strokeWidth={3} />
                                        ) : (
                                          <CheckCircle2 size={12} />
                                        )}
                                      </div>
                                      <span className={`text-xs sm:text-sm font-semibold leading-relaxed transition-colors ${
                                        isAcknowledged
                                          ? isLight ? 'text-slate-800 font-bold' : 'text-emerald-400 font-bold'
                                          : isLight ? 'text-slate-700' : 'text-slate-300'
                                      }`}>
                                        {band.text}
                                      </span>
                                    </motion.li>
                                  )
                                })}
                              </ul>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Last updated footer */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="flex items-center justify-center pt-4"
        >
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-xs font-semibold shadow-xs ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[#0f172a]/50 border-white/5 text-slate-400'
          }`}>
            <Info size={14} className={isLight ? 'text-blue-500' : 'text-cyan-400'} />
            <span>Qoidalar oxirgi marta 2026-yil 1-yanvarda tasdiqlangan</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}