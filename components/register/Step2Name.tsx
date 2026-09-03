'use client'

import React, { useState } from 'react'
import { RegisterData } from './types'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { User, ArrowRight, ShieldAlert, Phone, BadgeCheck } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'
import CustomSelect from '@/components/ui/CustomSelect'
import { stepLabel } from './constants'

interface Props {
  data: RegisterData
  onChange: (d: Partial<RegisterData>) => void
  onNext: () => void
  onBack: () => void
  stepNumber?: number
  totalSteps?: number
}

// F.I.Sh tasdiqlangan arizadan keladi — bu yerda faqat ko'rsatiladi. Talaba
// tug'ilgan sana va telefonini kiritadi (telefon ham prefilled, tasdiqlanadi).
export default function Step2Name({ data, onChange, onNext, onBack, stepNumber = 2, totalSteps = 8 }: Props) {
  const isLight = useThemeStore((state) => state.theme) === 'light'
  const [focusedPhone, setFocusedPhone] = useState(false)

  const fullName = [data.lastName, data.firstName, data.noMiddleName ? '' : data.middleName]
    .filter(Boolean)
    .join(' ')

  const show3DToast = (message: string) => {
    toast.custom((t) => (
      <AnimatePresence>
        {t.visible && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
            className="relative z-9999 w-[92vw] max-w-100 mx-auto"
          >
            <div className="absolute -inset-1 rounded-2xl blur-md opacity-30 bg-rose-500" />
            <div className={`relative backdrop-blur-2xl border p-4 rounded-2xl flex items-center gap-3 ${isLight ? 'bg-white/95 border-slate-200' : 'bg-[#1e293b]/95 border-white/10'}`}>
              <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border bg-rose-500/20 text-rose-400 border-rose-500/30">
                <ShieldAlert size={20} />
              </div>
              <p className={`text-[12px] font-medium leading-tight ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    ), { duration: 3000, position: 'top-center' })
  }

  const validate = () => {
    if (!data.birthDate || data.birthDate.includes('undefined')) return show3DToast('Tug‘ilgan sanangizni tanlang')
    if (!/^\d{9}$/.test(data.phone)) return show3DToast("Telefon raqami 9 ta raqam bo'lishi shart")
    onNext()
  }

  const glassInput = 'w-full bg-transparent p-3.5 rounded-xl outline-none placeholder:text-slate-600 transition-colors duration-300 font-sans text-[13px]'
  const labelClass = 'text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 block'
  const dateSelectCls = `${isLight ? 'bg-white border border-slate-200' : 'bg-white/[0.02] border border-white/[0.08]'} backdrop-blur-xl p-3.5 rounded-xl text-[13px] pl-3 text-center transition-all duration-500 relative`

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 font-sans px-1">
      {/* Header */}
      <div className={`flex items-center gap-3 p-2.5 rounded-2xl border ${isLight ? 'bg-white border-slate-200' : 'bg-white/3 border-white/5'}`}>
        <div className="p-2 bg-linear-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/20 text-indigo-400">
          <User size={18} />
        </div>
        <div>
          <h2 className={`text-[14px] font-bold uppercase tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>Shaxsiy ma&apos;lumotlar</h2>
          <p className="text-[9px] text-indigo-400/80 font-black uppercase tracking-widest">{stepLabel(stepNumber, totalSteps)}</p>
        </div>
      </div>

      {/* Read-only F.I.Sh from the approved application */}
      <div className={`rounded-2xl border px-4 py-3 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/8'}`}>
        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-emerald-500">
          <BadgeCheck size={12} /> Arizangizdagi F.I.Sh
        </div>
        <p className={`mt-1 text-[15px] font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{fullName || '—'}</p>
      </div>

      <div className="grid gap-4">
        {/* Tug'ilgan sana */}
        <div className="space-y-1.5">
          <label className={labelClass}>Tug&apos;ilgan sana</label>
          <div className="grid grid-cols-3 gap-2">
            <CustomSelect
              className={dateSelectCls}
              menuClassName="text-center"
              placeholder="Kun"
              value={data.birthDate?.split('-')[2] || ''}
              onChange={(val) => {
                const parts = (data.birthDate || '2000-01-01').split('-')
                onChange({ birthDate: `${parts[0]}-${parts[1]}-${val}` })
              }}
              options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: String(i + 1) }))}
            />
            <CustomSelect
              className={dateSelectCls}
              menuClassName="text-center"
              placeholder="Oy"
              value={data.birthDate?.split('-')[1] || ''}
              onChange={(val) => {
                const parts = (data.birthDate || '2000-01-01').split('-')
                onChange({ birthDate: `${parts[0]}-${val}-${parts[2]}` })
              }}
              options={['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'].map((m, i) => ({
                value: (i + 1).toString().padStart(2, '0'),
                label: m,
              }))}
            />
            <CustomSelect
              className={dateSelectCls}
              menuClassName="text-center"
              placeholder="Yil"
              value={data.birthDate?.split('-')[0] || ''}
              onChange={(val) => {
                const parts = (data.birthDate || '2000-01-01').split('-')
                onChange({ birthDate: `${val}-${parts[1]}-${parts[2]}` })
              }}
              options={Array.from({ length: 50 }, (_, i) => {
                const year = new Date().getFullYear() - 10 - i
                return { value: String(year), label: String(year) }
              })}
            />
          </div>
        </div>

        {/* Telefon */}
        <div className="space-y-1.5">
          <label className={labelClass}>Telefon raqamingiz</label>
          <div className={`cyber-border ${focusedPhone ? 'focused' : ''}`}>
            <div className="cyber-input-inner relative flex items-center">
              <div className="absolute left-4 z-10 flex items-center gap-1.5 pointer-events-none border-r border-white/10 pr-2">
                <Phone size={14} className={`transition-colors ${focusedPhone ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span className="text-[12px] font-bold text-slate-400">+998</span>
              </div>
              <input
                type="tel"
                className={`${glassInput} pl-20 ${isLight ? 'text-slate-900' : 'text-white'}`}
                placeholder="912461050"
                maxLength={9}
                value={data.phone || ''}
                onFocus={() => setFocusedPhone(true)}
                onBlur={() => setFocusedPhone(false)}
                onChange={(e) => onChange({ phone: e.target.value.replace(/\D/g, '') })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className={`h-12 w-12 flex items-center justify-center rounded-xl border transition-all text-lg ${isLight ? 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
        >
          ←
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={validate}
          className={`flex-1 relative overflow-hidden group p-px rounded-xl ${isLight ? 'bg-linear-to-r from-sky-500 to-indigo-500' : 'bg-linear-to-r from-indigo-600 to-indigo-800'}`}
        >
          <div className={`relative backdrop-blur-sm h-11.5 rounded-[11px] flex items-center justify-center gap-2 ${isLight ? 'bg-white/90' : 'bg-[#0f172a]/30'}`}>
            <span className={`font-bold text-[11px] tracking-widest uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>Davom Etish</span>
            <ArrowRight className={`${isLight ? 'text-blue-600' : 'text-white'} group-hover:translate-x-1 transition-transform`} size={16} />
          </div>
        </motion.button>
      </div>
    </motion.div>
  )
}
