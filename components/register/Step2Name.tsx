'use client'

import React from 'react'
import { RegisterData } from './types'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { User, UserCircle, Users, ArrowRight, Sparkles, ShieldAlert, Phone } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'

interface Props {
  data: RegisterData
  onChange: (d: Partial<RegisterData>) => void
  onNext: () => void
  onBack: () => void
}

export default function Step2Name({ data, onChange, onNext, onBack }: Props) {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const show3DToast = (message: string, type: 'success' | 'error' = 'error') => {
    toast.custom((t) => (
      <AnimatePresence>
        {t.visible && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
            className="relative z-9999 w-[92vw] max-w-100 mx-auto"
          >
            <div className={`absolute -inset-1 rounded-2xl blur-md opacity-30 ${type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <div className="relative bg-[#1e293b]/95 backdrop-blur-2xl border border-white/10 p-4 rounded-2xl flex items-center gap-3">
              <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                {type === 'success' ? <Sparkles size={20} /> : <ShieldAlert size={20} />}
              </div>
              <div className="flex-1">
                <p className={`text-[9px] font-black uppercase tracking-widest ${type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {type === 'success' ? 'Muvaffaqiyatli' : 'Xatolik aniqlandi'}
                </p>
                <p className="text-slate-200 text-[12px] font-medium leading-tight">{message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    ), { duration: 3000, position: 'top-center' });
  }

  const validate = () => {
    const { lastName, firstName, middleName, phone, birthDate } = data
    const phoneRegex = /^\d{9}$/;

    if (!lastName.trim()) return show3DToast("Familiyangizni kiriting")
    if (!firstName.trim()) return show3DToast("Ismingizni kiriting")
    if (!middleName.trim()) return show3DToast("Otasining ismini kiriting")

    if (!birthDate || birthDate.includes('undefined')) return show3DToast('Tug‘ilgan sanangizni tanlang')
    // Telefon raqami validatsiyasi
    if (!phone) return show3DToast("Telefon raqamingizni kiriting")
    if (!phoneRegex.test(phone)) return show3DToast("Telefon raqami 9 ta raqam bo'lishi shart")

    show3DToast("Ma'lumotlar saqlandi!", 'success')
    setTimeout(() => onNext(), 1200)
  }

  const glassInput = `
    w-full bg-white/[0.02] border border-white/[0.08] backdrop-blur-xl
    p-3.5 rounded-xl outline-none text-white placeholder:text-slate-600
    transition-all duration-500 font-sans text-[13px]
    pl-12 focus:border-indigo-500/40 focus:bg-white/[0.05] focus:ring-[4px] focus:ring-indigo-500/5
    hover:border-white/20
  `

  const labelClass = "text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 block"

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 font-sans px-1"
    >
      {/* Header */}
      <div className="flex items-center gap-3 bg-white/3 p-2.5 rounded-2xl border border-white/5">
        <div className="p-2 bg-linear-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/20 text-indigo-400">
          <User size={18} />
        </div>
        <div>
          <h2 className="text-[14px] font-bold text-white uppercase tracking-tight">Shaxsiy ma&apos;lumotlar</h2>
          <p className="text-[9px] text-indigo-400/80 font-black uppercase tracking-widest">Qadam 02 / 09</p>
        </div>
      </div>

      <div className="grid gap-4">
        {/* Familiya */}
        <div className="space-y-1.5 group">
          <label className={labelClass}>Familiya</label>
          <div className="relative flex items-center">
            <Users className="absolute left-4 z-10 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
            <input
              type="text"
              className={glassInput}
              placeholder="Mo‘minov"
              value={data.lastName || ''}
              onChange={e => onChange({ lastName: e.target.value })}
            />
          </div>
        </div>

        {/* Ism va Otasining ismi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 group">
            <label className={labelClass}>Ism</label>
            <div className="relative flex items-center">
              <UserCircle className="absolute left-4 z-10 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
              <input
                type="text"
                className={glassInput}
                placeholder="Azizbek"
                value={data.firstName || ''}
                onChange={e => onChange({ firstName: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5 group">
            <label className={labelClass}>Otasining ismi</label>
            <div className="relative flex items-center">
              <Sparkles className="absolute left-4 z-10 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
              <input
                type="text"
                className={glassInput}
                placeholder="Otasining ismi"
                value={data.middleName || ''}
                onChange={e => onChange({ middleName: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Tug'ilgan sana - 3D Interaktiv Element */}
        <div className="space-y-1.5 group">
          <label className={labelClass}>Tug&apos;ilgan sana</label>
          <div className="grid grid-cols-3 gap-2">
            {/* Kun */}
            <div className="relative group/date">
              <div className="absolute -inset-0.5 bg-linear-to-b from-indigo-500/20 to-transparent rounded-xl blur opacity-0 group-hover/date:opacity-100 transition duration-500" />
              <select
                className={`${glassInput} pl-3 text-center appearance-none cursor-pointer relative`}
                value={data.birthDate?.split('-')[2] || ''}
                onChange={e => {
                  const parts = (data.birthDate || '2000-01-01').split('-');
                  onChange({ birthDate: `${parts[0]}-${parts[1]}-${e.target.value.padStart(2, '0')}` });
                }}
              >
                <option value="" disabled className="bg-slate-900 text-slate-500">Kun</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1} className="bg-slate-900 text-white">{i + 1}</option>
                ))}
              </select>
            </div>

            {/* Oy */}
            <div className="relative group/date">
              <div className="absolute -inset-0.5 bg-linear-to-b from-purple-500/20 to-transparent rounded-xl blur opacity-0 group-hover/date:opacity-100 transition duration-500" />
              <select
                className={`${glassInput} pl-3 text-center appearance-none cursor-pointer relative`}
                value={data.birthDate?.split('-')[1] || ''}
                onChange={e => {
                  const parts = (data.birthDate || '2000-01-01').split('-');
                  onChange({ birthDate: `${parts[0]}-${e.target.value}-${parts[2]}` });
                }}
              >
                <option value="" disabled className="bg-slate-900 text-slate-500">Oy</option>
                {["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"].map((m, i) => (
                  <option key={m} value={(i + 1).toString().padStart(2, '0')} className="bg-slate-900 text-white">{m}</option>
                ))}
              </select>
            </div>

            {/* Yil */}
            <div className="relative group/date">
              <div className="absolute -inset-0.5 bg-linear-to-b from-blue-500/20 to-transparent rounded-xl blur opacity-0 group-hover/date:opacity-100 transition duration-500" />
              <select
                className={`${glassInput} pl-3 text-center appearance-none cursor-pointer relative`}
                value={data.birthDate?.split('-')[0] || ''}
                onChange={e => {
                  const parts = (data.birthDate || '2000-01-01').split('-');
                  onChange({ birthDate: `${e.target.value}-${parts[1]}-${parts[2]}` });
                }}
              >
                <option value="" disabled className="bg-slate-900 text-slate-500">Yil</option>
                {Array.from({ length: 50 }, (_, i) => {
                  const year = new Date().getFullYear() - 10 - i;
                  return <option key={year} value={year} className="bg-slate-900 text-white">{year}</option>
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Talaba telefon raqami - YANGI ELEMENT */}
        <div className="space-y-1.5 group">
          <label className={labelClass}>Telefon raqamingiz</label>
          <div className="relative flex items-center">
            <div className="absolute left-4 z-10 flex items-center gap-1.5 pointer-events-none border-r border-white/10 pr-2">
              <Phone size={14} className="text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              <span className="text-[12px] font-bold text-slate-400">+998</span>
            </div>
            <input
              type="tel"
              className={`${glassInput} pl-20`}
              placeholder="912461050"
              maxLength={9}
              value={data.phone || ''}
              onChange={e => onChange({ phone: e.target.value.replace(/\D/g, '') })}
            />
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className={`h-12 w-12 flex items-center justify-center rounded-xl border transition-all shadow-inner text-lg ${isLight ? 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
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
