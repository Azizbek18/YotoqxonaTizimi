'use client'

import { motion } from 'framer-motion'
import { User, ArrowRight, IdCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { getNamePartError } from '@/lib/permit-validation'
import { cyrillicToLatin } from '@/lib/transliterate'
import { stepLabel } from '@/components/register/constants'
import type { KvRegisterData } from './types'

interface Props {
  data: KvRegisterData
  onChange: (d: Partial<KvRegisterData>) => void
  onNext: () => void
  stepNumber: number
  totalSteps: number
}

export default function Step1Name({ data, onChange, onNext, stepNumber, totalSteps }: Props) {
  const isLight = useThemeStore((s) => s.theme) === 'light'

  const validate = () => {
    const error = getNamePartError(data.lastName, 'Familiya')
      || getNamePartError(data.firstName, 'Ism')
      || (data.noMiddleName ? null : getNamePartError(data.middleName, 'Otasining ismi'))
    if (error) {
      toast.error(error)
      return
    }
    onNext()
  }

  const labelClass = 'text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1 block'
  const inputCls = `w-full border p-3 pl-10 rounded-xl text-[13px] font-medium outline-none transition-all ${
    isLight
      ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400'
      : 'bg-white/[0.04] border-white/12 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500'
  } disabled:opacity-40 disabled:cursor-not-allowed`

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 font-sans px-1">
      {/* Step Title */}
      <div className="flex items-center gap-2.5 pb-1">
        <div className="rounded-xl bg-blue-500/15 p-2 text-blue-600 dark:text-blue-400">
          <IdCard size={17} />
        </div>
        <div>
          <h2 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Shaxsiy ma‘lumotlar (F.I.Sh)
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Pasport yoki ID-karta bo‘yicha</p>
        </div>
        <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-200/60 dark:border-blue-500/20">
          {stepLabel(stepNumber, totalSteps)}
        </span>
      </div>

      {/* Familiya */}
      <div className="space-y-1.5">
        <label className={labelClass}>Familiya</label>
        <div className="relative">
          <User size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            type="text"
            autoComplete="family-name"
            value={data.lastName}
            onChange={(e) => onChange({ lastName: cyrillicToLatin(e.target.value) })}
            placeholder="Masalan: Abdullayev"
            className={inputCls}
          />
        </div>
      </div>

      {/* Ism & Otasining ismi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass}>Ism</label>
          <div className="relative">
            <User size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
            <input
              type="text"
              autoComplete="given-name"
              value={data.firstName}
              onChange={(e) => onChange({ firstName: cyrillicToLatin(e.target.value) })}
              placeholder="Masalan: Sardor"
              className={inputCls}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Otasining ismi</label>
          <div className="relative">
            <User size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${data.noMiddleName ? 'text-slate-600' : (isLight ? 'text-slate-400' : 'text-slate-500')}`} />
            <input
              type="text"
              autoComplete="additional-name"
              disabled={data.noMiddleName}
              value={data.noMiddleName ? '' : data.middleName}
              onChange={(e) => onChange({ middleName: cyrillicToLatin(e.target.value) })}
              placeholder={data.noMiddleName ? '—' : "Masalan: Olim o'g'li"}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* No middle name checkbox */}
      <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
        data.noMiddleName
          ? (isLight ? 'bg-blue-50/60 border-blue-200 text-blue-900' : 'bg-blue-500/10 border-blue-500/30 text-blue-300')
          : (isLight ? 'bg-slate-50/60 border-slate-200/80 text-slate-600 hover:bg-slate-100/60' : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.04]')
      }`}>
        <input
          type="checkbox"
          checked={data.noMiddleName}
          onChange={(e) => onChange({ noMiddleName: e.target.checked, ...(e.target.checked ? { middleName: '' } : {}) })}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-[11px] font-medium">
          Otasining ismi yo‘q (xorijiy pasport yoki guvohnomada ko‘rsatilmagan)
        </span>
      </label>

      {/* Action Button */}
      <div className="pt-2">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={validate}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
        >
          <span>Davom etish</span>
          <ArrowRight size={16} />
        </motion.button>
      </div>
    </motion.div>
  )
}
