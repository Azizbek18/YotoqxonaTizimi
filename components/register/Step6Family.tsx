'use client'

import React, { useState } from 'react'
import { RegisterData } from './types'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Briefcase, ArrowRight, Users, Sparkles, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import PhoneField from '@/components/ui/PhoneField'
import { isPlausibleInternationalPhone } from '@/lib/permit-validation'
import { stepLabel } from './constants'

interface Props {
  data: RegisterData
  onChange: (d: Partial<RegisterData>) => void
  onNext: () => void
  onBack: () => void
  stepNumber?: number
  totalSteps?: number
}

export default function Step6Family({ data, onChange, onNext, onBack, stepNumber = 5, totalSteps = 8 }: Props) {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  // TOAST FUNKSIYASI (Komponent ichiga qaytardik)
  const show3DToast = (type: 'success' | 'error', message: string) => {
    toast.custom((t) => (
      <AnimatePresence>
        {t.visible && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
            className="relative z-[9999] w-[92vw] max-w-[400px] mx-auto"
          >
            <div className={`absolute -inset-1 rounded-2xl blur-md opacity-30 ${type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <div className={`relative backdrop-blur-2xl border p-4 rounded-2xl shadow-2xl flex items-center gap-3 ${isLight ? 'bg-white/95 border-slate-200' : 'bg-[#1e293b]/95 border-white/10'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                {type === 'success' ? <Sparkles size={20} /> : <ShieldAlert size={20} />}
              </div>
              <div className="flex-1">
                <p className={`text-[9px] font-black uppercase tracking-widest ${type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {type === 'success' ? 'Muvaffaqiyatli' : 'Xatolik aniqlandi'}
                </p>
                <p className={`text-[12px] font-medium ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    ), { duration: 3000, position: 'top-center' });
  }

  const handleValidate = () => {
    const isValidFullName = (name: string) => {
      if (!name) return false;
      const parts = name.trim().split(/\s+/);
      return parts.length >= 3;
    };

    const {
      father_full_name, father_workplace, father_phone, noFather,
      mother_full_name, mother_workplace, mother_phone, noMother,
      phone // Bu talabaning o'z raqami (oldingi qadamdan kelgan)
    } = data;

    // Kamida bitta ota-ona (yoki qonuniy vakil) bilan bog'lana olish kerak.
    if (noFather && noMother) {
      return show3DToast('error', "Kamida bittasi — ota yoki ona — ma'lumotini to'liq kiriting.");
    }

    // Har bir mavjud ota-ona uchun F.I.O + ish joyi + telefon to'liq.
    if (!noFather) {
      if (!isValidFullName(father_full_name)) return show3DToast('error', "Otangizning F.I.O to'liq kiriting (3 ta so'z)!");
      if (!father_workplace?.trim()) return show3DToast('error', "Otangizning ish joyini kiriting!");
      if (!isPlausibleInternationalPhone(father_phone || '')) return show3DToast('error', "Otangizning telefon raqamini to'liq kiriting!");
    }
    if (!noMother) {
      if (!isValidFullName(mother_full_name)) return show3DToast('error', "Onangizning F.I.O to'liq kiriting (3 ta so'z)!");
      if (!mother_workplace?.trim()) return show3DToast('error', "Onangizning ish joyini kiriting!");
      if (!isPlausibleInternationalPhone(mother_phone || '')) return show3DToast('error', "Onangizning telefon raqamini to'liq kiriting!");
    }

    // Raqamlarni taqqoslash — faqat mavjud ota-onalar orasida.
    if (!noFather && !noMother && father_phone === mother_phone) {
      return show3DToast('error', "Ota va ona raqami bir xil bo'lishi mumkin emas!");
    }
    if (!noFather && father_phone === phone) {
      return show3DToast('error', 'Otangizning raqami o‘rniga o‘z raqamingizni kiritmang!');
    }
    if (!noMother && mother_phone === phone) {
      return show3DToast('error', 'Onangizning raqami o‘rniga o‘z raqamingizni kiritmang!');
    }

    show3DToast('success', "Barcha ma'lumotlar tasdiqlandi");
    setTimeout(() => onNext(), 800);
  }

  const glassInput = `
    w-full bg-transparent p-3.5 rounded-xl outline-none transition-colors duration-300 font-sans text-[13px] pl-12
    ${isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-600'}
  `;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 sm:space-y-8 font-sans px-1">
      {/* HEADER SECTION */}
      <div className={`flex items-center gap-3 p-2.5 rounded-2xl border ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.05]'}`}>
        <div className={`p-2 rounded-xl border ${isLight ? 'bg-sky-50 border-sky-100' : 'bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border-sky-500/20'}`}>
          <Users className={isLight ? "text-sky-600" : "text-sky-400"} size={18} />
        </div>
        <div>
          <h2 className={`text-[14px] font-bold uppercase tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>Oila ma&apos;lumotlari</h2>
          <p className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-sky-600/80' : 'text-sky-400/80'}`}>{stepLabel(stepNumber, totalSteps)}</p>
        </div>
      </div>

      <div className="space-y-6 sm:space-y-8">
        <ParentSection
          isLight={isLight}
          glassInput={glassInput}
          accent="sky"
          heading="Otasi haqida"
          absentLabel="Otam yo'q (vafot etgan yoki aloqa yo'q)"
          namePlaceholder="Eshmatov Toshmat Karimov"
          workplacePlaceholder="Korxona yoki soha"
          absent={data.noFather}
          onToggleAbsent={(v) => onChange(v ? { noFather: true, father_workplace: '', father_phone: '' } : { noFather: false })}
          fullName={data.father_full_name || ''}
          onFullName={(v) => onChange({ father_full_name: v })}
          workplace={data.father_workplace || ''}
          onWorkplace={(v) => onChange({ father_workplace: v })}
          phone={data.father_phone || ''}
          onPhone={(v) => onChange({ father_phone: v })}
        />

        <ParentSection
          isLight={isLight}
          glassInput={glassInput}
          accent="indigo"
          heading="Onasi haqida"
          absentLabel="Onam yo'q (vafot etgan yoki aloqa yo'q)"
          namePlaceholder="Eshmatova Gulnora Karimovna"
          workplacePlaceholder="Uy bekasi yoki ish joyi"
          absent={data.noMother}
          onToggleAbsent={(v) => onChange(v ? { noMother: true, mother_workplace: '', mother_phone: '' } : { noMother: false })}
          fullName={data.mother_full_name || ''}
          onFullName={(v) => onChange({ mother_full_name: v })}
          workplace={data.mother_workplace || ''}
          onWorkplace={(v) => onChange({ mother_workplace: v })}
          phone={data.mother_phone || ''}
          onPhone={(v) => onChange({ mother_phone: v })}
        />
      </div>

      {/* NAVIGATION */}
      <div className="flex items-center gap-3 pt-2">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="button" onClick={onBack} className={`h-12 w-12 rounded-xl border flex items-center justify-center transition-all ${isLight ? 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>←</motion.button>
        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="button" onClick={handleValidate} className={`flex-1 relative overflow-hidden group p-px rounded-xl ${isLight ? 'bg-linear-to-r from-sky-500 to-indigo-500' : 'bg-linear-to-r from-sky-600 to-indigo-600'}`}>
          <div className={`relative backdrop-blur-sm h-11 rounded-[11px] flex items-center justify-center gap-2 ${isLight ? 'bg-white/90' : 'bg-[#0f172a]/80'}`}>
            <span className={`font-bold text-[11px] tracking-[0.2em] uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>Davom etish</span>
            <ArrowRight size={16} className={`${isLight ? 'text-blue-600' : 'text-white'} group-hover:translate-x-1 transition-transform`} />
          </div>
        </motion.button>
      </div>
    </motion.div>
  )
}

// Yordamchi komponentlar
interface ParentSectionProps {
  isLight: boolean
  glassInput: string
  accent: 'sky' | 'indigo'
  heading: string
  absentLabel: string
  namePlaceholder: string
  workplacePlaceholder: string
  absent: boolean
  onToggleAbsent: (v: boolean) => void
  fullName: string
  onFullName: (v: string) => void
  workplace: string
  onWorkplace: (v: string) => void
  phone: string
  onPhone: (v: string) => void
}

function ParentSection(p: ParentSectionProps) {
  const bar = p.accent === 'sky' ? 'bg-sky-500' : 'bg-indigo-500'
  const text = p.accent === 'sky'
    ? (p.isLight ? 'text-sky-600' : 'text-sky-400')
    : (p.isLight ? 'text-indigo-600' : 'text-indigo-400')
  return (
    <div className={`p-5 sm:p-6 rounded-2xl border space-y-5 ${p.isLight ? 'bg-white/60 border-slate-200 shadow-sm' : 'bg-white/[0.01] border-white/[0.03]'}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className={`w-1 h-3 rounded-full ${bar}`} />
          <h3 className={`text-[10px] font-black uppercase tracking-widest ${text}`}>{p.heading}</h3>
        </div>
        <label className={`flex items-center gap-1.5 text-[10px] font-semibold cursor-pointer ${p.isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          <input type="checkbox" checked={p.absent} onChange={(e) => p.onToggleAbsent(e.target.checked)} />
          {p.absentLabel}
        </label>
      </div>

      <InputGroup
        isLight={p.isLight}
        label={p.absent ? "F.I.O (bilsangiz)" : "F.I.O (To'liq)"}
        icon={User}
        placeholder={p.namePlaceholder}
        className={p.glassInput}
        value={p.fullName}
        onChange={p.onFullName}
      />

      {p.absent ? (
        <p className={`text-[10px] leading-relaxed ml-1 ${p.isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Ish joyi va telefon so&apos;ralmaydi. Kamida bitta ota yoki ona ma&apos;lumoti to&apos;liq bo&apos;lishi kerak.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InputGroup isLight={p.isLight} label="Ish joyi" icon={Briefcase} placeholder={p.workplacePlaceholder} className={p.glassInput} value={p.workplace} onChange={p.onWorkplace} />
          <div className="space-y-1.5 flex-1 text-left">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Telefon raqami</label>
            <PhoneField isLight={p.isLight} value={p.phone} onChange={p.onPhone} />
          </div>
        </div>
      )}
    </div>
  )
}

interface InputGroupProps {
  label: string
  icon: React.ComponentType<{ size: number; className?: string }>
  placeholder: string
  value: string
  className?: string
  isLight?: boolean
  onChange: (value: string) => void
}

function InputGroup({ label, icon: Icon, placeholder, value, className, isLight, onChange }: InputGroupProps) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="space-y-1.5 flex-1 text-left">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <div className={`cyber-border ${focused ? 'focused' : ''}`}>
        <div className="cyber-input-inner relative flex items-center">
          <Icon className={`absolute left-4 z-10 transition-colors ${focused ? 'text-sky-500' : isLight ? 'text-slate-400' : 'text-slate-600'}`} size={16} />
          <input
            className={className}
            placeholder={placeholder}
            value={value}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
