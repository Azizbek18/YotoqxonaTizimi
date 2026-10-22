'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Eye, EyeOff, Info, KeyRound, Loader2, Lock, ShieldCheck, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { dekanUI } from '@/lib/dekan-ui'
import { getPasswordPolicyError, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/password-policy'

type Props = {
  open: boolean
  email: string | null
  isLight: boolean
  onClose: () => void
}

type FieldKey = 'current' | 'next' | 'confirm'

// Kuchlilik darajasi (bajarilgan talablar soni bo'yicha): chiziq rangi va yozuvi.
const STRENGTH = [
  { label: 'Parolni kiriting', bar: 'bg-slate-300', text: 'text-slate-500' },
  { label: 'Juda zaif', bar: 'bg-rose-500', text: 'text-rose-600' },
  { label: 'Zaif', bar: 'bg-orange-500', text: 'text-orange-600' },
  { label: 'O‘rtacha', bar: 'bg-amber-500', text: 'text-amber-600' },
  { label: 'Yaxshi', bar: 'bg-lime-500', text: 'text-lime-600' },
  { label: 'Kuchli', bar: 'bg-emerald-500', text: 'text-emerald-600' },
] as const

// Xalqaro bo'lim xodimi o'z parolini almashtiradi. Joriy parol avval tekshiriladi
// (sessiya ochiq qolgan kompyuterdan begona odam parolni almashtira olmasligi
// uchun), keyin boshqa qurilmalardagi sessiyalar yopiladi.
export default function ChangePasswordModal({ open, email, isLight, onClose }: Props) {
  const ui = dekanUI(isLight)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState<Record<FieldKey, boolean>>({ current: false, next: false, confirm: false })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setCurrent('')
    setNext('')
    setConfirm('')
    setVisible({ current: false, next: false, confirm: false })
    setBusy(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, busy, onClose])

  if (!open) return null

  const checks = [
    { ok: next.length >= PASSWORD_MIN_LENGTH && next.length <= PASSWORD_MAX_LENGTH, label: `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} belgi` },
    { ok: /[A-Z]/.test(next), label: 'Katta harf (A–Z)' },
    { ok: /[a-z]/.test(next), label: 'Kichik harf (a–z)' },
    { ok: /\d/.test(next), label: 'Raqam (0–9)' },
    { ok: /[^A-Za-z0-9]/.test(next), label: 'Maxsus belgi (! @ # ...)' },
  ]
  const score = next ? checks.filter((c) => c.ok).length : 0
  const strength = STRENGTH[score]
  const mismatch = confirm.length > 0 && next !== confirm
  const matches = confirm.length > 0 && next === confirm

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!email) return toast.error('Foydalanuvchi aniqlanmadi. Sahifani yangilang.')
    if (!current) return toast.error('Joriy parolni kiriting')
    const policyError = getPasswordPolicyError(next)
    if (policyError) return toast.error(policyError)
    if (next !== confirm) return toast.error('Yangi parollar bir-biriga mos kelmadi')
    if (next === current) return toast.error('Yangi parol joriy paroldan farq qilishi kerak')

    setBusy(true)
    try {
      const verify = await supabase.auth.signInWithPassword({ email, password: current })
      if (verify.error) {
        toast.error('Joriy parol noto‘g‘ri')
        return
      }
      const { error } = await supabase.auth.updateUser({ password: next })
      if (error) {
        toast.error(
          error.message.includes('different')
            ? 'Yangi parol oldingisi bilan bir xil bo‘lmasligi kerak'
            : 'Parolni o‘zgartirib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.',
        )
        return
      }
      // Boshqa qurilmalarda ochiq qolgan sessiyalar yopiladi; bu qurilma qoladi.
      try {
        await supabase.auth.signOut({ scope: 'others' })
      } catch {
        // Parol allaqachon almashgan; sessiyalarni yopish muvaffaqiyatsiz bo'lsa ham davom etamiz.
      }
      toast.success('Parol muvaffaqiyatli o‘zgartirildi')
      onClose()
    } catch {
      toast.error('Tizim xatosi yuz berdi. Qayta urinib ko‘ring.')
    } finally {
      setBusy(false)
    }
  }

  const toggle = (key: FieldKey) => setVisible((prev) => ({ ...prev, [key]: !prev[key] }))
  const labelCls = `mb-1.5 block text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-200'}`

  const field = (
    key: FieldKey,
    title: string,
    value: string,
    set: (v: string) => void,
    autoComplete: string,
    state: 'ok' | 'error' | null = null,
  ) => (
    <div>
      <label htmlFor={`pw-${key}`} className={labelCls}>
        {title}
      </label>
      <div className="relative">
        <Lock
          size={15}
          className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}
          aria-hidden="true"
        />
        <input
          id={`pw-${key}`}
          type={visible[key] ? 'text' : 'password'}
          value={value}
          onChange={(e) => set(e.target.value)}
          autoComplete={autoComplete}
          maxLength={PASSWORD_MAX_LENGTH}
          required
          aria-invalid={state === 'error'}
          className={`w-full rounded-xl border py-3 pl-10 pr-11 text-sm outline-none transition-colors ${ui.input} ${ui.ring} ${
            state === 'error' ? (isLight ? '!border-rose-400' : '!border-rose-500/70') : state === 'ok' ? (isLight ? '!border-emerald-400' : '!border-emerald-500/60') : ''
          }`}
        />
        <button
          type="button"
          onClick={() => toggle(key)}
          className={`no-shelf absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 transition-colors ${
            isLight ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-800' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
          aria-label={visible[key] ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
          tabIndex={-1}
        >
          {visible[key] ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <motion.form
        role="dialog"
        aria-modal="true"
        aria-label="Parolni o‘zgartirish"
        onSubmit={(e) => void submit(e)}
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18 }}
        className={`flex max-h-[94vh] w-full max-w-[460px] flex-col overflow-hidden rounded-3xl border ${
          isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950'
        }`}
      >
        {/* Sarlavha */}
        <div
          className={`relative flex items-start justify-between gap-3 px-6 pb-5 pt-6 ${
            isLight ? 'bg-gradient-to-b from-indigo-50/80 to-white' : 'bg-gradient-to-b from-indigo-950/40 to-slate-950'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                isLight ? 'bg-indigo-600 text-white' : 'bg-indigo-500 text-white'
              }`}
            >
              <KeyRound size={22} />
            </div>
            <div className="min-w-0">
              <h3 className={`text-base font-black tracking-tight ${ui.strong}`}>Parolni o‘zgartirish</h3>
              {email && (
                <p className={`mt-0.5 truncate text-xs ${ui.muted}`} title={email}>
                  {email}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`no-shelf -mr-2 -mt-1 rounded-xl p-2 transition-colors disabled:opacity-50 ${
              isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-800'
            }`}
            aria-label="Yopish"
          >
            <X size={18} />
          </button>
        </div>

        {/* Maydonlar */}
        <div className="space-y-5 overflow-y-auto px-6 pb-2 pt-1">
          {field('current', 'Joriy parol', current, setCurrent, 'current-password')}

          <div className={`h-px ${isLight ? 'bg-slate-100' : 'bg-slate-800'}`} />

          <div className="space-y-3">
            {field('next', 'Yangi parol', next, setNext, 'new-password')}

            {/* Kuchlilik chizig'i */}
            <div>
              <div className="flex gap-1.5" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i <= score ? strength.bar : isLight ? 'bg-slate-200' : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>
              <p className={`mt-1.5 text-[11px] font-bold ${next ? strength.text : ui.muted}`} aria-live="polite">
                {strength.label}
              </p>
            </div>

            {/* Talablar */}
            <ul
              className={`grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-xl border px-3.5 py-3 sm:grid-cols-2 ${
                isLight ? 'border-slate-200 bg-slate-50/70' : 'border-slate-800 bg-slate-900/40'
              }`}
              aria-label="Parol talablari"
            >
              {checks.map((item) => (
                <li
                  key={item.label}
                  className={`flex items-center gap-2 text-[11px] font-medium transition-colors ${
                    item.ok ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : ui.muted
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                      item.ok
                        ? isLight
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-emerald-950/60 text-emerald-400'
                        : isLight
                          ? 'bg-slate-200/70 text-transparent'
                          : 'bg-slate-800 text-transparent'
                    }`}
                  >
                    <Check size={10} strokeWidth={3} />
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <div>
            {field('confirm', 'Yangi parolni takrorlang', confirm, setConfirm, 'new-password', mismatch ? 'error' : matches ? 'ok' : null)}
            {mismatch && (
              <p className={`mt-1.5 text-[11px] font-semibold ${isLight ? 'text-rose-700' : 'text-rose-400'}`} role="alert">
                Parollar mos kelmayapti
              </p>
            )}
            {matches && (
              <p className={`mt-1.5 flex items-center gap-1 text-[11px] font-semibold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                <Check size={12} strokeWidth={3} /> Parollar mos
              </p>
            )}
          </div>

          <p
            className={`flex items-start gap-2 rounded-xl px-3.5 py-3 text-[11px] leading-relaxed ${
              isLight ? 'bg-indigo-50/70 text-indigo-900' : 'bg-indigo-950/30 text-indigo-200'
            }`}
          >
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>
              Parol almashgach, boshqa qurilmalardagi sessiyalaringiz avtomatik yopiladi. Bu qurilmada tizimda qolasiz.
            </span>
          </p>
        </div>

        {/* Tugmalar */}
        <div className="flex items-center justify-between gap-3 px-6 pb-6 pt-4">
          <p className={`hidden items-center gap-1.5 text-[11px] sm:flex ${ui.muted}`}>
            <ShieldCheck size={13} /> Joriy parol tekshiriladi
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className={`no-shelf rounded-xl border px-4 py-2.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                isLight
                  ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={busy}
              className={`no-shelf inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white transition-colors disabled:opacity-60 ${
                isLight ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-500 hover:bg-indigo-400'
              }`}
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {busy ? 'Saqlanmoqda...' : 'Parolni saqlash'}
            </button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  )
}
