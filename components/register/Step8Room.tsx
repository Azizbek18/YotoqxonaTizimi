'use client'

import React from 'react'
import { RegisterData } from './types'
import { motion, AnimatePresence } from 'framer-motion'
import { DoorOpen, Hash, Sparkles, ShieldAlert, ArrowRight, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'

interface Props {
  data: RegisterData
  onChange: (d: Partial<RegisterData>) => void
  onNext: () => void
  onBack: () => void
}

export default function Step8Room({ data, onChange, onNext, onBack }: Props) {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const show3DToast = (message: string, type: 'success' | 'error' = 'error') => {
    toast.custom((t) => (
      <AnimatePresence>
        {t.visible && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, rotateX: -15 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
            className="relative z-[9999] w-[90vw] max-w-[350px] mx-auto"
          >
            <div className={`absolute -inset-1 rounded-2xl blur-md opacity-30 ${type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <div className="relative bg-[#1e293b]/95 backdrop-blur-2xl border border-white/10 p-3.5 rounded-2xl flex items-center gap-3 shadow-2xl">
              <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                {type === 'success' ? <Sparkles size={18} /> : <ShieldAlert size={18} />}
              </div>
              <p className="text-slate-200 text-[11px] font-medium leading-tight">{message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    ));
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d*$/.test(val)) {
      onChange({ room_number: val });
    }
  };

  const handleValidate = () => {
    if (!data.room_number) return show3DToast("Xona raqamini kiriting", 'error')
    if (data.room_number.length > 5 || parseInt(data.room_number) === 0) {
      return show3DToast("Xona raqami xato", 'error')
    }
    onNext()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 font-sans w-full max-w-full overflow-hidden"
    >
      {/* Header - Yilchamroq */}
      <div className={`flex items-center gap-3 p-2.5 rounded-2xl border ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.05]'}`}>
        <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/20 text-amber-400'}`}>
          <DoorOpen size={20} />
        </div>
        <div>
          <h2 className={`text-[14px] font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>Turar joy</h2>
          <p className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-amber-600/80' : 'text-amber-400/80'}`}>Qadam 08 / 09</p>
        </div>
      </div>

      {/* 3D Room Card - Responsive bo'ldi */}
      <div className="relative group" style={{ perspective: '1000px' }}>
        <motion.div
          animate={{ rotateY: [0, 3, -3, 0], rotateX: [0, -2, 2, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className={`relative w-full rounded-[24px] p-5 sm:p-7 border overflow-hidden ${isLight ? 'bg-white/95 border-slate-200 shadow-sm' : 'bg-[#1e293b]/40 backdrop-blur-3xl border-white/10 shadow-2xl'}`}
        >
          {/* Gradients */}
          <div className={`absolute top-0 right-0 w-24 h-24 blur-[40px] rounded-full ${isLight ? 'bg-amber-200/10' : 'bg-amber-500/10'}`} />

          <div className="flex justify-between items-start mb-6 sm:mb-8">
            <div className="space-y-1">
              <p className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>Smart Access</p>
              <div className={`h-0.5 w-10 rounded-full ${isLight ? 'bg-amber-600' : 'bg-amber-500'}`} />
            </div>
            <KeyRound className={`${isLight ? 'text-amber-300' : 'text-amber-400/30'}`} size={18} />
          </div>

          <div className="space-y-3">
            <label className={`text-[10px] font-bold uppercase tracking-widest block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Xona raqami</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <Hash className={`${isLight ? 'text-amber-600/40' : 'text-amber-500/40'}`} size={20} />
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={data.room_number || ''}
                onChange={handleInputChange}
                placeholder="000"
                className={`w-full text-2xl sm:text-3xl font-black tracking-widest pl-12 pr-4 py-4 rounded-2xl outline-none transition-all ${isLight ? 'bg-white/95 border border-slate-200 text-slate-900 placeholder:text-slate-300 focus:border-sky-400 focus:bg-sky-50/30' : 'bg-white/[0.03] border border-white/10 text-white placeholder:text-white/5 focus:border-amber-500/50'}`}
              />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className={`text-[9px] font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Tizim faol</p>
          </div>
        </motion.div>
      </div>

      {/* Navigation - Pastki qismga yopishib qolmasligi uchun */}
      <div className="flex items-center gap-3 pt-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className={`h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-xl border ${isLight ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-white/[0.03] border-white/[0.08] text-slate-400'}`}
        >
          ←
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleValidate}
          className={`flex-1 relative h-12 overflow-hidden group rounded-xl ${isLight ? 'bg-linear-to-r from-sky-500 to-indigo-500' : 'bg-linear-to-r from-amber-600 to-orange-600'}`}
        >
          <div className={`relative h-full flex items-center justify-center gap-2 ${isLight ? 'bg-white/90 rounded-xl' : ''}`}>
            <span className={`font-bold text-[11px] tracking-widest uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>Tasdiqlash</span>
            <ArrowRight className={isLight ? 'text-blue-600' : 'text-white'} size={16} />
          </div>
        </motion.button>
      </div>

      <style jsx>{`
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </motion.div>
  )
}