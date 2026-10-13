'use client'

import { motion } from 'framer-motion'
import { Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { isPlausibleInternationalPhone } from '@/lib/permit-validation'
import PhoneField from '@/components/ui/PhoneField'
import { KvActions, KvStepHeader, kvStyles } from './ui'
import type { KvRegisterData } from './types'

const EMAIL_RE = /^\S+@\S+\.\S+$/

interface Props {
  data: KvRegisterData
  onChange: (d: Partial<KvRegisterData>) => void
  onNext: () => void
  onBack: () => void
}

export default function Step2Contact({ data, onChange, onNext, onBack }: Props) {
  const isLight = useThemeStore((s) => s.theme) === 'light'
  const s = kvStyles(isLight)

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

  const fieldTone = isLight
    ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-600'
    : 'bg-white/[0.04] border-white/12 text-white focus:border-blue-500'

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <KvStepHeader icon={Mail} title="Aloqa" subtitle="Login va xabarlar uchun" isLight={isLight} />

      <div className="space-y-1.5">
        <label className={s.label}>Email</label>
        <div className="relative">
          <Mail size={17} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${s.icon}`} />
          <input
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            value={data.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="talaba@example.com"
            className={s.input}
          />
        </div>
        <p className={s.hint}>Bu email login bo‘lib xizmat qiladi.</p>
      </div>

      <div className="space-y-1.5">
        <label className={s.label}>Telefon</label>
        <PhoneField
          value={data.phone}
          onChange={(v) => onChange({ phone: v })}
          isLight={isLight}
          placeholder="90 123 45 67"
          selectClassName={`h-12 w-[96px] shrink-0 rounded-xl border px-3 text-base ${fieldTone}`}
          inputClassName={`h-12 w-full rounded-xl border pl-10 pr-3 text-base font-medium outline-none transition-all focus:ring-4 ${fieldTone} ${isLight ? 'focus:ring-blue-100 placeholder:text-slate-400' : 'focus:ring-blue-500/20 placeholder:text-slate-500'}`}
        />
      </div>

      <KvActions isLight={isLight} onBack={onBack} onNext={validate} />
    </motion.div>
  )
}
