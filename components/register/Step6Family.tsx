'use client'

import React from 'react'
import { RegisterData } from './types'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Briefcase, Phone, ArrowRight, Users, Sparkles, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'

interface Props {
  data: RegisterData
  onChange: (d: Partial<RegisterData>) => void
  onNext: () => void
  onBack: () => void
}

export default function Step6Family({ data, onChange, onNext, onBack }: Props) {
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
            <div className="relative bg-[#1e293b]/95 backdrop-blur-2xl border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                {type === 'success' ? <Sparkles size={20} /> : <ShieldAlert size={20} />}
              </div>
              <div className="flex-1">
                <p className={`text-[9px] font-black uppercase tracking-widest ${type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {type === 'success' ? 'Muvaffaqiyatli' : 'Xatolik aniqlandi'}
                </p>
                <p className="text-slate-200 text-[12px] font-medium">{message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    ), { duration: 3000, position: 'top-center' });
  }

  const handleValidate = () => {
    const phoneRegex = /^\d{9}$/;

    const isValidFullName = (name: string) => {
      if (!name) return false;
      const parts = name.trim().split(/\s+/);
      return parts.length >= 3;
    };

    const {
      father_full_name, father_workplace, father_phone,
      mother_full_name, mother_workplace, mother_phone,
      phone // Bu talabaning o'z raqami (oldingi qadamdan kelgan)
    } = data;

    // 1. MAJBURIY MAYDONLAR VA F.I.O TEKSHIRUVI
    if (!isValidFullName(father_full_name)) return show3DToast('error', "Otangizning F.I.O to'liq kiriting (3 ta so'z)!");
    if (!father_workplace?.trim()) return show3DToast('error', "Otangizning ish joyini kiriting!");
    if (!phoneRegex.test(father_phone || '')) return show3DToast('error', "Otangizning raqami noto'g'ri!");

    if (!isValidFullName(mother_full_name)) return show3DToast('error', "Onangizning F.I.O to'liq kiriting (3 ta so'z)!");
    if (!mother_workplace?.trim()) return show3DToast('error', "Onangizning ish joyini kiriting!");
    if (!phoneRegex.test(mother_phone || '')) return show3DToast('error', "Onangizning raqami noto'g'ri!");

    // 2. RAQAMLARNI O'ZARO TAQQOSLASH (DUPLICATE CHECK)

    // Ota va ona raqami bir xil bo'lmasligi kerak
    if (father_phone === mother_phone) {
      return show3DToast('error', "Ota va ona raqami bir xil bo'lishi mumkin emas!");
    }

    // Talaba o'z raqamini ota-onasi o'rniga yozmasligi kerak
    if (father_phone === phone) {
      return show3DToast('error', 'Otangizning raqami o‘rniga o‘z raqamingizni kiritmang!');
    }

    if (mother_phone === phone) {
      return show3DToast('error', 'Onangizning raqami o‘rniga o‘z raqamingizni kiritmang!');
    }

    // Hammasi joyida bo'lsa
    show3DToast('success', "Barcha ma'lumotlar tasdiqlandi");
    setTimeout(() => onNext(), 800);
  }

  const glassInput = `
    w-full backdrop-blur-xl p-3.5 rounded-xl outline-none transition-all duration-500 font-sans text-[13px] pl-12
    ${isLight
      ? 'bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:bg-sky-50/30 hover:border-sky-300'
      : 'bg-white/[0.02] border border-white/[0.08] text-white placeholder:text-slate-600 focus:border-sky-500/40 focus:bg-white/[0.05] focus:ring-[4px] focus:ring-sky-500/5 hover:border-white/20'
    }
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
          <p className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-sky-600/80' : 'text-sky-400/80'}`}>Qadam 06 / 08</p>
        </div>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {/* OTA BO'LIMI */}
        <div className={`p-5 sm:p-6 rounded-2xl border space-y-5 ${isLight ? 'bg-white/60 border-slate-200 shadow-sm' : 'bg-white/[0.01] border-white/[0.03]'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-3 bg-sky-500 rounded-full" />
            <h3 className={`text-[10px] font-black uppercase tracking-widest text-opacity-70 ${isLight ? 'text-sky-600' : 'text-sky-400'}`}>Otasi haqida</h3>
          </div>
          <InputGroup isLight={isLight} label="F.I.O (To'liq)" icon={User} placeholder="Eshmatov Toshmat Karimov" className={glassInput} value={data.father_full_name || ''} onChange={(v: string) => onChange({ father_full_name: v })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InputGroup isLight={isLight} label="Ish joyi" icon={Briefcase} placeholder="Korxona yoki soha" className={glassInput} value={data.father_workplace || ''} onChange={(v: string) => onChange({ father_workplace: v })} />
            <PhoneInput isLight={isLight} label="Telefon raqami" className={glassInput} value={data.father_phone || ''} onChange={(v: string) => onChange({ father_phone: v })} />
          </div>
        </div>

        {/* ONA BO'LIMI */}
        <div className={`p-5 sm:p-6 rounded-2xl border space-y-5 ${isLight ? 'bg-white/60 border-slate-200 shadow-sm' : 'bg-white/[0.01] border-white/[0.03]'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-3 bg-indigo-500 rounded-full" />
            <h3 className={`text-[10px] font-black uppercase tracking-widest text-opacity-70 ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>Onasi haqida</h3>
          </div>
          <InputGroup isLight={isLight} label="F.I.O (To'liq)" icon={User} placeholder="Eshmatova Gulnora Karimovna" className={glassInput} value={data.mother_full_name || ''} onChange={(v: string) => onChange({ mother_full_name: v })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InputGroup isLight={isLight} label="Ish joyi" icon={Briefcase} placeholder="Uy bekasi yoki ish joyi" className={glassInput} value={data.mother_workplace || ''} onChange={(v: string) => onChange({ mother_workplace: v })} />
            <PhoneInput isLight={isLight} label="Telefon raqami" className={glassInput} value={data.mother_phone || ''} onChange={(v: string) => onChange({ mother_phone: v })} />
          </div>
        </div>
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
interface PhoneInputProps {
  label: string
  value: string
  className?: string
  isLight?: boolean
  onChange: (value: string) => void
}

function PhoneInput({ label, value, className, isLight, onChange }: PhoneInputProps) {
  return (
    <div className="group space-y-1.5 flex-1 text-left">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <div className="relative flex items-center">
        <div className={`absolute left-4 z-10 flex items-center gap-1.5 pointer-events-none border-r pr-2 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
          <Phone size={14} className={`group-focus-within:text-sky-500 transition-colors ${isLight ? 'text-slate-400' : 'text-slate-600'}`} />
          <span className={`text-[12px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>+998</span>
        </div>
        <input className={`${className} pl-[80px]`} placeholder="911234567" maxLength={9} type="tel" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))} />
      </div>
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
  return (
    <div className="group space-y-1.5 flex-1 text-left">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <div className="relative flex items-center">
        <Icon className={`absolute left-4 z-10 group-focus-within:text-sky-500 transition-colors ${isLight ? 'text-slate-400' : 'text-slate-600'}`} size={16} />
        <input className={className} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  )
}
