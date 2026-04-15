'use client'

import React from 'react'
import { RegisterData } from './types'
import { motion, AnimatePresence } from 'framer-motion'
import { DoorOpen, Hash, Sparkles, ShieldAlert, ArrowRight, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  data: RegisterData
  onChange: (d: Partial<RegisterData>) => void
  onNext: () => void
  onBack: () => void
}

export default function Step8Room({ data, onChange, onNext, onBack }: Props) {
  
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
      <div className="flex items-center gap-3 bg-white/[0.03] p-2.5 rounded-2xl border border-white/[0.05]">
        <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl border border-amber-500/20 text-amber-400">
          <DoorOpen size={20} />
        </div>
        <div>
          <h2 className="text-[14px] font-bold text-white tracking-tight">Turar joy</h2>
          <p className="text-[9px] text-amber-400/80 font-black uppercase tracking-wider">Qadam 08 / 09</p>
        </div>
      </div>

      {/* 3D Room Card - Responsive bo'ldi */}
      <div className="relative group" style={{ perspective: '1000px' }}>
        <motion.div
          animate={{ rotateY: [0, 3, -3, 0], rotateX: [0, -2, 2, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="relative w-full rounded-[24px] p-5 sm:p-7 border border-white/10 bg-[#1e293b]/40 backdrop-blur-3xl shadow-2xl overflow-hidden"
        >
          {/* Gradients */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 blur-[40px] rounded-full" />
          
          <div className="flex justify-between items-start mb-6 sm:mb-8">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Smart Access</p>
              <div className="h-0.5 w-10 bg-amber-500 rounded-full" />
            </div>
            <KeyRound className="text-amber-400/30" size={18} />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Xona raqami</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                <Hash className="text-amber-500/40" size={20} />
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={data.room_number || ''}
                onChange={handleInputChange}
                placeholder="000"
                className="w-full bg-white/[0.03] border border-white/10 focus:border-amber-500/50 text-white text-2xl sm:text-3xl font-black tracking-widest pl-12 pr-4 py-4 rounded-2xl outline-none transition-all placeholder:text-white/5"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[9px] text-slate-400 font-bold uppercase">Tizim faol</p>
          </div>
        </motion.div>
      </div>

      {/* Navigation - Pastki qismga yopishib qolmasligi uchun */}
      <div className="flex items-center gap-3 pt-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.08] text-slate-400"
        >
          ←
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleValidate}
          className="flex-1 relative h-12 overflow-hidden group rounded-xl bg-gradient-to-r from-amber-600 to-orange-600"
        >
          <div className="relative h-full flex items-center justify-center gap-2">
            <span className="text-white font-bold text-[11px] tracking-widest uppercase">Tasdiqlash</span>
            <ArrowRight className="text-white" size={16} />
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