'use client'

import { motion } from 'framer-motion'
import { Mail, ArrowLeft, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { isPlausibleInternationalPhone } from '@/lib/permit-validation'
import PhoneField from '@/components/ui/PhoneField'
import { stepLabel } from '@/components/register/constants'
import type { KvRegisterData } from './types'

const EMAIL_RE = /^\S+@\S+\.\S+$/

interface Props {
  data: KvRegisterData
  onChange: (d: Partial<KvRegisterData>) => void
  onNext: () => void
  onBack: () => void
  stepNumber: number
  totalSteps: number
}

export default function Step2Contact({ data, onChange, onNext, onBack, stepNumber, totalSteps }: Props) {
  const isLight = useThemeStore((s) => s.theme) === 'light'

  const validate = () => {
    if (!EMAIL_RE.test(data.email.trim())) {
      toast.error('Email noto‘g‘ri')
      return
    }
    if (!isPlausibleInternationalPhone(data.phone)) {
      toast.error('Telefon raqamini to‘liq kiriting')
      return
    }
    onNext()
  }

  const labelClass = 'text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1 block'
  const inputCls = `w-full border p-3 pl-10 rounded-xl text-[13px] font-medium outline-none transition-all ${
    isLight
      ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400'
      : 'bg-white/[0.04] border-white/12 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500'
  }`

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 font-sans px-1">
      {/* Step Header */}
      <div className="flex items-center gap-2.5 pb-1">
        <div className="rounded-xl bg-blue-500/15 p-2 text-blue-600 dark:text-blue-400">
          <Mail size={17} />
        </div>
        <div>
          <h2 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Aloqa ma‘lumotlari
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Tizimga kirish va xabardorlik uchun</p>
        </div>
        <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-200/60 dark:border-blue-500/20">
          {stepLabel(stepNumber, totalSteps)}
        </span>
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}>Elektron pochta (Email)</label>
        <div className="relative">
          <Mail size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            value={data.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="talaba@example.com"
            className={inputCls}
          />
        </div>
        <p className="text-[10.5px] text-slate-400 dark:text-slate-500 ml-1">
          Ushbu email profilingizga kirishda asosiy login sifatida ishlatiladi.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}>Telefon raqamingiz</label>
        <PhoneField value={data.phone} onChange={(v) => onChange({ phone: v })} isLight={isLight} placeholder="90 123 45 67" />
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
