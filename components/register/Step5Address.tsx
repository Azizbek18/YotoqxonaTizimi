'use client'

import React, { useState } from 'react'
import { RegisterData } from './types'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Navigation, Home, Hash, ChevronDown, Check, Globe, ArrowRight, Sparkles, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  data: RegisterData
  onChange: (d: Partial<RegisterData>) => void
  onNext: () => void
  onBack: () => void
}

const DISTRICTS: Record<string, string[]> = {
  'Toshkent shahri': ["Chilonzor","Yunusobod","Mirobod","Yakkasaroy","Shayxontohur","Olmazor","Uchtepa","Sergeli","Bektemir","Mirzo Ulug'bek","Yashnobod"],
  'Toshkent viloyati': ["Angren","Bekobod","Bo'ka","Bo'stonliq","Chinoz","Ohangaron","Oqqo'rg'on","Parkent","Piskent","Quyichirchiq","Toshkent tumani","Yuqorichirchiq","Zangiota"],
  'Samarqand': ["Samarqand sh.","Urgut","Kattaqo'rg'on","Bulung'ur","Ishtixon","Narpay","Oqdaryo","Pastdarg'om","Payariq","Qo'shrabot"],
}

const REGIONS = Object.keys(DISTRICTS)
const MAHALLAS = ['1-mahalla','2-mahalla','Bog\'iston mahallasi','Markaziy mahalla']
const STREETS = ["Mustaqillik ko'chasi","Navoi ko'chasi","Amir Temur shoh ko'chasi"]

const Custom3DSelect = ({ label, value, options, onChange, icon: Icon, placeholder }: any) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative space-y-1.5 flex-1 font-sans">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">{label}</label>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full bg-white/[0.02] border border-white/[0.08] backdrop-blur-xl
            p-3 rounded-xl flex items-center justify-between text-white text-[13px]
            transition-all duration-500 hover:bg-white/[0.04]
            ${isOpen ? 'border-sky-500/40 bg-white/[0.04] ring-[4px] ring-sky-500/5' : ''}
          `}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`flex-shrink-0 p-1.5 rounded-lg ${value ? 'bg-sky-500/20 text-sky-400' : 'bg-white/5 text-slate-600'}`}>
              <Icon size={14} />
            </div>
            <span className={`truncate font-semibold tracking-wide ${!value ? 'text-slate-600' : 'text-white'}`}>
              {value || placeholder}
            </span>
          </div>
          <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-500 ${isOpen ? 'rotate-180 text-sky-400' : 'text-slate-700'}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} 
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 4 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute z-[70] w-full bg-[#0f172a] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden"
              >
                <div className="max-h-[180px] overflow-y-auto p-1.5 custom-scrollbar">
                  {options.map((opt: string) => {
                    const isActive = opt === value;
                    return (
                      <button
                        key={opt}
                        onClick={() => { onChange(opt); setIsOpen(false) }}
                        className={`
                          w-full flex items-center justify-between p-2.5 rounded-lg text-left text-[12px] transition-all duration-300 mb-0.5 last:mb-0
                          ${isActive ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-white/5'}
                        `}
                      >
                        <span className={isActive ? 'font-bold' : ''}>{opt}</span>
                        {isActive && <Check size={14} />}
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function Step5Address({ data, onChange, onNext, onBack }: Props) {
  
  // 3D Toast funksiyasi
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
                  {type === 'success' ? 'Tayyor' : 'Manzil chala'}
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

  const handleRegionChange = (region: string) => {
    onChange({ region, district: '', mahalla: '', street: '', houseNumber: '' })
  }

  const handleValidate = () => {
    if (!data.region) return show3DToast("Viloyatni tanlang", 'error')
    if (!data.district) return show3DToast("Tuman yoki shaharni tanlang", 'error')
    if (!data.mahalla) return show3DToast("Mahallani kiriting", 'error')
    if (!data.street) return show3DToast("Ko'cha nomini kiriting", 'error')
    if (!data.houseNumber) return show3DToast("Uy raqamini kiriting", 'error')

    onNext()
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="space-y-5 font-sans"
    >
      {/* Header */}
      <div className="relative">
        <div className="flex items-center gap-3 bg-white/[0.03] p-2 rounded-2xl border border-white/[0.05]">
          <div className="p-2 bg-gradient-to-br from-sky-500/20 to-indigo-500/20 rounded-xl border border-sky-500/20 text-sky-400">
            <Globe size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[14px] font-bold text-white truncate">Yashash manzili</h2>
            <p className="text-[9px] text-sky-400/80 font-black uppercase tracking-wider">Qadam 05 / 07</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Custom3DSelect 
          label="Viloyat" 
          value={data.region} 
          options={REGIONS} 
          icon={MapPin} 
          placeholder="Viloyat"
          onChange={handleRegionChange} 
        />

        <AnimatePresence mode="wait">
          {data.region && (
            <motion.div 
              key={data.region}
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <Custom3DSelect 
                label="Tuman / Shahar" 
                value={data.district} 
                options={DISTRICTS[data.region] || []} 
                icon={Navigation} 
                placeholder="Tuman"
                onChange={(v: string) => onChange({ district: v })} 
              />
              
              {data.district && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <Custom3DSelect 
                    label="Mahalla" 
                    value={data.mahalla} 
                    options={MAHALLAS} 
                    icon={Home} 
                    placeholder="Mahalla"
                    onChange={(v: string) => onChange({ mahalla: v })} 
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-4">
                    <Custom3DSelect 
                      label="Ko'cha" 
                      value={data.street} 
                      options={STREETS} 
                      icon={Navigation} 
                      placeholder="Ko'cha"
                      onChange={(v: string) => onChange({ street: v })} 
                    />
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">Uy</label>
                      <div className="relative flex items-center">
                        <Hash className="absolute left-4 z-10 text-slate-600 pointer-events-none" size={14} />
                        <input
                          className="w-full bg-white/[0.02] border border-white/[0.08] p-3 pl-11 rounded-xl text-white text-[13px] font-semibold outline-none focus:border-sky-500/40 transition-all"
                          placeholder="14A"
                          value={data.houseNumber}
                          onChange={e => onChange({ houseNumber: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all"
        >
          ←
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleValidate}
          className={`
            flex-1 relative overflow-hidden h-[48px] rounded-xl transition-all duration-500 group
            bg-gradient-to-r from-sky-600 to-indigo-600 hover:shadow-lg hover:shadow-sky-500/20
          `}
        >
          <div className="relative flex items-center justify-center gap-2">
            <span className="font-bold text-[11px] tracking-widest uppercase text-white">
              Davom Etish
            </span>
            <ArrowRight size={16} className="text-white group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.button>
      </div>
    </motion.div>
  )
}