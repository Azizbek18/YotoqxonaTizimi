'use client'

import { motion } from 'framer-motion'
import { Flag, Globe2, Check, ArrowLeft, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import CustomSelect from '@/components/ui/CustomSelect'
import { UZ_REGION_NAMES } from '@/lib/uz-address'
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
  { id: 'uz' as const, label: "O'zbekiston fuqarosi", icon: Flag },
  { id: 'foreign' as const, label: 'Xorijiy fuqaro', icon: Globe2 },
]

// Feeds `users.region` (Uzbek citizen) or `users.country` (foreign citizen)
// on submit — the same two columns features/foreign-docs' resolveDocsMode
// already reads to decide whether a student needs the visa module (foreign)
// or just the propiska module (Uzbek, but permanently registered outside
// the dorm's home region). A KV-talaba renting off-campus still needs
// either document, so this step is what actually "covers" both audiences
// the off-campus wizard was missing before.
export default function Step4Citizenship({ data, onChange, onNext, onBack, stepNumber, totalSteps }: Props) {
  const isLight = useThemeStore((s) => s.theme) === 'light'

  const validate = () => {
    if (!data.citizenship) return toast.error('Fuqarolikni tanlang')
    if (data.citizenship === 'uz' && !data.region) return toast.error('Doimiy ro‘yxatdagi viloyatni tanlang')
    if (data.citizenship === 'foreign' && !data.country.trim()) return toast.error('Fuqaroligingiz davlatini kiriting')
    onNext()
  }

  const selectCls = `w-full border p-2.5 rounded-xl text-[13px] ${
    isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-white/[0.03] border-white/12 text-white'
  }`
  const inputCls = `w-full border p-2.5 rounded-xl text-[13px] outline-none transition-all ${
    isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500' : 'bg-white/[0.03] border-white/12 text-white focus:border-emerald-500/50'
  }`

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 font-sans px-1">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-400">
          <Globe2 size={14} />
        </div>
        <h2 className={`text-[13px] font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Fuqarolik</h2>
        <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-emerald-500/70">{stepLabel(stepNumber, totalSteps)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((opt) => {
          const isActive = data.citizenship === opt.id
          const Icon = opt.icon
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange({ citizenship: opt.id, region: '', country: '' })}
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
              <div className={`p-2.5 rounded-xl bg-linear-to-br ${isActive ? 'from-emerald-500 to-teal-600' : isLight ? 'from-slate-200 to-slate-100' : 'from-slate-700 to-slate-800'}`}>
                <Icon className={`${isActive ? 'text-white' : 'text-slate-400'} w-5 h-5`} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest text-center leading-tight ${isActive ? (isLight ? 'text-slate-900' : 'text-white') : 'text-slate-500'}`}>
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>

      {data.citizenship === 'uz' && (
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">Doimiy ro&apos;yxatdagi viloyat</label>
          <CustomSelect
            value={data.region}
            onChange={(v) => onChange({ region: v })}
            options={UZ_REGION_NAMES.map((r) => ({ value: r, label: r }))}
            placeholder="Viloyatni tanlang"
            className={selectCls}
            menuClassName="max-h-72!"
          />
        </div>
      )}

      {data.citizenship === 'foreign' && (
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">Fuqaroligingiz davlati</label>
          <input
            value={data.country}
            onChange={(e) => onChange({ country: e.target.value })}
            className={inputCls}
            placeholder="masalan: Tojikiston"
            maxLength={120}
          />
        </div>
      )}

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
