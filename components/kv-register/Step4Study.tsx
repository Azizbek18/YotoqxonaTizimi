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

  const selectCls = `w-full border p-2.5 rounded-xl text-[13px] ${
    isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-white/[0.03] border-white/12 text-white'
  }`
  const inputCls = `w-full border p-2.5 rounded-xl text-[13px] outline-none transition-all ${
    isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500' : 'bg-white/[0.03] border-white/12 text-white focus:border-emerald-500/50'
  } disabled:opacity-50`

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 font-sans px-1">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-400">
          <GraduationCap size={14} />
        </div>
        <h2 className={`text-[13px] font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>O&apos;qish ma&apos;lumotlari</h2>
        <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-emerald-500/70">{stepLabel(stepNumber, totalSteps)}</span>
      </div>

      <div className="space-y-1">
        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">Fakultet</label>
        <CustomSelect
          value={data.faculty}
          onChange={(v) => onChange({ faculty: v, direction: '' })}
          options={PERMIT_FACULTIES.map((f) => ({ value: f.value, label: f.label }))}
          placeholder="Fakultetni tanlang"
          className={selectCls}
          menuClassName="max-h-72!"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">Yo&apos;nalish</label>
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

      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">Kurs</label>
          <CustomSelect
            value={data.course}
            onChange={(v) => onChange({ course: v })}
            options={COURSES.map((c) => ({ value: String(c), label: `${c}-kurs` }))}
            placeholder="Kurs"
            className={selectCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">Guruh</label>
          <input value={data.group} onChange={(e) => onChange({ group: e.target.value })} className={inputCls} placeholder="101-21" />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">HEMIS talaba ID (ixtiyoriy)</label>
        <input
          value={data.hemisStudentId}
          onChange={(e) => onChange({ hemisStudentId: e.target.value })}
          className={inputCls}
          placeholder="HEMIS ID"
        />
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
