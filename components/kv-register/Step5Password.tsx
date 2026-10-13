'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock, Mail, ShieldCheck, UserCheck } from 'lucide-react'
import { getPasswordPolicyError, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/password-policy'
import PasswordStrength from '@/components/PasswordStrength'
import { useThemeStore } from '@/lib/stores/theme-store'
import { KvActions, KvStepHeader, kvStyles } from './ui'
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
}

export default function Step5Password({
  data, password, confirmPassword, onPasswordChange, onConfirmPasswordChange, onSubmit, onBack, loading,
}: Props) {
  const [show, setShow] = useState(false)
  const isLight = useThemeStore((s) => s.theme) === 'light'
  const s = kvStyles(isLight)

  const policyOk = getPasswordPolicyError(password) === null
  const matches = password.length > 0 && password === confirmPassword
  const canSubmit = policyOk && matches && !loading

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <KvStepHeader icon={ShieldCheck} title="Parol" subtitle="Hisobingizni himoyalash" isLight={isLight} />

      {data.email ? (
        <div className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${isLight ? 'border-blue-100 bg-blue-50/70' : 'border-blue-500/20 bg-blue-500/10'}`}>
          <Mail size={16} className={`shrink-0 ${isLight ? 'text-blue-600' : 'text-blue-300'}`} />
          <p className={`min-w-0 truncate text-sm font-semibold ${s.title}`}>{data.email}</p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label className={s.label}>Yangi parol</label>
        <div className="relative">
          <Lock size={17} className={`pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 ${s.icon}`} />
          <input
            type={show ? 'text' : 'password'}
            name="new-password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={`Kamida ${PASSWORD_MIN_LENGTH} ta belgi`}
            className={`${s.input} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
            className={`no-shelf absolute right-1.5 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg transition-colors ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <PasswordStrength password={password} isLight={isLight} />
      </div>

      <div className="space-y-1.5">
        <label className={s.label}>Parolni takrorlang</label>
        <div className="relative">
          <Lock size={17} className={`pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 ${s.icon}`} />
          <input
            type={show ? 'text' : 'password'}
            name="confirm-password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            value={confirmPassword}
            onChange={(e) => onConfirmPasswordChange(e.target.value)}
            placeholder="Parolni tasdiqlang"
            className={`${s.input} ${confirmPassword.length > 0 ? (matches ? 'border-emerald-500/60! ring-4 ring-emerald-100 dark:ring-emerald-500/20' : 'border-rose-500/60! ring-4 ring-rose-100 dark:ring-rose-500/20') : ''}`}
          />
        </div>
        {confirmPassword.length > 0 && !matches && (
          <p className="text-xs font-semibold text-rose-500">Parollar mos emas</p>
        )}
      </div>

      <KvActions
        isLight={isLight}
        onBack={onBack}
        onNext={onSubmit}
        label="Yakunlash"
        icon={<UserCheck size={18} className="shrink-0" />}
        disabled={!canSubmit}
        loading={loading}
      />
    </motion.div>
  )
}
