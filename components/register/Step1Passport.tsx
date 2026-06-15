'use client'

import React, { useState } from 'react'
import { RegisterData } from './types'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { Fingerprint, MapPin, CreditCard, Sparkles, ArrowRight, ShieldAlert, Info, Calendar as CalendarIcon } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'

interface Props {
    data: RegisterData
    onChange: (data: Partial<RegisterData>) => void
    onNext: () => void
}

export default function Step1Passport({ data, onChange, onNext }: Props) {
    // Har bir maydon uchun alohida focus holati
    const [focusedField, setFocusedField] = useState<'place' | 'date' | null>(null)
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
                        className="relative z-9999 w-[92vw] max-w-100 mx-auto"
                    >
                        <div className={`absolute -inset-1 rounded-2xl blur-md opacity-30 ${type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <div className="relative bg-[#1e293b]/95 backdrop-blur-2xl border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center gap-3">
                            <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                                {type === 'success' ? <Sparkles size={20} /> : <ShieldAlert size={20} />}
                            </div>
                            <div className="flex-1">
                                <p className={`text-[9px] font-black uppercase tracking-widest ${type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>{type === 'success' ? 'Muvaffaqiyatli' : 'Xatolik'}</p>
                                <p className="text-slate-200 text-[12px] font-medium leading-tight">{message}</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        ), { duration: 3000, position: 'top-center' });
    }

    const validate = () => {
        const { passportSeries, jshshir, passportPlace, passportDate } = data
        if (!passportSeries || passportSeries.trim().length < 9) return show3DToast("Passport seriyasini to'liq kiriting", 'error')
        if (!jshshir || jshshir.length !== 14) return show3DToast("JSHSHIR 14 ta raqam bo'lishi shart", 'error')
        if (!passportDate) return show3DToast("Passport berilgan sanasini tanlang", 'error')

        const todayStr = new Date().toISOString().split('T')[0]
        if (passportDate > todayStr) return show3DToast("Passport berilgan sanasi kelajakda bo'lishi mumkin emas!", 'error')

        if (!passportPlace || passportPlace.trim().length < 5) return show3DToast("Berilgan joyni aniqroq kiriting", 'error')

        show3DToast("Ma'lumotlar tasdiqlandi!", 'success')
        setTimeout(() => onNext(), 1200)
    }

    const glassInput = `
        w-full bg-white/[0.02] border border-white/[0.08] backdrop-blur-xl
        p-3.5 rounded-xl outline-none text-white placeholder:text-slate-600
        transition-all duration-500 font-sans text-[13px]
        pl-12 focus:border-sky-500/40 focus:bg-white/[0.05] focus:ring-[4px] focus:ring-sky-500/5
        hover:border-white/20
    `

    return (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 font-sans px-1">
            <div className="flex items-center gap-3 bg-white/3 p-2.5 rounded-2xl border border-white/5">
                <div className="p-2 bg-linear-to-br from-sky-500/20 to-indigo-500/20 rounded-xl border border-sky-500/20">
                    <Sparkles className="text-sky-400" size={18} />
                </div>
                <div>
                    <h2 className="text-[14px] font-bold text-white uppercase tracking-tight">Identifikatsiya</h2>
                    <p className="text-[9px] text-sky-400/80 font-black uppercase tracking-widest">Qadam 01 / 09</p>
                </div>
            </div>

            <div className="grid gap-4">
                {/* Passport Seriya */}
                <div className="group space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Passport Seriya</label>
                    <div className="relative flex items-center">
                        <CreditCard className="absolute left-4 z-10 text-slate-500 group-focus-within:text-sky-400 transition-colors" size={16} />
                        <input
                            type="text"
                            className={glassInput}
                            placeholder="AA1234567"
                            maxLength={9}
                            value={data.passportSeries || ''}
                            onChange={e => onChange({ passportSeries: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* JSHSHIR */}
                    <div className="group space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">JSHSHIR</label>
                        <div className="relative flex items-center">
                            <Fingerprint className="absolute left-4 z-10 text-slate-500 group-focus-within:text-sky-400 transition-colors" size={18} />
                            <input
                                type="text"
                                className={glassInput}
                                placeholder="14 ta raqam"
                                maxLength={14}
                                value={data.jshshir || ''}
                                onChange={e => onChange({ jshshir: e.target.value.replace(/\D/g, '') })}
                            />
                        </div>
                    </div>

                    {/* Passport Berilgan Sanasi + TOOLTIP */}
                    <div className="group space-y-1.5 relative">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Berilgan sana</label>
                        <div className="relative flex items-center">
                            <AnimatePresence>
                                {focusedField === 'date' && (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: -8 }} exit={{ opacity: 0, y: 10 }}
                                        className="absolute bottom-full left-0 right-0 z-50 mb-2 pointer-events-none"
                                    >
                                        <div className="bg-[#1e293b]/95 border border-sky-500/30 p-2.5 rounded-xl shadow-2xl backdrop-blur-md">
                                            <p className="text-sky-100 text-[10px] flex items-center gap-2">
                                                <Info size={12} className="text-sky-400" /> Passportning amal qilish muddatini emas, berilgan sanasini tanlang.
                                            </p>
                                        </div>
                                        <div className="absolute -bottom-1 left-6 w-2 h-2 bg-[#1e293b] border-r border-b border-sky-500/30 rotate-45" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <CalendarIcon className="absolute left-4 z-10 text-slate-500 group-focus-within:text-sky-400 transition-colors" size={16} />
                            <input
                                type="date"
                                onFocus={() => setFocusedField('date')}
                                onBlur={() => setFocusedField(null)}
                                className={`${glassInput} appearance-none scheme-dark`}
                                value={data.passportDate || ''}
                                max={new Date().toISOString().split('T')[0]}
                                onChange={e => onChange({ passportDate: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* Berilgan joyi + TOOLTIP */}
                <div className="group space-y-1.5 relative">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Berilgan joyi</label>
                    <div className="relative">
                        <AnimatePresence>
                            {focusedField === 'place' && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: -8 }} exit={{ opacity: 0, y: 10 }}
                                    className="absolute bottom-full left-0 right-0 z-50 mb-2 pointer-events-none"
                                >
                                    <div className="bg-[#1e293b]/95 border border-sky-500/30 p-2.5 rounded-xl shadow-2xl backdrop-blur-md">
                                        <p className="text-sky-100 text-[10px] flex items-center gap-2">
                                            <Info size={12} className="text-sky-400" /> Passportingizning orqa tarafidagi &quot;Berilgan joyi&quot; qismidagi matnni kiriting.
                                        </p>
                                    </div>
                                    <div className="absolute -bottom-1 left-6 w-2 h-2 bg-[#1e293b] border-r border-b border-sky-500/30 rotate-45" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <MapPin className="absolute left-4 top-3.5 z-10 text-slate-500 group-focus-within:text-sky-400 transition-colors" size={17} />
                        <textarea
                            rows={1}
                            onFocus={() => setFocusedField('place')}
                            onBlur={() => setFocusedField(null)}
                            className={`${glassInput} resize-none min-h-12 pt-3.25`}
                            placeholder="Masalan: Toshkent sh. IIBB..."
                            value={data.passportPlace || ''}
                            onChange={e => onChange({ passportPlace: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={validate}
                className={`w-full relative overflow-hidden group p-px rounded-xl mt-2 ${isLight ? 'bg-linear-to-r from-sky-500 to-indigo-500' : 'bg-linear-to-r from-sky-600 to-indigo-600'}`}
            >
                <div className={`relative backdrop-blur-sm py-3.5 rounded-[11px] flex items-center justify-center gap-2 ${isLight ? 'bg-white/90' : 'bg-[#0f172a]/80'}`}>
                    <span className={`font-bold text-[12px] tracking-widest uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>Davom etish</span>
                    <ArrowRight className={`${isLight ? 'text-blue-600' : 'text-white'} group-hover:translate-x-1 transition-transform`} size={16} />
                </div>
            </motion.button>
        </motion.div>
    )
}
