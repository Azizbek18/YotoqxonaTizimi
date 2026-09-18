'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, ArrowLeft, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import CustomSelect from '@/components/ui/CustomSelect'
import { PERMIT_FACULTIES } from '@/lib/faculties'
import { directionsForFaculty } from '@/lib/directions'
import { stepLabel } from '@/components/register/constants'
import type { KvRegisterData } from './types'

const COURSES = [1, 2, 3, 4, 5, 6]

interface Props {
  data: KvRegisterData
  onChange: (d: Partial<KvRegisterData>) => void
  onNext: () => void
  onBack: () => void
  stepNumber: number
  totalSteps: number
}

export default function Step4Study({ data, onChange, onNext, onBack, stepNumber, totalSteps }: Props) {
  const isLight = useThemeStore((s) => s.theme) === 'light'
  const directionOptions = useMemo(() => directionsForFaculty(data.faculty), [data.faculty])

  const validate = () => {
    if (!data.faculty) return toast.error('Fakultetni tanlang')
    if (!data.direction) return toast.error("Yo'nalishni tanlang")
    if (!data.course) return toast.error('Kursni tanlang')
    onNext()
  }

  const labelClass = 'text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1 block'
  const selectCls = `w-full border p-2.5 rounded-xl text-[13px] ${
    isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-white/[0.04] border-white/12 text-white'
  }`
  const inputCls = `w-full border p-2.5 rounded-xl text-[13px] font-medium outline-none transition-all ${
    isLight
      ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400'
      : 'bg-white/[0.04] border-white/12 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500'
  } disabled:opacity-50`

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-3.5 font-sans px-1">
      {/* Step Header */}
      <div className="flex items-center gap-2.5 pb-1">
        <div className="rounded-xl bg-blue-500/15 p-2 text-blue-600 dark:text-blue-400">
          <GraduationCap size={17} />
        </div>
        <div>
          <h2 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            O‘qish ma‘lumotlari
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Fakultet, yo‘nalish va guruh</p>
        </div>
        <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-200/60 dark:border-blue-500/20">
          {stepLabel(stepNumber, totalSteps)}
        </span>
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}>Fakultet</label>
        <CustomSelect
          value={data.faculty}
          onChange={(v) => onChange({ faculty: v, direction: '' })}
          options={PERMIT_FACULTIES.map((f) => ({ value: f.value, label: f.label }))}
          placeholder="Fakultetni tanlang"
          className={selectCls}
          menuClassName="max-h-72!"
        />
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}>Ta‘lim yo‘nalishi</label>
        <CustomSelect
          value={data.direction}
          onChange={(v) => onChange({ direction: v })}
          options={directionOptions.map((d) => ({ value: d.value, label: d.label }))}
          placeholder="Yo'nalishni tanlang"
          disabled={!data.faculty}
          emptyText="Avval fakultetni tanlang"
          className={selectCls}
          menuClassName="max-h-72!"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass}>Kurs</label>
          <CustomSelect
            value={data.course}
            onChange={(v) => onChange({ course: v })}
            options={COURSES.map((c) => ({ value: String(c), label: `${c}-kurs` }))}
            placeholder="Kurs"
            className={selectCls}
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Guruh raqami</label>
          <input
            value={data.group}
            onChange={(e) => onChange({ group: e.target.value })}
            className={inputCls}
            placeholder="Masalan: 101-21"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className={labelClass}>HEMIS talaba ID</label>
          <span className="text-[10px] text-slate-400">Ixtiyoriy</span>
        </div>
        <input
          value={data.hemisStudentId}
          onChange={(e) => onChange({ hemisStudentId: e.target.value })}
          className={inputCls}
          placeholder="Masalan: 3822111000..."
        />
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
