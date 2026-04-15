'use client'

import React, { useState } from 'react'
import { RegisterData } from './types'
import { motion, AnimatePresence } from 'framer-motion'
import { GraduationCap, BookOpen, ChevronDown, Check, ArrowRight, Sparkles, ShieldAlert, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  data: RegisterData
  onChange: (d: Partial<RegisterData>) => void
  onNext: () => void
  onBack: () => void
}

const FACULTIES = [
  { value: 'AMIT', label: 'Amaliy matematika va IT' },
  { value: 'fizika', label: 'Fizika-texnika' },
  { value: 'iqtisod', label: 'Iqtisodiyot' },
  { value: 'huquq', label: 'Huquq' },
  { value: 'til', label: 'Tillar' },
  { value: 'tarix', label: 'Tarix va falsafa' },
]

const DIRECTIONS: Record<string, string[]> = {
  amit: ['Dasturiy injiniring', 'Amaliy matematika', "Sun'iy intellekt", 'Kompyuter injiniringi', 'Axborot xavfsizligi', 'Raqamli iqtisodiyot'],
  fizika: ['Fizika', 'Texnika fizikasi', 'Energetika', 'Mexanika'],
  iqtisod: ['Iqtisodiyot', 'Menejment', 'Marketing', 'Moliya', 'Buxgalteriya'],
  huquq: ['Huquqshunoslik', "Xalqaro huquq"],
  til: ["Ingliz tili", "Nemis tili", "Fransuz tili", "Xitoy tili", "Arab tili"],
  tarix: ['Tarix', 'Falsafa', 'Arxeologiya'],
}

const STUDY_TYPES = [
  { value: 'grant', label: 'Davlat granti' },
  { value: 'kontrakt', label: "To'lov-shartnoma" },
]

// PREMIUM SELECT COMPONENT
const CompactSelect = ({ label, value, options, onChange, icon: Icon }: any) => {
  const [isOpen, setIsOpen] = useState(false)
  const selectedLabel = options.find((o: any) => (o.value || o) === value)?.label || value

  return (
    <div className="relative flex-1 font-sans">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1 mb-2 block">
        {label}
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full bg-white/[0.01] border border-white/[0.08] backdrop-blur-xl 
          p-3.5 rounded-2xl flex items-center justify-between text-white transition-all duration-500
          ${isOpen ? 'border-blue-500/40 bg-white/[0.04] ring-[6px] ring-blue-500/5' : 'hover:border-white/20'}
        `}
      >
        <div className="flex items-center gap-3 truncate">
          <div className={`p-1.5 rounded-lg transition-colors ${isOpen ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-500'}`}>
            <Icon size={14} className="shrink-0" />
          </div>
          <span className="truncate text-[14px] font-semibold tracking-wide">
            {selectedLabel || "Moliya turi"}
          </span>
        </div>
        <ChevronDown size={14} className={`text-slate-500 shrink-0 transition-transform duration-500 ${isOpen ? 'rotate-180 text-blue-400' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 4 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute z-30 w-full bg-[#0f172a]/90 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <div className="max-h-[220px] overflow-y-auto p-1.5 custom-scrollbar">
                {options.map((opt: any) => {
                  const val = opt.value || opt
                  const lab = opt.label || opt
                  const isActive = val === value
                  return (
                    <button 
                      key={val} 
                      onClick={() => { onChange(val); setIsOpen(false) }}
                      className={`
                        w-full flex items-center justify-between p-3 rounded-xl text-[13px] font-medium transition-all duration-300 mb-0.5 last:mb-0
                        ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}
                      `}
                    >
                      <span className={isActive ? 'font-bold' : ''}>{lab}</span>
                      {isActive && <Check size={14} strokeWidth={3} />}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Step4Study({ data, onChange, onNext, onBack }: Props) {
  
  const show3DToast = (message: string, type: 'success' | 'error' = 'error') => {
    toast.custom((t) => (
      <AnimatePresence>
        {t.visible && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, rotateX: -15 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
            className="relative group cursor-pointer z-[9999] w-[92vw] max-w-[400px] mx-auto"
          >
            <div className={`absolute -inset-1 rounded-2xl blur-md opacity-30 transition duration-1000 ${
              type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
            }`} />
            
            <div className="relative bg-[#1e293b]/95 backdrop-blur-2xl border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center gap-3">
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${
                type === 'success' 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              }`}>
                {type === 'success' ? <Sparkles size={20} /> : <ShieldAlert size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[9px] font-black uppercase tracking-[0.15em] mb-0.5 ${
                  type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {type === 'success' ? 'Muvaffaqiyatli' : 'Ma\'lumot yetarli emas'}
                </p>
                <p className="text-slate-200 text-[12px] font-medium leading-tight">
                  {message}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    ), { duration: 3000, position: 'top-center' });
  }

  const handleValidate = () => {
    if (!data.faculty) return show3DToast("Fakultetingizni tanlang", 'error')
    if (!data.direction) return show3DToast("O'quv yo'nalishini tanlang", 'error')
    if (!data.course) return show3DToast("Kursni belgilang", 'error')
    if (!data.study_type) return show3DToast("Ta'lim shaklini tanlang", 'error')
    
    onNext()
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.6 }}
      className="space-y-4 font-sans"
    >
      {/* Premium Header */}
      <div className="relative group">
        <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
        <div className="relative flex items-center gap-5 bg-white/[0.02] p-2 rounded-[1.5rem] border border-white/[0.05] backdrop-blur-2xl">
          <div className="relative p-3.5 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl border border-blue-500/20 text-blue-400">
            <GraduationCap size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">O'quv ma'lumotlari</h2>
            <p className="text-[10px] text-blue-400/80 font-black uppercase tracking-[0.2em] mt-1">
              Qadam 04 <span className="text-slate-600 mx-1">/</span> 07
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {/* FAKULTET */}
        <CompactSelect 
          label="Fakultet" 
          value={data.faculty} 
          options={FACULTIES} 
          icon={GraduationCap} 
          onChange={(f: string) => onChange({ faculty: f, direction: DIRECTIONS[f]?.[0] ?? '' })} 
        />
        
        {/* YO'NALISH */}
        <CompactSelect 
          label="Yo'nalish" 
          value={data.direction} 
          options={DIRECTIONS[data.faculty] || []} 
          icon={BookOpen} 
          onChange={(val: string) => onChange({ direction: val })} 
        />

        {/* KURS */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Kursni tanlang</label>
          <div className="grid grid-cols-4 gap-3">
            {['1', '2', '3', '4'].map((c) => (
              <motion.button
                key={c}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onChange({ course: c })}
                className={`
                  relative h-10 rounded-2xl text-[15px] font-bold transition-all duration-500 border
                  ${data.course === c 
                    ? 'bg-blue-600 border-blue-400 text-white shadow-[0_10px_20px_rgba(59,130,246,0.3)]' 
                    : 'bg-white/[0.02] border-white/[0.08] text-slate-500 hover:border-white/20 hover:bg-white/[0.05]'
                  }
                `}
              >
                {c}
                {data.course === c && (
                  <motion.div layoutId="course-glow" className="absolute inset-0 bg-blue-400/20 blur-md rounded-2xl" />
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* TA'LIM TURI (GRANT/KONTRAKT) */}
        <div className="pt-1">
          <CompactSelect 
            label="Ta'lim shakli" 
            value={data.study_type} 
            options={STUDY_TYPES} 
            icon={Wallet} 
            onChange={(val: string) => onChange({ study_type: val })} 
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-4 pt-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="h-14 w-14 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-slate-500 hover:text-white transition-all shadow-inner"
        >
          ←
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.01, translateY: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleValidate}
          className="flex-1 relative overflow-hidden group p-[1px] rounded-2xl bg-gradient-to-r from-white/10 to-white/5"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500 group-hover:scale-105"></div>
          
          <div className="relative bg-[#0f172a]/20 backdrop-blur-sm h-[54px] rounded-[15px] flex items-center justify-center gap-3">
            <span className="text-white font-bold text-[12px] tracking-[0.25em] uppercase">
              Davom Etish
            </span>
            <ArrowRight className="text-white group-hover:translate-x-1 transition-transform" size={18} />
          </div>
          <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/10 opacity-40 group-hover:animate-shine" />
        </motion.button>
      </div>
    </motion.div>
  )
}