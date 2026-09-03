'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck, UserCheck } from 'lucide-react'
import type { RegisterData } from './types'
import { getPasswordPolicyError, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/password-policy'
import { stepLabel } from './constants'
import PasswordStrength from '@/components/PasswordStrength'
import { useThemeStore } from '@/lib/stores/theme-store'

interface Props {
  data: RegisterData
  password: string
  confirmPassword: string
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onSubmit: () => void
  onBack: () => void
  loading: boolean
  stepNumber?: number
  totalSteps?: number
}

export default function Step9Password({
  data,
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onBack,
  loading,
  stepNumber = 8,
  totalSteps = 8,
}: Props) {
  const [show, setShow] = useState(false)
  const isLight = useThemeStore((s) => s.theme) === 'light'

  const policyOk = getPasswordPolicyError(password) === null
  const matches = password.length > 0 && password === confirmPassword
  const canSubmit = policyOk && matches && !loading

  const inputCls = `w-full rounded-2xl border bg-transparent p-3.5 pl-12 pr-12 text-sm outline-none transition-all ${
    isLight
      ? 'bg-white border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
      : 'bg-white/[0.03] border-white/10 text-white focus:border-blue-500/50'
  }`

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 font-sans">
      {/* Header */}
      <div className={`flex items-center gap-3 rounded-2xl border p-2.5 ${isLight ? 'bg-white border-slate-200' : 'border-white/5 bg-white/[0.02]'}`}>
        <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
          <ShieldCheck size={18} />
        </div>
        <div>
          <h2 className={`text-[14px] font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Parol yarating</h2>
          <p className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-sky-600/80' : 'text-emerald-400/80'}`}>
            {stepLabel(stepNumber, totalSteps)}
          </p>
        </div>
      </div>

      {/* Known email (read-only) */}
      {data.email ? (
        <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/8 bg-white/[0.02]'}`}>
          <Mail size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-wider text-slate-500">Arizadagi email</p>
            <p className={`truncate text-[12px] font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{data.email}</p>
          </div>
        </div>
      ) : null}

      {/* New password */}
      <div className="space-y-1.5">
        <label className="ml-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Yangi parol</label>
        <div className="relative">
          <Lock size={15} className={`absolute left-4 top-1/2 z-10 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-600'}`} />
          <input
            type={show ? 'text' : 'password'}
            name="new-password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Kuchli parol"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className={`absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-lg p-1 ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <PasswordStrength password={password} isLight={isLight} />
      </div>

      {/* Confirm */}
      <div className="space-y-1.5">
        <label className="ml-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Parolni tasdiqlang</label>
        <div className="relative">
          <Lock size={15} className={`absolute left-4 top-1/2 z-10 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-600'}`} />
          <input
            type={show ? 'text' : 'password'}
            name="confirm-password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            value={confirmPassword}
            onChange={(e) => onConfirmPasswordChange(e.target.value)}
            placeholder="Yana bir marta"
            className={`${inputCls} pr-4 ${
              confirmPassword.length > 0 ? (matches ? 'border-emerald-500/50!' : 'border-rose-500/50!') : ''
            }`}
          />
        </div>
        {confirmPassword.length > 0 && !matches && (
          <p className="ml-1 text-[10px] font-semibold text-rose-400">Parollar bir-biriga mos kelmadi</p>
        )}
      </div>

      <div className={`rounded-xl border p-3 text-[9px] leading-relaxed ${isLight ? 'border-blue-200 bg-blue-50 text-slate-600' : 'border-blue-500/15 bg-blue-500/5 text-slate-400'}`}>
        Ro&apos;yxatdan o&apos;tgach tizimga avtomatik kirasiz — email tasdiqlash havolasini kutish shart emas.
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          aria-label="Orqaga"
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:opacity-40 ${
            isLight ? 'border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200' : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <ArrowLeft size={17} />
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          ) : (
            <>
              <UserCheck size={15} />
              Ro&apos;yxatdan o&apos;tish
            </>
          )}
        </button>
      </div>
    </motion.div>
  )
}
