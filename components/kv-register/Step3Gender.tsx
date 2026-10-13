'use client'

import { motion } from 'framer-motion'
import { Mars, Venus, Check, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { KvActions, KvStepHeader } from './ui'
import type { KvRegisterData } from './types'

interface Props {
  data: KvRegisterData
  onChange: (d: Partial<KvRegisterData>) => void
  onNext: () => void
  onBack: () => void
}

const OPTIONS = [
  { id: 'male' as const, label: "O'g'il", icon: Mars, color: 'from-blue-500 to-sky-400' },
  { id: 'female' as const, label: 'Qiz', icon: Venus, color: 'from-rose-500 to-pink-400' },
]

export default function Step3Gender({ data, onChange, onNext, onBack }: Props) {
  const isLight = useThemeStore((s) => s.theme) === 'light'

  const validate = () => {
    if (!data.gender) {
      toast.error('Jinsingizni tanlang')
      return
    }
    onNext()
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <KvStepHeader icon={Sparkles} title="Jinsingiz" subtitle="Hisobingiz uchun kerak" isLight={isLight} />

      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((opt) => {
          const isActive = data.gender === opt.id
          const Icon = opt.icon
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange({ gender: opt.id })}
              className={`relative flex min-h-[116px] flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border p-4 transition-all ${
                isActive
                  ? (isLight
                      ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100'
                      : 'border-blue-500 bg-blue-950/40 ring-4 ring-blue-500/20')
                  : (isLight
                      ? 'border-slate-200 bg-white hover:border-slate-300'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20')
              }`}
            >
              {isActive && (
                <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                  <Check size={12} strokeWidth={3.5} />
                </span>
              )}
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm ${
                isActive ? opt.color : (isLight ? 'from-slate-300 to-slate-400' : 'from-slate-700 to-slate-800')
              }`}>
                <Icon className="h-6 w-6" />
              </span>
              <span className={`text-sm font-bold ${isActive ? (isLight ? 'text-blue-900' : 'text-white') : (isLight ? 'text-slate-600' : 'text-slate-300')}`}>
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>

      <KvActions isLight={isLight} onBack={onBack} onNext={validate} />
    </motion.div>
  )
}
