'use client'

import React, { useState } from 'react'
import { RegisterData } from './types'
import { motion, AnimatePresence } from 'framer-motion'
import { Mars, Venus, Sparkles, ShieldAlert, ArrowRight, Globe2, ChevronDown, Check, BadgeCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { stepLabel } from './constants'

interface Props {
  data: RegisterData
  onChange: (d: Partial<RegisterData>) => void
  onNext: () => void
  onBack: () => void
  stepNumber?: number
  totalSteps?: number
}

const NATIONALITIES = [
  { value: "O'zbek", label: "O'zbek" },
  { value: 'Tojik', label: 'Tojik' },
  { value: 'Qozoq', label: 'Qozoq' },
  { value: "Qirg'iz", label: "Qirg'iz" },
  { value: 'Turkman', label: 'Turkman' },
  { value: 'Rus', label: 'Rus' },
  { value: 'Qoraqalpoq', label: 'Qoraqalpoq' },
  { value: 'Boshqa', label: 'Boshqa' },
]

export default function Step3Gender({ data, onChange, onNext, onBack, stepNumber = 3, totalSteps = 8 }: Props) {
  const [isNationOpen, setIsNationOpen] = useState(false)
  const isLight = useThemeStore((state) => state.theme) === 'light'

  React.useEffect(() => {
    if (!data.nationality) onChange({ nationality: "O'zbek" })
  }, [data.nationality, onChange])

  const show3DToast = (message: string) => {
    toast.custom((t) => (
      <AnimatePresence>
        {t.visible && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
            className="relative group cursor-pointer z-9999 w-[92vw] max-w-100 mx-auto"
          >
            <div className="absolute -inset-1 rounded-2xl blur-md opacity-30 bg-rose-500" />
            <div className={`relative backdrop-blur-2xl border p-4 rounded-2xl shadow-2xl flex items-center gap-3 ${isLight ? 'bg-white/95 border-slate-200' : 'bg-[#1e293b]/95 border-white/10'}`}>
              <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border bg-rose-500/20 text-rose-400 border-rose-500/30">
                <ShieldAlert size={20} />
              </div>
              <p className={`text-[12px] font-medium leading-tight ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    ), { duration: 3000, position: 'top-center' })
  }

  const handleNext = () => {
    if (!data.nationality) return show3DToast('Iltimos, millatingizni tanlang')
    onNext()
  }

  const genderOptions = [
    { id: 'male', label: 'Erkak', icon: Mars, color: 'from-blue-500 to-sky-400' },
    { id: 'female', label: 'Ayol', icon: Venus, color: 'from-rose-500 to-pink-400' },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 px-1">
      {/* Header */}
      <div className={`flex items-center gap-3 p-2.5 rounded-2xl border ${isLight ? 'bg-white/90 border-slate-200' : 'bg-white/3 border-white/5'}`}>
        <div className={`p-2 rounded-xl border ${isLight ? 'bg-linear-to-br from-sky-500/15 to-indigo-500/15 border-sky-500/15' : 'bg-linear-to-br from-purple-500/20 to-blue-500/20 border-purple-500/20'}`}>
          <Sparkles className="text-purple-400" size={18} />
        </div>
        <div>
          <h2 className={`${isLight ? 'text-slate-900' : 'text-white'} text-[14px] font-bold`}>Shaxsiy ma&apos;lumotlar</h2>
          <p className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-sky-600/80' : 'text-purple-400/80'}`}>{stepLabel(stepNumber, totalSteps)}</p>
        </div>
      </div>

      {/* Jins — read-only (arizadan) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 ml-1 text-[9px] font-black uppercase tracking-wider text-emerald-500">
          <BadgeCheck size={12} /> Jins (arizadan)
        </div>
        <div className="grid grid-cols-2 gap-4">
          {genderOptions.map((opt) => {
            const isActive = data.gender === opt.id
            const Icon = opt.icon
            return (
              <div
                key={opt.id}
                className={`relative overflow-hidden p-5 rounded-3xl border flex flex-col items-center justify-center gap-3 transition-all ${
                  isActive
                    ? (isLight ? 'bg-white border-slate-200 shadow-lg' : 'bg-white/8 border-white/20 shadow-xl')
                    : (isLight ? 'bg-white/60 border-slate-200 opacity-40' : 'bg-white/2 border-white/5 opacity-30 grayscale')
                }`}
              >
                {isActive && (
                  <div className="absolute top-3 right-3 z-10">
                    <Check className="text-emerald-500 w-4 h-4" strokeWidth={3} />
                  </div>
                )}
                <div className={`p-3.5 rounded-2xl bg-linear-to-br ${isActive ? opt.color : isLight ? 'from-slate-200 to-slate-100' : 'from-slate-700 to-slate-800'}`}>
                  <Icon className={`${isActive ? (isLight ? 'text-slate-900' : 'text-white') : 'text-slate-400'} w-7 h-7`} />
                </div>
                <span className={`text-[11px] font-black uppercase tracking-widest ${isActive ? (isLight ? 'text-slate-900' : 'text-white') : 'text-slate-500'}`}>
                  {opt.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Millat */}
      <div className="relative">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1 mb-2 block">Millati</label>
        <button
          onClick={() => setIsNationOpen(!isNationOpen)}
          className={`w-full backdrop-blur-xl p-3.5 rounded-2xl flex items-center justify-between transition-all duration-500 ${
            isLight ? 'bg-white/90 border border-slate-200 text-slate-900' : 'bg-white/1 border border-white/8 text-white'
          } ${isNationOpen ? (isLight ? 'border-sky-500/40 ring-4 ring-sky-500/10' : 'border-purple-500/40 ring-4 ring-purple-500/5') : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${isNationOpen ? (isLight ? 'bg-sky-500/10 text-sky-600' : 'bg-purple-500/20 text-purple-400') : (isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-500')}`}>
              <Globe2 size={16} />
            </div>
            <span className="text-[14px] font-semibold">{data.nationality || 'Tanlang'}</span>
          </div>
          <ChevronDown size={14} className={`transition-transform duration-500 text-slate-500 ${isNationOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isNationOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-20" onClick={() => setIsNationOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 4, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className={`absolute z-30 w-full mt-2 backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden ${isLight ? 'bg-white/95 border border-slate-200' : 'bg-[#0f172a]/95 border border-white/8'}`}
              >
                <div className="max-h-50 overflow-y-auto p-1.5 custom-scrollbar">
                  {NATIONALITIES.map((nat) => {
                    const isSel = data.nationality === nat.value
                    return (
                      <button
                        key={nat.value}
                        onClick={() => { onChange({ nationality: nat.value }); setIsNationOpen(false) }}
                        className={`no-shelf w-full flex items-center justify-between p-3 rounded-xl text-[13px] transition-all duration-300 mb-0.5 ${
                          isSel ? (isLight ? 'bg-sky-500 text-white' : 'bg-purple-600 text-white') : (isLight ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200')
                        }`}
                      >
                        <span className={isSel ? 'font-bold' : ''}>{nat.label}</span>
                        {isSel && <Check size={14} strokeWidth={3} />}
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Navigatsiya */}
      <div className="flex items-center gap-3 pt-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className={`h-12 w-12 flex items-center justify-center rounded-xl border transition-all ${isLight ? 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900' : 'bg-white/3 border-white/8 text-slate-400 hover:bg-white/10'}`}
        >
          ←
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleNext}
          className={`flex-1 relative overflow-hidden group p-px rounded-xl ${isLight ? 'bg-linear-to-r from-sky-500 to-indigo-500' : 'bg-linear-to-r from-purple-600 to-blue-600'}`}
        >
          <div className={`relative py-3.5 rounded-[11px] flex items-center justify-center gap-2 ${isLight ? 'bg-white/90' : 'bg-transparent'}`}>
            <span className={`font-bold text-[12px] tracking-widest uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>Davom etish</span>
            <ArrowRight className={`${isLight ? 'text-blue-600' : 'text-white'} translate-x-1 transition-transform`} size={16} />
          </div>
        </motion.button>
      </div>
    </motion.div>
  )
}
