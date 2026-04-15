'use client'

import React, { useState } from 'react'
import { RegisterData } from './types'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check, ArrowRight } from 'lucide-react'

interface Props {
  data: RegisterData
  onChange: (d: Partial<RegisterData>) => void
  onNext: () => void
  onBack: () => void
}

export default function Step6Date({ data, onChange, onNext, onBack }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [view, setView] = useState<'days' | 'months' | 'years'>('days')

  const monthNames = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"]
  
  // Yillar ro'yxati (Kattaroq diapazon)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 12 }, (_, i) => currentYear - 5 + i)

  // Kalendar hisob-kitoblari
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  // Dushanbadan boshlanishi uchun (Uzbekistan standard)
  const blanks = Array.from({ length: firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1 }, (_, i) => i)

  const formatDate = (day: number, month: number, year: number) => {
    const d = day < 10 ? `0${day}` : day
    const m = (month + 1) < 10 ? `0${month + 1}` : month + 1
    return `${d}.${m}.${year}`
  }

  const handleDateClick = (day: number) => {
    const formattedDate = formatDate(day, currentMonth.getMonth(), currentMonth.getFullYear())
    onChange({ entryDate: formattedDate })
  }

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentMonth.setMonth(currentMonth.getMonth() + offset))
    setCurrentMonth(new Date(newDate))
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
        <div className="flex items-center gap-3 bg-white/[0.03] p-2.5 rounded-2xl border border-white/[0.05]">
          <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl border border-emerald-500/20 text-emerald-400 flex-shrink-0">
            <CalendarIcon size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[14px] font-bold text-white truncate">Kirish sanasi</h2>
            <p className="text-[9px] text-emerald-400/80 font-black uppercase tracking-wider">Qadam 06 / 07</p>
          </div>
        </div>
      </div>

      {/* Calendar Card */}
      <div className="bg-[#0f172a]/40 backdrop-blur-xl rounded-[1.5rem] border border-white/[0.08] overflow-hidden">
        <div className="p-4">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setView(view === 'months' ? 'days' : 'months')}
                className="text-white font-bold text-[12px] uppercase bg-white/5 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                {monthNames[currentMonth.getMonth()]}
              </button>
              <button
                onClick={() => setView(view === 'years' ? 'days' : 'years')}
                className="text-emerald-400 font-bold text-[12px] bg-emerald-500/5 px-2 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors"
              >
                {currentMonth.getFullYear()}
              </button>
            </div>

            <div className="flex gap-1">
              <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white"><ChevronLeft size={16} /></button>
              <button onClick={() => changeMonth(1)} className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white"><ChevronRight size={16} /></button>
            </div>
          </div>

          <div className="min-h-[220px]">
            <AnimatePresence mode="wait">
              {view === 'days' && (
                <motion.div key="days" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="grid grid-cols-7 mb-2">
                    {['D', 'S', 'C', 'P', 'J', 'S', 'Y'].map((d, i) => (
                      <div key={i} className="text-[10px] font-bold text-slate-600 text-center">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {blanks.map(i => <div key={`b-${i}`} />)}
                    {days.map(day => (
                      <button
                        key={day}
                        onClick={() => handleDateClick(day)}
                        className={`aspect-square rounded-lg flex items-center justify-center text-[13px] font-bold transition-all
                          ${isSelected(day) ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}
                        `}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {view === 'months' && (
                <motion.div key="months" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-3 gap-2">
                  {monthNames.map((m, i) => (
                    <button 
                      key={m} 
                      onClick={() => {
                        const nextDate = new Date(currentMonth);
                        nextDate.setMonth(i);
                        setCurrentMonth(nextDate);
                        setView('days');
                      }} 
                      className={`py-3 rounded-xl text-[11px] font-bold uppercase transition-all ${currentMonth.getMonth() === i ? 'bg-emerald-500 text-white' : 'text-slate-500 bg-white/5 hover:bg-white/10'}`}
                    >
                      {m.substring(0, 3)}
                    </button>
                  ))}
                </motion.div>
              )}

              {view === 'years' && (
                <motion.div key="years" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-3 gap-2">
                  {years.map(y => (
                    <button 
                      key={y} 
                      onClick={() => {
                        const nextDate = new Date(currentMonth);
                        nextDate.setFullYear(y);
                        setCurrentMonth(nextDate);
                        setView('days');
                      }} 
                      className={`py-3 rounded-xl text-[12px] font-bold transition-all ${currentMonth.getFullYear() === y ? 'bg-emerald-500 text-white' : 'text-slate-500 bg-white/5 hover:bg-white/10'}`}
                    >
                      {y}
                    </button>
                  ))}
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
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full flex items-center gap-2">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Sana:</span>
              <span className="text-white font-bold text-[13px]">{data.entryDate}</span>
              <Check size={12} className="text-emerald-400" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all">←</button>
        <button
          disabled={!data.entryDate}
          onClick={onNext}
          className={`flex-1 h-12 rounded-xl font-bold text-[11px] tracking-widest uppercase transition-all flex items-center justify-center gap-2
            ${data.entryDate ? 'bg-emerald-600 text-white' : 'bg-white/5 text-slate-700 opacity-40'}
          `}
        >
          Davom Etish <ArrowRight size={16} />
        </button>
      </div>
    </motion.div>
  )
}