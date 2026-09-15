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

  const inputCls = `w-full border p-2.5 pl-9 rounded-xl text-[13px] outline-none transition-all ${
    isLight
      ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
      : 'bg-white/[0.03] border-white/12 text-white focus:border-emerald-500/50'
  }`

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 font-sans px-1">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-400">
          <Mail size={14} />
        </div>
        <h2 className={`text-[13px] font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Aloqa ma&apos;lumotlari</h2>
        <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-emerald-500/70">{stepLabel(stepNumber, totalSteps)}</span>
      </div>

      <div className="space-y-1">
        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">Email</label>
        <div className="relative">
          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            value={data.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="email@example.com"
            className={inputCls}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">Telefon raqamingiz</label>
        <PhoneField value={data.phone} onChange={(v) => onChange({ phone: v })} isLight={isLight} placeholder="90 123 45 67" />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-all ${isLight ? 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
        >
          <ArrowLeft size={17} />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={validate}
          className="flex-1 relative overflow-hidden group p-px rounded-xl bg-linear-to-r from-emerald-600 to-teal-700"
        >
          <div className={`relative backdrop-blur-sm h-10.5 rounded-[11px] flex items-center justify-center gap-2 ${isLight ? 'bg-white/90' : 'bg-[#0f172a]/30'}`}>
            <span className={`font-bold text-[11px] tracking-widest uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>Davom Etish</span>
            <ArrowRight className={`${isLight ? 'text-emerald-600' : 'text-white'} group-hover:translate-x-1 transition-transform`} size={16} />
          </div>
        </motion.button>
      </div>
    </motion.div>
  )
}
