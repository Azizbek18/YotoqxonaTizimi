'use client'

import { RegisterData } from './types'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { User, ArrowRight, ShieldAlert, BadgeCheck, PencilLine } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'
import CustomSelect from '@/components/ui/CustomSelect'
import PhoneField from '@/components/ui/PhoneField'
import { getNamePartError, isPlausibleInternationalPhone } from '@/lib/permit-validation'
import { cyrillicToLatin } from '@/lib/transliterate'
import { stepLabel } from './constants'

interface Props {
  data: RegisterData
  onChange: (d: Partial<RegisterData>) => void
  onNext: () => void
  onBack: () => void
  stepNumber?: number
  totalSteps?: number
  applicationType?: 'yollanma' | 'imtiyozli'
}

// yo'llanma: F.I.Sh comes from the my.gov.uz referral — shown read-only.
// imtiyozli: the applicant typed their own F.I.Sh into the ariza (often
// ALL-CAPS, glued into one token, or padded with "XXX"), so it is prefilled
// but editable here — the student confirms/corrects it, and the server carries
// the correction back onto the permit. Birth date + phone are always entered.
export default function Step2Name({ data, onChange, onNext, onBack, stepNumber = 2, totalSteps = 8, applicationType = 'yollanma' }: Props) {
  const isLight = useThemeStore((state) => state.theme) === 'light'
  const nameEditable = applicationType === 'imtiyozli'

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
    if (nameEditable) {
      const nameError = getNamePartError(data.lastName, 'Familiya')
        || getNamePartError(data.firstName, 'Ism')
        || (data.noMiddleName || !data.middleName ? null : getNamePartError(data.middleName, 'Otasining ismi'))
      if (nameError) return show3DToast(nameError)
    }
    if (!data.birthDate || data.birthDate.includes('undefined')) return show3DToast('Tug‘ilgan sanangizni tanlang')
    if (!isPlausibleInternationalPhone(data.phone)) return show3DToast('Telefon raqamini to‘liq kiriting')
    onNext()
  }

  const labelClass = 'text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 block'
  const dateSelectCls = `${isLight ? 'bg-white border border-slate-200' : 'bg-white/[0.02] border border-white/[0.08]'} backdrop-blur-xl p-3.5 rounded-xl text-[13px] pl-3 text-center transition-all duration-500 relative`
  const nameInputCls = `w-full border p-3 pl-10 rounded-xl text-[13px] outline-none transition-all ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100' : 'bg-white/[0.03] border-white/12 text-white focus:border-indigo-500/50'} disabled:opacity-50`

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

      {nameEditable ? (
        /* Editable F.I.Sh — prefilled from the ariza, student confirms/corrects */
        <div className={`rounded-2xl border px-4 py-3.5 space-y-3 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/8'}`}>
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-indigo-400">
            <PencilLine size={12} /> F.I.Sh — arizadan olindi, tekshiring
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Familiya</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                autoComplete="family-name"
                value={data.lastName}
                onChange={(e) => onChange({ lastName: cyrillicToLatin(e.target.value) })}
                placeholder="Familiya"
                className={nameInputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <label className={labelClass}>Ism</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  autoComplete="given-name"
                  value={data.firstName}
                  onChange={(e) => onChange({ firstName: cyrillicToLatin(e.target.value) })}
                  placeholder="Ism"
                  className={nameInputCls}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Otasining ismi</label>
              <div className="relative">
                <User size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${data.noMiddleName ? 'text-slate-600' : 'text-slate-500'}`} />
                <input
                  type="text"
                  autoComplete="additional-name"
                  disabled={data.noMiddleName}
                  value={data.noMiddleName ? '' : data.middleName}
                  onChange={(e) => onChange({ middleName: cyrillicToLatin(e.target.value) })}
                  placeholder={data.noMiddleName ? '—' : 'Sharif'}
                  className={nameInputCls}
                />
              </div>
            </div>
          </div>

          <label className={`flex items-center gap-2 ml-0.5 text-[11px] font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            <input
              type="checkbox"
              checked={data.noMiddleName}
              onChange={(e) => onChange({ noMiddleName: e.target.checked, ...(e.target.checked ? { middleName: '' } : {}) })}
            />
            Otasining ismi yo&apos;q (xorijiy pasport)
          </label>
          <p className={`ml-0.5 text-[10px] leading-relaxed ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Ismni pasportdagidek yozing. Kirilcha yozsangiz avtomatik lotinga o&apos;giriladi.
          </p>
        </div>
      ) : (
        /* Read-only F.I.Sh from the approved my.gov.uz referral */
        <div className={`rounded-2xl border px-4 py-3 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/8'}`}>
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-emerald-500">
            <BadgeCheck size={12} /> Arizangizdagi F.I.Sh
          </div>
          <p className={`mt-1 text-[15px] font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{fullName || '—'}</p>
        </div>
      )}

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
          <PhoneField
            value={data.phone || ''}
            onChange={(v) => onChange({ phone: v })}
            isLight={isLight}
            placeholder="90 123 45 67"
          />
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
