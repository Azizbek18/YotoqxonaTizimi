'use client'

import React, { useState } from 'react'
import { RegisterData } from './types'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check, ArrowRight } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'
import toast from 'react-hot-toast'

interface Props {
  data: RegisterData
  onChange: (d: Partial<RegisterData>) => void
  onNext: () => void
  onBack: () => void
}

export default function Step6Date({ data, onChange, onNext, onBack }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [view, setView] = useState<'days' | 'months' | 'years'>('days')
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const monthNames = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"]

  // Yillar ro'yxati (Kelajak yillar olib tashlandi)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 5 + i)

  // Kalendar hisob-kitoblari
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  // Dushanbadan boshlanishi uchun (Uzbekistan standard)
  const blanks = Array.from({ length: firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1 }, (_, i) => i)

  const formatDate = (day: number, month: number, year: number) => {
    const d = day < 10 ? `0${day}` : day
    const m = (month + 1) < 10 ? `0${month + 1}` : month + 1
    return `${year}-${m}-${d}` // YYYY-MM-DD
  }

  const displayDate = (dateStr?: string) => {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}` // DD.MM.YYYY for display
    }
    return dateStr
  }

  const isFutureDate = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date > today
  }

  const handleDateClick = (day: number) => {
    if (isFutureDate(day)) {
      toast.error("Kelajakdagi sanani tanlab bo'lmaydi!")
      return
    }
    const formattedDate = formatDate(day, currentMonth.getMonth(), currentMonth.getFullYear())
    onChange({ entryDate: formattedDate })
  }

  const changeMonth = (offset: number) => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1)
    const today = new Date()
    const currentLimit = new Date(today.getFullYear(), today.getMonth(), 1)
    if (newMonth > currentLimit) {
      toast.error("Kelajakdagi oylarni tanlab bo'lmaydi!")
      return
    }
    setCurrentMonth(newMonth)
  }

  const isSelected = (day: number) => {
    if (!data.entryDate) return false
    const currentFormatted = formatDate(day, currentMonth.getMonth(), currentMonth.getFullYear())
    return data.entryDate === currentFormatted
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 sm:space-y-6 font-sans"
    >
      {/* Header */}
      <div className="relative">
        <div className={`flex items-center gap-3 p-2.5 rounded-2xl border ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.05]'}`}>
          <div className={`p-2 rounded-xl border flex-shrink-0 ${isLight ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/20 text-emerald-400'}`}>
            <CalendarIcon size={18} />
          </div>
          <div className="min-w-0">
            <h2 className={`text-[14px] font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>Kirish sanasi</h2>
            <p className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-emerald-600/80' : 'text-emerald-400/80'}`}>Qadam 06 / 07</p>
          </div>
        </div>
      </div>

      {/* Calendar Card */}
      <div className={`rounded-[1.5rem] overflow-hidden ${isLight ? 'bg-white/95 border border-slate-200 shadow-sm' : 'bg-[#0f172a]/40 backdrop-blur-xl border border-white/[0.08]'}`}>
        <div className="p-4">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setView(view === 'months' ? 'days' : 'months')}
                className={`font-bold text-[12px] uppercase px-2 py-1 rounded-lg transition-colors ${isLight ? 'text-slate-900 bg-white/90 border border-slate-200 hover:bg-slate-100' : 'text-white bg-white/5 hover:bg-white/10'}`}
              >
                {monthNames[currentMonth.getMonth()]}
              </button>
              <button
                onClick={() => setView(view === 'years' ? 'days' : 'years')}
                className={`font-bold text-[12px] px-2 py-1 rounded-lg transition-colors ${isLight ? 'text-sky-600 bg-sky-50 border border-sky-100 hover:bg-sky-100' : 'text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10'}`}
              >
                {currentMonth.getFullYear()}
              </button>
            </div>

            <div className="flex gap-1">
              <button onClick={() => changeMonth(-1)} className={`p-1.5 rounded-lg ${isLight ? 'bg-slate-100 text-slate-700 hover:text-slate-900' : 'bg-white/5 text-slate-400 hover:text-white'}`}><ChevronLeft size={16} /></button>
              <button onClick={() => changeMonth(1)} className={`p-1.5 rounded-lg ${isLight ? 'bg-slate-100 text-slate-700 hover:text-slate-900' : 'bg-white/5 text-slate-400 hover:text-white'}`}><ChevronRight size={16} /></button>
            </div>
          </div>

          <div className="min-h-[220px]">
            <AnimatePresence mode="wait">
              {view === 'days' && (
                <motion.div key="days" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="grid grid-cols-7 mb-2">
                    {['D', 'S', 'C', 'P', 'J', 'S', 'Y'].map((d, i) => (
                      <div key={i} className={`text-[10px] font-bold text-center ${isLight ? 'text-slate-700' : 'text-slate-600'}`}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {blanks.map(i => <div key={`b-${i}`} />)}
                    {days.map(day => {
                      const disabled = isFutureDate(day)
                      return (
                        <button
                          key={day}
                          disabled={disabled}
                          onClick={() => handleDateClick(day)}
                          className={`aspect-square rounded-lg flex items-center justify-center text-[13px] font-bold transition-all
                            ${isSelected(day)
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                              : disabled
                                ? 'opacity-20 cursor-not-allowed text-slate-500'
                                : (isLight ? 'text-slate-700 bg-white/90 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-400 hover:bg-white/5 hover:text-white')
                            }
                          `}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {view === 'months' && (
                <motion.div key="months" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-3 gap-2">
                  {monthNames.map((m, i) => {
                    const today = new Date()
                    const isFutureMonth = new Date(currentMonth.getFullYear(), i, 1) > new Date(today.getFullYear(), today.getMonth(), 1)
                    return (
                      <button
                        key={m}
                        disabled={isFutureMonth}
                        onClick={() => {
                          const nextDate = new Date(currentMonth);
                          nextDate.setMonth(i);
                          setCurrentMonth(nextDate);
                          setView('days');
                        }}
                        className={`py-3 rounded-xl text-[11px] font-bold uppercase transition-all ${isFutureMonth ? 'opacity-20 cursor-not-allowed text-slate-500' : ''} ${currentMonth.getMonth() === i ? 'bg-emerald-500 text-white' : (isLight ? 'text-slate-700 bg-white/90 hover:bg-slate-100' : 'text-slate-500 bg-white/5 hover:bg-white/10')}`}
                      >
                        {m.substring(0, 3)}
                      </button>
                    )
                  })}
                </motion.div>
              )}

              {view === 'years' && (
                <motion.div key="years" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-3 gap-2">
                  {years.map(y => {
                    const isFutureYear = y > new Date().getFullYear()
                    return (
                      <button
                        key={y}
                        disabled={isFutureYear}
                        onClick={() => {
                          const nextDate = new Date(currentMonth);
                          nextDate.setFullYear(y);
                          setCurrentMonth(nextDate);
                          setView('days');
                        }}
                        className={`py-3 rounded-xl text-[12px] font-bold transition-all ${isFutureYear ? 'opacity-20 cursor-not-allowed text-slate-500' : ''} ${currentMonth.getFullYear() === y ? 'bg-emerald-500 text-white' : (isLight ? 'text-slate-700 bg-white/90 hover:bg-slate-100' : 'text-slate-500 bg-white/5 hover:bg-white/10')}`}
                      >
                        {y}
                      </button>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Selected Badge */}
      <div className="h-10 flex justify-center">
        <AnimatePresence>
          {data.entryDate && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={`${isLight ? 'bg-emerald-50 border-emerald-100' : 'bg-emerald-500/10 border border-emerald-500/20'} px-4 py-1.5 rounded-full flex items-center gap-2`}>
              <span className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>Sana:</span>
              <span className={`font-bold text-[13px] ${isLight ? 'text-slate-900' : 'text-white'}`}>{displayDate(data.entryDate)}</span>
              <Check size={12} className={`${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className={`h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-xl border transition-all ${isLight ? 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}>←</button>
        <button
          disabled={!data.entryDate}
          onClick={onNext}
          className={`flex-1 h-12 rounded-xl font-bold text-[11px] tracking-widest uppercase transition-all flex items-center justify-center gap-2
            ${data.entryDate ? (isLight ? 'bg-linear-to-r from-sky-500 to-indigo-500 text-slate-900' : 'bg-emerald-600 text-white') : (isLight ? 'bg-white/95 text-slate-500 opacity-70' : 'bg-white/5 text-slate-700 opacity-40')}
          `}
        >
          <span className={`${data.entryDate && isLight ? 'text-slate-900' : ''}`}>Davom Etish</span>
          <ArrowRight size={16} className={isLight && data.entryDate ? 'text-blue-600' : ''} />
        </button>
      </div>
    </motion.div>
  )
}