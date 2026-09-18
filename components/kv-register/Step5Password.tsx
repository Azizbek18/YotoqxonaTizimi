'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck, UserCheck } from 'lucide-react'
import { getPasswordPolicyError, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/password-policy'
import { stepLabel } from '@/components/register/constants'
import PasswordStrength from '@/components/PasswordStrength'
import { useThemeStore } from '@/lib/stores/theme-store'
import type { KvRegisterData } from './types'

interface Props {
  data: KvRegisterData
  password: string
  confirmPassword: string
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onSubmit: () => void
  onBack: () => void
  loading: boolean
  stepNumber: number
  totalSteps: number
}

export default function Step5Password({
  data, password, confirmPassword, onPasswordChange, onConfirmPasswordChange, onSubmit, onBack, loading, stepNumber, totalSteps,
}: Props) {
  const [show, setShow] = useState(false)
  const isLight = useThemeStore((s) => s.theme) === 'light'

  const policyOk = getPasswordPolicyError(password) === null
  const matches = password.length > 0 && password === confirmPassword
  const canSubmit = policyOk && matches && !loading

  const labelClass = 'text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1 block'
  const inputCls = `w-full rounded-xl border p-3 pl-11 pr-11 text-[13px] font-medium outline-none transition-all ${
    isLight
      ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400'
      : 'bg-white/[0.04] border-white/12 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500'
  }`

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 font-sans px-1">
      {/* Step Header */}
      <div className="flex items-center gap-2.5 pb-1">
        <div className="rounded-xl bg-blue-500/15 p-2 text-blue-600 dark:text-blue-400">
          <ShieldCheck size={17} />
        </div>
        <div>
          <h2 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Hisob xavfsizligi (Parol)
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Profilingizni himoyalash uchun parol o‘rnating</p>
        </div>
        <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-200/60 dark:border-blue-500/20">
          {stepLabel(stepNumber, totalSteps)}
        </span>
      </div>

      {data.email ? (
        <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 ${isLight ? 'border-blue-100 bg-blue-50/60 text-blue-950' : 'border-blue-500/20 bg-blue-500/10 text-blue-200'}`}>
          <Mail size={15} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Ro‘yxatdan o‘tuvchi email</p>
            <p className={`truncate text-[12px] font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{data.email}</p>
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label className={labelClass}>Yangi parol</label>
        <div className="relative">
          <Lock size={16} className={`absolute left-3.5 top-1/2 z-10 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            type={show ? 'text' : 'password'}
            name="new-password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Kamida 8 ta belgi"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className={`absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-lg p-1 transition-colors ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <PasswordStrength password={password} isLight={isLight} />
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}>Parolni qayta kiriting</label>
        <div className="relative">
          <Lock size={16} className={`absolute left-3.5 top-1/2 z-10 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            type={show ? 'text' : 'password'}
            name="confirm-password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            value={confirmPassword}
            onChange={(e) => onConfirmPasswordChange(e.target.value)}
            placeholder="Parolni tasdiqlang"
            className={`${inputCls} pr-4 ${confirmPassword.length > 0 ? (matches ? 'border-emerald-500/60! ring-2 ring-emerald-100 dark:ring-emerald-500/20' : 'border-rose-500/60! ring-2 ring-rose-100 dark:ring-rose-500/20') : ''}`}
          />
        </div>
        {confirmPassword.length > 0 && !matches && (
          <p className="ml-1 text-[11px] font-semibold text-rose-500">Parollar bir-biriga mos kelmadi</p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          aria-label="Orqaga"
          className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-all ${
            isLight
              ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
          } disabled:opacity-40`}
          title="Orqaga"
        >
          <ArrowLeft size={18} />
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex-1 h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          ) : (
            <>
              <UserCheck size={16} />
              <span>Ro‘yxatdan o‘tishni yakunlash</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  )
}
