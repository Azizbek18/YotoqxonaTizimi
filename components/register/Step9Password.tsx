'use client'

import { useState } from 'react'
import { RegisterData } from './types'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Eye, EyeOff, Check, ShieldAlert, Sparkles, Fingerprint, Mail } from 'lucide-react'

interface Props {
  data: RegisterData
  onChange: (d: Partial<RegisterData>) => void
  onSubmit: () => void
  onBack: () => void
  loading: boolean
}

function getStrength(pass: string) {
  if (!pass) return [false, false, false, false]
  return [
    /[A-Z]/.test(pass),
    /[0-9]/.test(pass),
    /[^A-Za-z0-9]/.test(pass),
    pass.length >= 6,
  ]
}

const CHECKS_META = [
  { label: 'Katta harf' },
  { label: 'Raqam' },
  { label: 'Belgi (!@#)' },
  { label: 'Kamida 6 ta' },
]

export default function Step7Password({ data, onChange, onSubmit, onBack, loading }: Props) {
  const [showPass, setShowPass] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  const checks = getStrength(data.password ?? '')
  const score = checks.filter(Boolean).length

  const isEmailValid = !!(data.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
  const match = !!(data.password && data.password === data.confirmPassword && data.password.length > 0)
  const mismatch = !!(data.confirmPassword && data.password !== data.confirmPassword)

  const canSubmit = score >= 3 && match && isEmailValid && !loading
  const barColor = score === 4 ? '#10b981' : '#3b82f6'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3 sm:space-y-4"
    >
      {/* Header - Mobil klaviatura uchun dinamik yashiriladi */}
      <AnimatePresence>
        {!isFocused && (
          <motion.div
            initial={{ height: 'auto', opacity: 1, marginBottom: 12 }}
            animate={{ height: 'auto', opacity: 1, marginBottom: 12 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            className="flex items-center gap-3 bg-white/[0.02] p-3 rounded-2xl border border-white/5 overflow-hidden"
          >
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
              <Fingerprint size={16} />
            </div>
            <h2 className="text-[11px] font-black text-white uppercase tracking-widest">
              Xavfsizlik va Tasdiqlash
            </h2>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2.5">
        {/* Email Input */}
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors z-10">
            <Mail size={16} />
          </div>
          <input
            type="email"
            placeholder="Email manzilingiz"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            value={data.email ?? ''}
            onChange={e => onChange({ email: e.target.value })}
            className={`w-full bg-white/[0.01] border p-3.5 pl-12 pr-12 rounded-xl text-white text-sm outline-none transition-all
              ${data.email
                ? isEmailValid
                  ? 'border-emerald-500/40 focus:border-emerald-500/60'
                  : 'border-rose-500/40 focus:border-rose-500/60'
                : 'border-white/10 focus:border-blue-500/40'
              }`}
          />
          <AnimatePresence>
            {isEmailValid && (
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 z-10"
              >
                <Check size={14} strokeWidth={3} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Parol Input va Progress Bar */}
        <div className="space-y-2">
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors z-10">
              <Lock size={16} />
            </div>
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Yangi parol"
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              value={data.password ?? ''}
              onChange={e => onChange({ password: e.target.value })}
              className="w-full bg-white/[0.01] border border-white/10 p-3.5 pl-12 pr-12 rounded-xl text-white text-sm outline-none focus:border-blue-500/40 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-400 transition-colors z-10"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Ixcham Progress Bar */}
          <AnimatePresence>
            {data.password && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-1"
              >
                <div className="flex-1 flex gap-1">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        animate={{ 
                          width: i < score ? '100%' : '0%',
                          backgroundColor: i < score ? barColor : 'transparent' 
                        }}
                        transition={{ duration: 0.4 }}
                        className="h-full"
                      />
                    </div>
                  ))}
                </div>
                <span className={`text-[8px] font-black uppercase ${score === 4 ? 'text-emerald-400' : 'text-blue-400'}`}>
                  {score === 4 ? "Max" : `${score}/4`}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Parolni tasdiqlash */}
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors z-10">
            <Lock size={16} />
          </div>
          <input
            type={showPass ? 'text' : 'password'}
            placeholder="Parolni tasdiqlang"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            value={data.confirmPassword ?? ''}
            onChange={e => onChange({ confirmPassword: e.target.value })}
            className={`w-full p-3.5 pl-12 pr-12 rounded-xl text-white text-sm outline-none transition-all border
              ${data.confirmPassword
                ? match
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-rose-500/40 bg-rose-500/5'
                : 'border-white/10 bg-white/[0.01]'
              }`}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
            <AnimatePresence mode="wait">
              {match && (
                <motion.div key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="text-emerald-500">
                  <Check size={14} strokeWidth={3} />
                </motion.div>
              )}
              {mismatch && (
                <motion.div key="err" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="text-rose-500">
                  <ShieldAlert size={14} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Shartlar (Validator) */}
        <div className={`grid grid-cols-2 gap-x-4 gap-y-2 p-3 bg-black/20 rounded-xl border border-white/5 transition-all ${isFocused ? 'py-2 opacity-90' : 'py-3'}`}>
          {CHECKS_META.map((item, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 transition-all duration-300 ${checks[i] ? 'text-emerald-400' : 'text-slate-600'}`}
            >
              <div className={`w-1 h-1 rounded-full flex-shrink-0 ${checks[i] ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.5)]' : 'bg-slate-700'}`} />
              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-tight">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigatsiya */}
      <div className={`flex gap-3 transition-all ${isFocused ? 'pt-0' : 'pt-2'}`}>
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all disabled:opacity-40"
        >
          ←
        </button>

        <button
          type="button"
          onClick={canSubmit ? onSubmit : undefined}
          disabled={!canSubmit || loading}
          className={`flex-1 relative h-12 rounded-xl font-bold text-[11px] tracking-[0.2em] uppercase flex items-center justify-center gap-2 overflow-hidden transition-all
            ${canSubmit
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/30'
              : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'
            }`}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Sparkles size={14} />
              <span>Tasdiqlash</span>
            </>
          )}
          {canSubmit && !loading && (
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="absolute top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" 
            />
          )}
        </button>
      </div>
    </motion.div>
  )
}