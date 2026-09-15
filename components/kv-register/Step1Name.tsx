'use client'

import { motion } from 'framer-motion'
import { User, ArrowRight } from 'lucide-react'
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

  const labelClass = 'text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1 block'
  const inputCls = `w-full border p-2.5 pl-9 rounded-xl text-[13px] outline-none transition-all ${
    isLight
      ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
      : 'bg-white/[0.03] border-white/12 text-white focus:border-emerald-500/50'
  } disabled:opacity-50`

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 font-sans px-1">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-400">
          <User size={14} />
        </div>
        <h2 className={`text-[13px] font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>F.I.Sh</h2>
        <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-emerald-500/70">{stepLabel(stepNumber, totalSteps)}</span>
      </div>

      <div className="space-y-1">
        <label className={labelClass}>Familiya</label>
        <div className="relative">
          <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            autoComplete="family-name"
            value={data.lastName}
            onChange={(e) => onChange({ lastName: cyrillicToLatin(e.target.value) })}
            placeholder="Familiya"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <label className={labelClass}>Ism</label>
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              autoComplete="given-name"
              value={data.firstName}
              onChange={(e) => onChange({ firstName: cyrillicToLatin(e.target.value) })}
              placeholder="Ism"
              className={inputCls}
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Otasining ismi</label>
          <div className="relative">
            <User size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${data.noMiddleName ? 'text-slate-600' : 'text-slate-500'}`} />
            <input
              type="text"
              autoComplete="additional-name"
              disabled={data.noMiddleName}
              value={data.noMiddleName ? '' : data.middleName}
              onChange={(e) => onChange({ middleName: cyrillicToLatin(e.target.value) })}
              placeholder={data.noMiddleName ? '—' : 'Sharif'}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <label className={`flex items-center gap-2 ml-0.5 text-[10px] font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
        <input
          type="checkbox"
          checked={data.noMiddleName}
          onChange={(e) => onChange({ noMiddleName: e.target.checked, ...(e.target.checked ? { middleName: '' } : {}) })}
        />
        Otasining ismi yo&apos;q (xorijiy pasport)
      </label>

      <div className="flex items-center gap-3 pt-1">
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
