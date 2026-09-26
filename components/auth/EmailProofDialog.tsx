'use client'

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, MailCheck, X } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'
import {
  getEmailProofRequest,
  sendEmailCode,
  settleEmailProofRequest,
  subscribeEmailProofRequest,
  verifyEmailCode,
} from '@/features/email-verification/client'

const RESEND_AFTER_S = 60

/**
 * Collects the 6-digit code for `ensureEmailProof()` / `fetchWithEmailProof()`
 * (features/email-verification/client.ts). Mount once on any page that
 * calls them. No framer-motion: it sits on public entry pages (mobile perf).
 */
export default function EmailProofDialog() {
  const email = useSyncExternalStore(subscribeEmailProofRequest, getEmailProofRequest, () => null)
  return email ? <CodeForm key={email} email={email} /> : null
}

function CodeForm({ email }: { email: string }) {
  const isLight = useThemeStore((state) => state.theme === 'light')
  const [challenge, setChallenge] = useState<string | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const sentOnce = useRef(false)

  const send = useCallback(async () => {
    setSending(true)
    setError(null)
    try {
      const result = await sendEmailCode(email)
      setChallenge(result.challenge)
      setDevCode(result.devCode ?? null)
      setCode('')
      setCooldown(RESEND_AFTER_S)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kodni yuborib bo‘lmadi.')
    } finally {
      setSending(false)
    }
  }, [email])

  // Mail the code as soon as the dialog opens — one click fewer.
  useEffect(() => {
    if (sentOnce.current) return
    sentOnce.current = true
    void send()
  }, [send])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') settleEmailProofRequest(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const verify = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (!challenge || code.length !== 6 || verifying) return
    setVerifying(true)
    setError(null)
    try {
      settleEmailProofRequest(await verifyEmailCode(challenge, code))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod noto‘g‘ri.')
      setCode('')
      inputRef.current?.focus()
    } finally {
      setVerifying(false)
    }
  }

  const surface = isLight ? 'bg-white border-slate-200/90 shadow-2xl shadow-slate-900/15' : 'bg-slate-900 border-slate-800 shadow-2xl shadow-slate-950'
  const title = isLight ? 'text-slate-900' : 'text-white'
  const muted = isLight ? 'text-slate-500' : 'text-slate-400'

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="email-proof-title">
      <div className="fixed inset-0 bg-slate-950/60" onClick={() => settleEmailProofRequest(null)} />
      <form onSubmit={verify} className={`relative z-10 w-full max-w-sm rounded-3xl border p-5 sm:p-6 ${surface}`}>
        <div className="flex items-start gap-3.5">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${isLight ? 'bg-indigo-50 ring-indigo-200/80' : 'bg-indigo-950/50 ring-indigo-800/60'}`}>
            <MailCheck size={20} className={isLight ? 'text-indigo-600' : 'text-indigo-400'} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="email-proof-title" className={`text-base sm:text-lg font-black tracking-tight ${title}`}>Emailingizni tasdiqlang</h2>
            <p className={`mt-1 text-xs sm:text-sm leading-relaxed ${muted}`}>
              {challenge ? 'Kod yuborildi:' : 'Kod yuborilmoqda:'}{' '}
              <span className={`font-bold break-all ${title}`}>{email}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => settleEmailProofRequest(null)}
            className={`no-shelf -mr-1 -mt-1 rounded-xl p-1.5 transition-colors ${isLight ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-700' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}`}
            aria-label="Yopish"
          >
            <X size={18} />
          </button>
        </div>

        <label htmlFor="email-proof-code" className={`mt-5 block text-[11px] font-bold uppercase tracking-wider ${muted}`}>
          6 xonali kod
        </label>
        <input
          id="email-proof-code"
          ref={inputRef}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••••"
          disabled={!challenge}
          className={`mt-1.5 w-full rounded-2xl border px-4 py-3 text-center font-mono text-2xl font-black tracking-[0.5em] outline-none transition-colors disabled:opacity-50 ${
            isLight
              ? 'border-slate-200 bg-slate-50 text-slate-900 focus:border-indigo-400 focus:bg-white'
              : 'border-slate-700 bg-slate-950/60 text-white focus:border-indigo-500'
          }`}
        />
        {devCode && (
          <p className={`mt-2 text-[11px] ${muted}`}>Lokal rejim: kod <span className="font-mono font-bold">{devCode}</span></p>
        )}
        {error && <p className="mt-2 text-xs font-semibold text-rose-500" role="alert">{error}</p>}
        <p className={`mt-3 text-[11px] leading-relaxed ${muted}`}>
          Xat kelmasa «Spam» papkasini tekshiring. Kod 10 daqiqa amal qiladi.
        </p>

        <div className="mt-5 flex items-center gap-2.5">
          <button
            type="button"
            data-btn="secondary"
            onClick={() => void send()}
            disabled={sending || cooldown > 0}
            className={`no-shelf flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold transition-all disabled:opacity-50 ${
              isLight ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100' : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {sending ? 'Yuborilmoqda…' : cooldown > 0 ? `Qayta yuborish (${cooldown})` : 'Qayta yuborish'}
          </button>
          <button
            type="submit"
            disabled={!challenge || code.length !== 6 || verifying}
            className="no-shelf inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-indigo-500/25 transition-all hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
          >
            {verifying ? <Loader2 size={14} className="animate-spin" /> : null}
            Tasdiqlash
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
