'use client'

import { motion } from 'framer-motion'
import { Mars, Venus, Check, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { stepLabel } from '@/components/register/constants'
import type { KvRegisterData } from './types'

interface Props {
  data: KvRegisterData
  onChange: (d: Partial<KvRegisterData>) => void
  onNext: () => void
  onBack: () => void
  stepNumber: number
  totalSteps: number
}

const OPTIONS = [
  { id: 'male' as const, label: "O'g'il", icon: Mars, color: 'from-blue-500 to-sky-400' },
  { id: 'female' as const, label: 'Qiz', icon: Venus, color: 'from-rose-500 to-pink-400' },
]

export default function Step3Gender({ data, onChange, onNext, onBack, stepNumber, totalSteps }: Props) {
  const isLight = useThemeStore((s) => s.theme) === 'light'

  const validate = () => {
    if (!data.gender) {
      toast.error('Jinsingizni tanlang')
      return
    }
    onNext()
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 px-1">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-400">
          <Sparkles size={14} />
        </div>
        <h2 className={`text-[13px] font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Jinsingiz</h2>
        <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-emerald-500/70">{stepLabel(stepNumber, totalSteps)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((opt) => {
          const isActive = data.gender === opt.id
          const Icon = opt.icon
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange({ gender: opt.id })}
              className={`relative overflow-hidden p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
                isActive
                  ? (isLight ? 'bg-white border-emerald-300 shadow-lg' : 'bg-white/8 border-emerald-400/30 shadow-xl')
                  : (isLight ? 'bg-white/60 border-slate-200 opacity-60' : 'bg-white/2 border-white/5 opacity-50')
              }`}
            >
              {isActive && (
                <div className="absolute top-2 right-2 z-10">
                  <Check className="text-emerald-500 w-3.5 h-3.5" strokeWidth={3} />
                </div>
              )}
              <div className={`p-2.5 rounded-xl bg-linear-to-br ${isActive ? opt.color : isLight ? 'from-slate-200 to-slate-100' : 'from-slate-700 to-slate-800'}`}>
                <Icon className={`${isActive ? (isLight ? 'text-slate-900' : 'text-white') : 'text-slate-400'} w-5 h-5`} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? (isLight ? 'text-slate-900' : 'text-white') : 'text-slate-500'}`}>
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-all ${isLight ? 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900' : 'bg-white/3 border-white/8 text-slate-400 hover:bg-white/10'}`}
        >
          <ArrowLeft size={17} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={validate}
          className="flex-1 relative overflow-hidden group p-px rounded-xl bg-linear-to-r from-emerald-600 to-teal-700"
        >
          <div className={`relative py-3 rounded-[11px] flex items-center justify-center gap-2 ${isLight ? 'bg-white/90' : 'bg-transparent'}`}>
            <span className={`font-bold text-[12px] tracking-widest uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>Davom etish</span>
            <ArrowRight className={`${isLight ? 'text-emerald-600' : 'text-white'} translate-x-1 transition-transform`} size={16} />
          </div>
        </motion.button>
      </div>
    </motion.div>
  )
}
