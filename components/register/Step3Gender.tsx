'use client'

import React, { useState } from 'react'
import { RegisterData } from './types'
import { motion, AnimatePresence } from 'framer-motion'
import { Mars, Venus, Sparkles, CheckCircle2, ShieldAlert, ArrowRight, Globe2, ChevronDown, Check } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  data: RegisterData
  onChange: (d: Partial<RegisterData>) => void
  onNext: () => void
  onBack: () => void
}

const NATIONALITIES = [
  { value: "O'zbek", label: "O'zbek" },
  { value: 'Tojik', label: 'Tojik' },
  { value: 'Qozoq', label: 'Qozoq' },
  { value: 'Qirg\'iz', label: 'Qirg\'iz' },
  { value: 'Turkman', label: 'Turkman' },
  { value: 'Rus', label: 'Rus' },
  { value: 'Qoraqalpoq', label: 'Qoraqalpoq' },
  { value: 'Boshqa', label: 'Boshqa' },
]

export default function Step3Gender({ data, onChange, onNext, onBack }: Props) {
  const [isNationOpen, setIsNationOpen] = useState(false)

  // Default qiymatni tekshirish (agar tanlanmagan bo'lsa O'zbek qo'yish)
  React.useEffect(() => {
    if (!data.nationality) {
      onChange({ nationality: "O'zbek" })
    }
  }, [])

  const show3DToast = (message: string, type: 'success' | 'error' = 'error') => {
    toast.custom((t) => (
      <AnimatePresence>
        {t.visible && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, rotateX: -15 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
            className="relative group cursor-pointer z-[9999] w-[92vw] max-w-[400px] mx-auto"
          >
            <div className={`absolute -inset-1 rounded-2xl blur-md opacity-30 transition duration-1000 ${
              type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
            }`} />
            
            <div className="relative bg-[#1e293b]/95 backdrop-blur-2xl border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center gap-3">
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${
                type === 'success' 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              }`}>
                {type === 'success' ? <Sparkles size={20} /> : <ShieldAlert size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[9px] font-black uppercase tracking-[0.15em] mb-0.5 ${
                  type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {type === 'success' ? 'Muvaffaqiyatli' : 'Xatolik aniqlandi'}
                </p>
                <p className="text-slate-200 text-[12px] font-medium leading-tight">
                  {message}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    ), { duration: 3000, position: 'top-center' });
  }

  const handleNext = () => {
    if (!data.gender) return show3DToast("Iltimos, jinsingizni belgilang", 'error');
    if (!data.nationality) return show3DToast("Iltimos, millatingizni tanlang", 'error');
    onNext();
  }

  const options = [
    { id: 'Erkak', label: 'Erkak', icon: Mars, color: 'from-blue-500 to-sky-400', shadow: 'shadow-blue-500/20' },
    { id: 'Ayol', label: 'Ayol', icon: Venus, color: 'from-rose-500 to-pink-400', shadow: 'shadow-rose-500/20' }
  ]

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 px-1"
    >
      {/* Sarlavha */}
      <div className="flex items-center gap-3 bg-white/[0.03] p-2.5 rounded-2xl border border-white/[0.05]">
        <div className="p-2 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl border border-purple-500/20">
          <Sparkles className="text-purple-400" size={18} />
        </div>
        <div>
          <h2 className="text-[14px] font-bold text-white">Shaxsiy ma'lumotlar</h2>
          <p className="text-[9px] text-purple-400/80 font-black uppercase tracking-wider">Qadam 03 / 07</p>
        </div>
      </div>

      {/* Jins tanlash */}
      <div className="grid grid-cols-2 gap-4">
        {options.map((opt) => {
          const isActive = data.gender === opt.id
          const Icon = opt.icon

          return (
            <motion.div
              key={opt.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onChange({ gender: opt.id as 'male' | 'female' })}
              className={`
                relative cursor-pointer overflow-hidden p-6 rounded-[24px] border transition-all duration-500
                flex flex-col items-center justify-center gap-4
                ${isActive 
                  ? `bg-white/[0.08] border-white/20 shadow-2xl ${opt.shadow}` 
                  : 'bg-white/[0.02] border-white/5 opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0'
                }
              `}
            >
              {isActive && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-3 right-3 z-10">
                  <CheckCircle2 className="text-white w-5 h-5 fill-white/20" />
                </motion.div>
              )}
              <div className={`p-4 rounded-2xl bg-gradient-to-br ${isActive ? opt.color : 'from-slate-700 to-slate-800'} transition-all duration-500 relative z-10`}>
                <Icon className={`${isActive ? 'text-white' : 'text-slate-400'} w-8 h-8`} />
              </div>
              <span className={`relative z-10 text-[11px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-slate-500'}`}>
                {opt.label}
              </span>
            </motion.div>
          )
        })}
      </div>

      {/* Millatni tanlash (3D Select Style) */}
      <div className="relative">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1 mb-2 block">
          Millati
        </label>
        <button
          onClick={() => setIsNationOpen(!isNationOpen)}
          className={`
            w-full bg-white/[0.01] border border-white/[0.08] backdrop-blur-xl 
            p-3.5 rounded-2xl flex items-center justify-between text-white transition-all duration-500
            ${isNationOpen ? 'border-purple-500/40 bg-white/[0.04] ring-[6px] ring-purple-500/5' : 'hover:border-white/20'}
          `}
        >
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg transition-colors ${isNationOpen ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-slate-500'}`}>
              <Globe2 size={16} />
            </div>
            <span className="text-[14px] font-semibold">
              {data.nationality || "Tanlang"}
            </span>
          </div>
          <ChevronDown size={14} className={`text-slate-500 transition-transform duration-500 ${isNationOpen ? 'rotate-180 text-purple-400' : ''}`} />
        </button>

        <AnimatePresence>
          {isNationOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-20" onClick={() => setIsNationOpen(false)} 
              />
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 4, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute z-30 w-full mt-2 bg-[#0f172a]/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="max-h-[200px] overflow-y-auto p-1.5 custom-scrollbar">
                  {NATIONALITIES.map((nat) => {
                    const isSel = data.nationality === nat.value
                    return (
                      <button
                        key={nat.value}
                        onClick={() => { onChange({ nationality: nat.value }); setIsNationOpen(false) }}
                        className={`
                          w-full flex items-center justify-between p-3 rounded-xl text-[13px] transition-all duration-300 mb-0.5
                          ${isSel ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}
                        `}
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
          className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.08] text-slate-400 hover:bg-white/10 transition-all"
        >
          ←
        </motion.button>

        <motion.button
          whileHover={data.gender ? { translateY: -2 } : {}}
          whileTap={{ scale: 0.98 }}
          onClick={handleNext}
          className="flex-1 relative overflow-hidden group p-[1px] rounded-xl bg-gradient-to-r from-purple-600 to-blue-600"
        >
          <div className={`relative py-3.5 rounded-[11px] flex items-center justify-center gap-2 transition-all duration-300 ${data.gender ? 'bg-transparent' : 'bg-[#0f172a]/80 backdrop-blur-sm'}`}>
            <span className={`font-bold text-[12px] tracking-widest uppercase ${data.gender ? 'text-white' : 'text-slate-500'}`}>
              Davom etish
            </span>
            <ArrowRight className={`${data.gender ? 'text-white translate-x-1' : 'text-slate-500'} transition-transform`} size={16} />
          </div>
        </motion.button>
      </div>
    </motion.div>
  )
}