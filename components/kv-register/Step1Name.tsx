'use client'

import { motion } from 'framer-motion'
import { User, IdCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { getNamePartError } from '@/lib/permit-validation'
import { cyrillicToLatin } from '@/lib/transliterate'
import { KvActions, KvStepHeader, kvStyles } from './ui'
import type { KvRegisterData } from './types'

interface Props {
  data: KvRegisterData
  onChange: (d: Partial<KvRegisterData>) => void
  onNext: () => void
}

export default function Step1Name({ data, onChange, onNext }: Props) {
  const isLight = useThemeStore((s) => s.theme) === 'light'
  const s = kvStyles(isLight)

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

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <KvStepHeader icon={IdCard} title="F.I.Sh" subtitle="Pasport yoki ID-karta bo‘yicha" isLight={isLight} />

      <div className="space-y-1.5">
        <label className={s.label}>Familiya</label>
        <div className="relative">
          <User size={17} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${s.icon}`} />
          <input
            type="text"
            autoComplete="family-name"
            value={data.lastName}
            onChange={(e) => onChange({ lastName: cyrillicToLatin(e.target.value) })}
            placeholder="Abdullayev"
            className={s.input}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={s.label}>Ism</label>
          <div className="relative">
            <User size={17} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${s.icon}`} />
            <input
              type="text"
              autoComplete="given-name"
              value={data.firstName}
              onChange={(e) => onChange({ firstName: cyrillicToLatin(e.target.value) })}
              placeholder="Sardor"
              className={s.input}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={s.label}>Otasining ismi</label>
          <div className="relative">
            <User size={17} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${s.icon}`} />
            <input
              type="text"
              autoComplete="additional-name"
              disabled={data.noMiddleName}
              value={data.noMiddleName ? '' : data.middleName}
              onChange={(e) => onChange({ middleName: cyrillicToLatin(e.target.value) })}
              placeholder={data.noMiddleName ? '—' : "Olim o'g'li"}
              className={s.input}
            />
          </div>
        </div>
      </div>

      <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-all ${
        data.noMiddleName
          ? (isLight ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-blue-500/30 bg-blue-500/10 text-blue-200')
          : (isLight ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100' : 'border-white/8 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]')
      }`}>
        <input
          type="checkbox"
          checked={data.noMiddleName}
          onChange={(e) => onChange({ noMiddleName: e.target.checked, ...(e.target.checked ? { middleName: '' } : {}) })}
          className="h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm font-medium">Otasining ismi yo‘q</span>
      </label>

      <KvActions isLight={isLight} onNext={validate} />
    </motion.div>
  )
}
