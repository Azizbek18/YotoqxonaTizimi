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
      {/* Step Header */}
      <div className="flex items-center gap-2.5 pb-1">
        <div className="rounded-xl bg-blue-500/15 p-2 text-blue-600 dark:text-blue-400">
          <Sparkles size={17} />
        </div>
        <div>
          <h2 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Jinsingizni tanlang
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Yotoqxona va hisob mezonlari uchun</p>
        </div>
        <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-200/60 dark:border-blue-500/20">
          {stepLabel(stepNumber, totalSteps)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {OPTIONS.map((opt) => {
          const isActive = data.gender === opt.id
          const Icon = opt.icon
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange({ gender: opt.id })}
              className={`relative overflow-hidden p-4 rounded-2xl border flex flex-col items-center justify-center gap-2.5 transition-all ${
                isActive
                  ? (isLight
                      ? 'bg-blue-50/70 border-blue-400 shadow-md ring-2 ring-blue-100'
                      : 'bg-blue-950/40 border-blue-500 shadow-xl ring-2 ring-blue-500/20')
                  : (isLight
                      ? 'bg-white border-slate-200 hover:border-slate-300'
                      : 'bg-white/[0.02] border-white/8 hover:border-white/15 opacity-70')
              }`}
            >
              {isActive && (
                <div className="absolute top-2.5 right-2.5 z-10">
                  <Check className="text-blue-600 dark:text-blue-400 w-4 h-4" strokeWidth={3} />
                </div>
              )}
              <div className={`p-3 rounded-xl bg-gradient-to-br ${isActive ? opt.color : (isLight ? 'from-slate-100 to-slate-200' : 'from-slate-800 to-slate-900')} text-white shadow-xs`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[11px] font-bold uppercase tracking-wider ${isActive ? (isLight ? 'text-blue-950' : 'text-white') : 'text-slate-500'}`}>
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-all ${
            isLight
              ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
          }`}
          title="Orqaga"
        >
          <ArrowLeft size={18} />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={validate}
          className="flex-1 h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
        >
          <span>Davom etish</span>
          <ArrowRight size={16} />
        </motion.button>
      </div>
    </motion.div>
  )
}
