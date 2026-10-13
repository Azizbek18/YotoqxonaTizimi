'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { GraduationCap } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import CustomSelect from '@/components/ui/CustomSelect'
import { PERMIT_FACULTIES } from '@/lib/faculties'
import { directionsForFaculty } from '@/lib/directions'
import { KvActions, KvStepHeader, kvStyles } from './ui'
import type { KvRegisterData } from './types'

const COURSES = [1, 2, 3, 4, 5, 6]

interface Props {
  data: KvRegisterData
  onChange: (d: Partial<KvRegisterData>) => void
  onNext: () => void
  onBack: () => void
}

export default function Step4Study({ data, onChange, onNext, onBack }: Props) {
  const isLight = useThemeStore((s) => s.theme) === 'light'
  const s = kvStyles(isLight)
  const directionOptions = useMemo(() => directionsForFaculty(data.faculty), [data.faculty])

  const validate = () => {
    if (!data.faculty) return toast.error('Fakultetni tanlang')
    if (!data.direction) return toast.error("Yo'nalishni tanlang")
    if (!data.course) return toast.error('Kursni tanlang')
    onNext()
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <KvStepHeader icon={GraduationCap} title="O‘qish" subtitle="Fakultet, yo‘nalish, guruh" isLight={isLight} />

      <div className="space-y-1.5">
        <label className={s.label}>Fakultet</label>
        <CustomSelect
          value={data.faculty}
          onChange={(v) => onChange({ faculty: v, direction: '' })}
          options={PERMIT_FACULTIES.map((f) => ({ value: f.value, label: f.label }))}
          placeholder="Fakultetni tanlang"
          className={s.select}
          menuClassName="max-h-72!"
        />
      </div>

      <div className="space-y-1.5">
        <label className={s.label}>Yo‘nalish</label>
        <CustomSelect
          value={data.direction}
          onChange={(v) => onChange({ direction: v })}
          options={directionOptions.map((d) => ({ value: d.value, label: d.label }))}
          placeholder="Yo'nalishni tanlang"
          disabled={!data.faculty}
          emptyText="Avval fakultetni tanlang"
          className={s.select}
          menuClassName="max-h-72!"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={s.label}>Kurs</label>
          <CustomSelect
            value={data.course}
            onChange={(v) => onChange({ course: v })}
            options={COURSES.map((c) => ({ value: String(c), label: `${c}-kurs` }))}
            placeholder="Kurs"
            className={s.select}
          />
        </div>
        <div className="space-y-1.5">
          <label className={s.label}>Guruh</label>
          <input
            value={data.group}
            onChange={(e) => onChange({ group: e.target.value })}
            className={s.inputPlain}
            placeholder="101-21"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <label className={s.label}>HEMIS ID</label>
          <span className={s.hint}>Ixtiyoriy</span>
        </div>
        <input
          value={data.hemisStudentId}
          onChange={(e) => onChange({ hemisStudentId: e.target.value })}
          className={s.inputPlain}
          placeholder="3822111000..."
        />
      </div>

      <KvActions isLight={isLight} onBack={onBack} onNext={validate} />
    </motion.div>
  )
}
