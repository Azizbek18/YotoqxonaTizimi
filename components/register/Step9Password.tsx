'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, Mail, Send, ShieldCheck } from 'lucide-react'
import type { RegisterData } from './types'

interface Props {
  data: RegisterData
  onChange: (data: Partial<RegisterData>) => void
  onSubmit: () => void
  onBack: () => void
  loading: boolean
}

export default function Step9EmailVerification({ data, onChange, onSubmit, onBack, loading }: Props) {
  const [focused, setFocused] = useState(false)
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
        <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
          <ShieldCheck size={17} />
        </div>
        <div>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-white">
            Email orqali xavfsiz tasdiqlash
          </h2>
          <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
            Parolni faqat emailingizga kelgan himoyalangan havola orqali yaratasiz.
          </p>
        </div>
      </div>

      <div className={`cyber-border ${focused ? 'focused' : ''}`}>
        <div className="cyber-input-inner relative">
          <Mail
            size={16}
            className={`absolute left-4 top-1/2 z-10 -translate-y-1/2 ${focused ? 'text-blue-400' : 'text-slate-500'}`}
          />
          <input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            required
            placeholder="Tasdiqlangan arizadagi email"
            value={data.email}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(event) => onChange({ email: event.target.value })}
            className={`w-full rounded-xl border bg-transparent p-3.5 pl-12 pr-12 text-sm text-white outline-none ${
              data.email
                ? isEmailValid ? 'border-emerald-500/40' : 'border-rose-500/40'
                : 'border-transparent'
            }`}
          />
          {isEmailValid && (
            <Check
              size={15}
              strokeWidth={3}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500"
            />
          )}
        </div>
      </div>

      <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-3 text-[9px] leading-relaxed text-slate-400">
        Havola faqat tasdiqlangan yo‘llanmadagi emailga yuboriladi. Havolani ochgach
        kuchli parol yaratasiz va akkauntingiz avtomatik faollashadi.
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          aria-label="Orqaga"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-colors hover:text-white disabled:opacity-40"
        >
          <ArrowLeft size={17} />
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!isEmailValid || loading}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          ) : (
            <>
              <Send size={14} />
              Havolani yuborish
            </>
          )}
        </button>
      </div>
    </motion.div>
  )
}
