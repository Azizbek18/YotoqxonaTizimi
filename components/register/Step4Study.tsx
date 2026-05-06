'use client'

import React, { useState } from 'react'
import { RegisterData } from './types'
import { motion, AnimatePresence } from 'framer-motion'
import { GraduationCap, BookOpen, ChevronDown, Check, ArrowRight, Sparkles, ShieldAlert, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'

interface Props {
  data: RegisterData
  onChange: (d: Partial<RegisterData>) => void
  onNext: () => void
  onBack: () => void
}

const FACULTIES = [
  { value: 'matematika', label: 'Matematika' },
  { value: 'amaliy-matematika', label: 'Amaliy matematika va intellektual texnologiyalar' },
  { value: 'fizika', label: 'Fizika' },
  { value: 'kimyo', label: 'Kimyo' },
  { value: 'biologiya', label: 'Biologiya' },
  { value: 'geologiya', label: 'Geologiya' },
  { value: 'geografiya', label: 'Geografiya va tabiiy resurslar' },
  { value: 'tarix', label: 'Tarix' },
  { value: 'ijtimoiy-fanlar', label: 'Ijtimoiy fanlar' },
  { value: 'huquq', label: 'Huquqshunoslik' },
  { value: 'iqtisod', label: 'Iqtisodiyot' },
  { value: 'filologiya', label: 'O‘zbek filologiyasi' },
  { value: 'xorijiy-filologiya', label: 'Xorijiy filologiya' },
  { value: 'jurnalistika', label: 'Jurnalistika va ommaviy kommunikatsiyalar' },
  { value: 'sharqshunoslik', label: 'Sharqshunoslik' },
  { value: 'axborot-texnologiyalari', label: 'Axborot texnologiyalari va sun’iy intellekt' },
  { value: 'kiberxavfsizlik', label: 'Kiberxavfsizlik va raqamli kriminalistika' },
]

const DIRECTIONS: Record<string, Option[]> = {
  matematika: [
    { value: 'matematik-tahlil', label: 'Matematik tahlil' },
    { value: 'funksional-tahlil', label: 'Funksional tahlil' },
    { value: 'differensial-tenglamalar', label: 'Differensial tenglamalar' },
  ],
  'amaliy-matematika': [
    { value: 'amaliy-matematika', label: 'Amaliy matematika' },
    { value: 'dasturiy-injiniring', label: 'Dasturiy injiniring' },
    { value: 'suniy-intellekt', label: 'Sun’iy intellekt' },
    { value: 'kompyuter-ilmlari', label: 'Kompyuter ilmlari' },
    { value: 'axborot-xavfsizligi', label: 'Axborot xavfsizligi' },
  ],
  fizika: [
    { value: 'nazariy-fizika', label: 'Nazariy fizika' },
    { value: 'atom-fizikasi', label: 'Atom va molekulyar fizika' },
    { value: 'energetika', label: 'Energetika' },
  ],
  kimyo: [
    { value: 'organik-kimyo', label: 'Organik kimyo' },
    { value: 'analitik-kimyo', label: 'Analitik kimyo' },
    { value: 'noorganik-kimyo', label: 'Noorganik kimyo' },
  ],
  biologiya: [
    { value: 'genetika', label: 'Genetika' },
    { value: 'mikrobiologiya', label: 'Mikrobiologiya' },
    { value: 'biotexnologiya', label: 'Biotexnologiya' },
  ],
  geologiya: [
    { value: 'geologiya-umumiy', label: 'Umumiy geologiya' },
    { value: 'kon-geologiyasi', label: 'Kon geologiyasi' },
    { value: 'gidrogeologiya', label: 'Gidrogeologiya' },
  ],
  geografiya: [
    { value: 'geoekologiya', label: 'Geoekologiya' },
    { value: 'geoinformatika', label: 'Geoinformatika' },
    { value: 'turizm', label: 'Turizm' },
  ],
  tarix: [
    { value: 'uzbekiston-tarixi', label: 'O‘zbekiston tarixi' },
    { value: 'jahon-tarixi', label: 'Jahon tarixi' },
    { value: 'arxeologiya', label: 'Arxeologiya' },
  ],
  'ijtimoiy-fanlar': [
    { value: 'sotsiologiya', label: 'Sotsiologiya' },
    { value: 'psixologiya', label: 'Psixologiya' },
    { value: 'falsafa', label: 'Falsafa' },
  ],
  huquq: [
    { value: 'fuqarolik-huquqi', label: 'Fuqarolik huquqi' },
    { value: 'jinoyat-huquqi', label: 'Jinoyat huquqi' },
    { value: 'xalqaro-huquq', label: 'Xalqaro huquq' },
  ],
  iqtisod: [
    { value: 'iqtisodiyot', label: 'Iqtisodiyot' },
    { value: 'moliya', label: 'Moliya' },
    { value: 'menejment', label: 'Menejment' },
    { value: 'marketing', label: 'Marketing' },
  ],
  filologiya: [
    { value: 'ozbek-filologiyasi', label: 'O‘zbek filologiyasi' },
    { value: 'ozbek-tilshunosligi', label: 'O‘zbek tilshunosligi' },
    { value: 'adabiyotshunoslik', label: 'Adabiyotshunoslik' },
  ],
  'xorijiy-filologiya': [
    { value: 'ingliz-filologiyasi', label: 'Ingliz filologiyasi' },
    { value: 'nemis-filologiyasi', label: 'Nemis filologiyasi' },
    { value: 'fransuz-filologiyasi', label: 'Fransuz filologiyasi' },
  ],
  jurnalistika: [
    { value: 'televideniye', label: 'Televideniye' },
    { value: 'radio', label: 'Radio jurnalistikasi' },
    { value: 'multimedia', label: 'Multimedia jurnalistikasi' },
  ],
  sharqshunoslik: [
    { value: 'arabshunoslik', label: 'Arabshunoslik' },
    { value: 'xitoyshunoslik', label: 'Xitoyshunoslik' },
    { value: 'turkshunoslik', label: 'Turkshunoslik' },
  ],
  'axborot-texnologiyalari': [
    { value: 'dasturiy-injiniring', label: 'Dasturiy injiniring' },
    { value: 'kompyuter-tarmoqlari', label: 'Kompyuter tarmoqlari' },
    { value: 'suniy-intellekt', label: 'Sun’iy intellekt' },
  ],
  kiberxavfsizlik: [
    { value: 'kiberxavfsizlik', label: 'Kiberxavfsizlik' },
    { value: 'raqamli-forensika', label: 'Raqamli forensika' },
  ],
}

const STUDY_TYPES = [
  { value: 'grant', label: 'Davlat granti' },
  { value: 'kontrakt', label: "To'lov-shartnoma" },
]

const ALL_DIRECTION_OPTIONS: Option[] = Object.values(DIRECTIONS).flat()

// PREMIUM SELECT COMPONENT
interface Option {
  value: string
  label: string
}

interface CompactSelectProps {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
  icon: React.ComponentType<{ size: number; className?: string }>
  isLight: boolean
}

const CompactSelect = ({ label, value, options, onChange, icon: Icon, isLight }: CompactSelectProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const selectedLabel = options.find((o: Option) => o.value === value)?.label || value

  return (
    <div className="relative flex-1 font-sans">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1 mb-2 block">
        {label}
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full backdrop-blur-xl p-3.5 rounded-2xl flex items-center justify-between transition-all duration-500
          ${isLight ? 'bg-white/90 border border-slate-200 text-slate-900' : 'bg-white/1 border border-white/8 text-white'}
          ${isOpen ? (isLight ? 'border-sky-500/40 bg-white/95 ring-4 ring-sky-500/10' : 'border-blue-500/40 bg-white/4 ring-4 ring-blue-500/5') : (isLight ? 'hover:border-slate-300' : 'hover:border-white/20')}
        `}
      >
        <div className="flex items-center gap-3 truncate min-w-0">
          <div className={`p-1.5 rounded-lg transition-colors ${isOpen ? (isLight ? 'bg-sky-500/10 text-sky-600' : 'bg-blue-500/20 text-blue-400') : (isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-500')}`}>
            <Icon size={14} className="shrink-0" />
          </div>
          <span className={`truncate text-[14px] font-semibold tracking-wide ${isLight ? 'text-slate-900' : ''}`}>
            {selectedLabel || 'Tanlang'}
          </span>
        </div>
        <ChevronDown size={14} className={`shrink-0 transition-transform duration-500 ${isLight ? 'text-slate-500' : 'text-slate-500'} ${isOpen ? (isLight ? 'rotate-180 text-sky-600' : 'rotate-180 text-blue-400') : ''}`} />
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
              className={`absolute z-30 w-full backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden ${isLight ? 'bg-white/95 border border-slate-200' : 'bg-[#0f172a]/90 border border-white/8'}`}
            >
              <div className="max-h-55 overflow-y-auto p-1.5 custom-scrollbar">
                {options.map((opt: Option) => {
                  const val = opt.value
                  const lab = opt.label
                  const isActive = val === value
                  return (
                    <button
                      key={val}
                      onClick={() => { onChange(val); setIsOpen(false) }}
                      className={`
                        w-full flex items-center justify-between p-3 rounded-xl text-[13px] font-medium transition-all duration-300 mb-0.5 last:mb-0
                        ${isActive ? (isLight ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20') : (isLight ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200')}
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
            className="relative group cursor-pointer z-9999 w-[92vw] max-w-100 mx-auto"
          >
            <div className={`absolute -inset-1 rounded-2xl blur-md opacity-30 transition duration-1000 ${type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
              }`} />

            <div className="relative bg-[#1e293b]/95 backdrop-blur-2xl border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center gap-3">
              <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${type === 'success'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                }`}>
                {type === 'success' ? <Sparkles size={20} /> : <ShieldAlert size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[9px] font-black uppercase tracking-[0.15em] mb-0.5 ${type === 'success' ? 'text-emerald-400' : 'text-rose-400'
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
        <div className="absolute -inset-2 bg-linear-to-r from-blue-500/20 to-indigo-500/20 rounded-4xl blur-xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
        <div className="relative flex items-center gap-5 bg-white/2 p-2 rounded-3xl border border-white/5 backdrop-blur-2xl">
          <div className="relative p-3.5 bg-linear-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl border border-blue-500/20 text-blue-400">
            <GraduationCap size={22} />
          </div>
          <div>
            <h2 className={`text-base font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>O&apos;quv ma&apos;lumotlari</h2>
            <p className={`text-[10px] font-black uppercase tracking-[0.2em] mt-1 ${isLight ? 'text-sky-600/80' : 'text-blue-400/80'}`}>
              Qadam 04 <span className={`${isLight ? 'text-slate-400' : 'text-slate-600'} mx-1`}>/</span> 07
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
          isLight={isLight}
          onChange={(f: string) => onChange({ faculty: f, direction: DIRECTIONS[f]?.[0]?.value ?? '' })}
        />

        {/* YO'NALISH */}
        <CompactSelect
          label="Yo'nalish"
          value={data.direction}
          options={DIRECTIONS[data.faculty] || ALL_DIRECTION_OPTIONS}
          icon={BookOpen}
          isLight={isLight}
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
                    ? (isLight ? 'bg-sky-500 border-sky-300 text-white shadow-[0_10px_20px_rgba(56,189,248,0.22)]' : 'bg-blue-600 border-blue-400 text-white shadow-[0_10px_20px_rgba(59,130,246,0.3)]')
                    : (isLight ? 'bg-white/90 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100' : 'bg-white/2 border-white/8 text-slate-500 hover:border-white/20 hover:bg-white/5')
                  }
                `}
              >
                {c}
                {data.course === c && (
                  <motion.div layoutId="course-glow" className={`absolute inset-0 blur-md rounded-2xl ${isLight ? 'bg-sky-400/15' : 'bg-blue-400/20'}`} />
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
            isLight={isLight}
            onChange={(val: string) => onChange({ study_type: val })}
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-4 pt-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className={`h-14 w-14 flex items-center justify-center rounded-2xl border transition-all shadow-inner ${isLight ? 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}
        >
          ←
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.01, translateY: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleValidate}
          className={`flex-1 relative overflow-hidden group p-px rounded-2xl ${isLight ? 'bg-linear-to-r from-sky-500 to-indigo-500' : 'bg-linear-to-r from-white/10 to-white/5'}`}
        >
          <div className={`absolute inset-0 transition-all duration-500 group-hover:scale-105 ${isLight ? 'bg-linear-to-r from-sky-500 to-indigo-500' : 'bg-linear-to-r from-blue-600 to-indigo-600'}`}></div>

          <div className={`relative backdrop-blur-sm h-13.5 rounded-[15px] flex items-center justify-center gap-3 ${isLight ? 'bg-white/90' : 'bg-[#0f172a]/20'}`}>
            <span className={`font-bold text-[12px] tracking-[0.25em] uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Davom Etish
            </span>
            <ArrowRight className={`${isLight ? 'text-blue-600' : 'text-white'} group-hover:translate-x-1 transition-transform`} size={18} />
          </div>
          <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-linear-to-r from-transparent to-white/10 opacity-40 group-hover:animate-shine" />
        </motion.button>
      </div>
    </motion.div>
  )
}