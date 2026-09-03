'use client'

import { motion } from 'framer-motion'
import { ArrowRight, DoorOpen, GraduationCap, Globe2, Info } from 'lucide-react'
import type { RegisterData } from './types'
import { stepLabel, studyTypeLabel } from './constants'
import { directionLabel } from '@/lib/directions'
import { useThemeStore } from '@/lib/stores/theme-store'

interface Props {
  data: RegisterData
  onNext: () => void
  onBack: () => void
  applicationType?: 'yollanma' | 'imtiyozli'
  stepNumber?: number
  totalSteps?: number
}

function SummaryRow({ label, value, isLight }: { label: string; value: string; isLight: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
      <span className={`text-right text-[12px] font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{value || '—'}</span>
    </div>
  )
}

// Read-only. Xona dekan tomonidan biriktiriladi — talaba tanlamaydi.
// Fakultet / yo'nalish / kurs / ta'lim shakli ham arizadan keladi.
export default function Step8Room({
  data,
  onNext,
  onBack,
  applicationType = 'yollanma',
  stepNumber = 7,
  totalSteps = 8,
}: Props) {
  const isLight = useThemeStore((s) => s.theme) === 'light'
  const hasRoom = Boolean(data.room_number)

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 font-sans">
      {/* Header */}
      <div className={`flex items-center gap-3 rounded-2xl border p-2.5 ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.05]'}`}>
        <div className={`rounded-xl border p-2.5 ${isLight ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-linear-to-br from-amber-500/20 to-orange-500/20 border-amber-500/20 text-amber-400'}`}>
          <DoorOpen size={20} />
        </div>
        <div>
          <h2 className={`text-[14px] font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>Turar joy va ta&apos;lim</h2>
          <p className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-amber-600/80' : 'text-amber-400/80'}`}>
            {stepLabel(stepNumber, totalSteps)}
          </p>
        </div>
      </div>

      {/* Room card */}
      <div className={`rounded-[22px] border p-5 sm:p-6 ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#1e293b]/40 border-white/10'}`}>
        {hasRoom ? (
          <div className="text-center">
            <p className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>Sizga biriktirilgan xona</p>
            <p className={`mt-2 text-4xl font-black tracking-widest ${isLight ? 'text-slate-900' : 'text-white'}`}>{data.room_number}</p>
            <p className={`mt-3 text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Bu xona dekan tomonidan biriktirilgan.</p>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <Info size={16} className={`mt-0.5 shrink-0 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
            <p className={`text-[12px] leading-relaxed font-medium ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Xona hali biriktirilmagan. Dekan biriktirgach, u hisobingizga avtomatik qo&apos;shiladi va Telegram yoki emailingizga xabar beriladi.
            </p>
          </div>
        )}
      </div>

      {/* Study / origin summary (from the approved application) */}
      <div className={`rounded-2xl border px-4 py-3 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/8'}`}>
        <div className={`mb-1 flex items-center gap-2 text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          <GraduationCap size={12} /> Arizadagi ma&apos;lumotlar
        </div>
        <SummaryRow isLight={isLight} label="Fakultet" value={data.faculty} />
        <SummaryRow isLight={isLight} label="Yo'nalish" value={data.direction ? directionLabel(data.direction) : ''} />
        <SummaryRow isLight={isLight} label="Kurs" value={data.course ? `${data.course}-kurs` : ''} />
        <SummaryRow isLight={isLight} label="Ta'lim shakli" value={studyTypeLabel(data.study_type)} />
        {applicationType === 'imtiyozli' && (
          <>
            <div className={`my-1.5 flex items-center gap-2 text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              <Globe2 size={12} /> Kelib chiqish
            </div>
            <SummaryRow isLight={isLight} label="Davlat" value={data.originCountry} />
            <SummaryRow isLight={isLight} label="Hudud" value={data.originRegion} />
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-1">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className={`h-12 w-12 shrink-0 rounded-xl border ${isLight ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-white/[0.03] border-white/[0.08] text-slate-400'}`}
        >
          ←
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onNext}
          className={`relative h-12 flex-1 overflow-hidden rounded-xl ${isLight ? 'bg-linear-to-r from-sky-500 to-indigo-500' : 'bg-linear-to-r from-amber-600 to-orange-600'}`}
        >
          <div className={`flex h-full items-center justify-center gap-2 ${isLight ? 'rounded-xl bg-white/90' : ''}`}>
            <span className={`text-[11px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-900' : 'text-white'}`}>Davom etish</span>
            <ArrowRight className={isLight ? 'text-blue-600' : 'text-white'} size={16} />
          </div>
        </motion.button>
      </div>
    </motion.div>
  )
}
