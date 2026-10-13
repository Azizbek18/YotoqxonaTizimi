'use client'

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, MailCheck, X } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'
import {
  getPendingEmailProofRequest,
  sendEmailCode,
  settleEmailProofRequest,
  subscribeEmailProofRequest,
  verifyEmailCode,
} from '@/features/email-verification/client'

const RESEND_AFTER_S = 60

/**
 * Collects the 6-digit code for `ensureEmailProof()` / `fetchWithEmailProof()`
 * / `ensureChallengeProof()` (features/email-verification/client.ts). Mount
 * once on any page that calls them. No framer-motion: it sits on public
 * entry pages (mobile perf).
 */
export default function EmailProofDialog() {
  const pending = useSyncExternalStore(subscribeEmailProofRequest, getPendingEmailProofRequest, () => null)
  if (!pending) return null
  return pending.kind === 'email'
    ? <CodeForm key={pending.email} email={pending.email} />
    : <ChallengeCodeForm key={pending.challenge} challenge={pending.challenge} devCode={pending.devCode} onResend={pending.onResend} />
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

  // Telegram-style: submit as soon as the 6th digit lands.
  useEffect(() => {
    if (code.length === 6 && challenge) void verify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  return (
    <OtpSheet
      isLight={isLight}
      subtitle={<>
          {challenge ? 'Kod yuborildi' : 'Kod yuborilmoqda'}
          <br />
          <span className="font-bold break-all">{email}</span>
        </>}
      code={code}
      onCode={setCode}
      inputRef={inputRef}
      ready={Boolean(challenge)}
      verifying={verifying}
      error={error}
      devCode={devCode}
      cooldown={cooldown}
      resending={sending}
      onResend={() => void send()}
      onSubmit={verify}
    />
  )
}

/**
 * Same shape as CodeForm, for `ensureChallengeProof()`: the server already
 * decided the email and mailed the first code, so there's nothing to send
 * on mount and nothing to show but a generic "check your application's
 * email" line — never the address itself.
 */
function ChallengeCodeForm({
  challenge: initialChallenge,
  devCode: initialDevCode,
  onResend,
}: {
  challenge: string
  devCode?: string
  onResend: () => Promise<{ challenge: string; devCode?: string }>
}) {
  const isLight = useThemeStore((state) => state.theme === 'light')
  const [challenge, setChallenge] = useState(initialChallenge)
  const [devCode, setDevCode] = useState<string | null>(initialDevCode ?? null)
  const [code, setCode] = useState('')
  const [resending, setResending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(RESEND_AFTER_S)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

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

  const resend = async () => {
    setResending(true)
    setError(null)
    try {
      const result = await onResend()
      setChallenge(result.challenge)
      setDevCode(result.devCode ?? null)
      setCode('')
      setCooldown(RESEND_AFTER_S)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kodni yuborib bo‘lmadi.')
    } finally {
      setResending(false)
    }
  }

  const verify = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (code.length !== 6 || verifying) return
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

  useEffect(() => {
    if (code.length === 6) void verify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  return (
    <OtpSheet
      isLight={isLight}
      subtitle={'Arizangizda ko‘rsatilgan email manziliga tasdiqlash kodi yuborildi.'}
      code={code}
      onCode={setCode}
      inputRef={inputRef}
      ready={true}
      verifying={verifying}
      error={error}
      devCode={devCode}
      cooldown={cooldown}
      resending={resending}
      onResend={() => void resend()}
      onSubmit={verify}
    />
  )
}

interface OtpSheetProps {
  isLight: boolean
  subtitle: React.ReactNode
  code: string
  onCode: (value: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  ready: boolean
  verifying: boolean
  error: string | null
  devCode: string | null
  cooldown: number
  resending: boolean
  onResend: () => void
  onSubmit: (event?: React.FormEvent) => void
}

/**
 * Telegram-style one-time-code sheet: bottom sheet on phones, centred card on
 * desktop; six digit cells over ONE real input (so paste, SMS/email autofill
 * and the numeric keypad all keep working); resend is a quiet text link with
 * a m:ss countdown.
 */
function OtpSheet({
  isLight, subtitle, code, onCode, inputRef, ready, verifying, error, devCode, cooldown, resending, onResend, onSubmit,
}: OtpSheetProps) {
  const [focused, setFocused] = useState(false)
  const title = isLight ? 'text-slate-900' : 'text-white'
  const muted = isLight ? 'text-slate-500' : 'text-slate-400'
  const activeIndex = Math.min(code.length, 5)
  const mmss = `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, '0')}`

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="email-proof-title">
      <div className="fixed inset-0 bg-slate-950/60" onClick={() => settleEmailProofRequest(null)} />
      <form
        onSubmit={onSubmit}
        className={`relative z-10 w-full max-w-sm rounded-t-3xl border px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center sm:rounded-3xl sm:px-7 sm:pb-7 sm:pt-6 ${
          isLight ? 'border-slate-200/90 bg-white shadow-2xl shadow-slate-900/15' : 'border-slate-800 bg-slate-900 shadow-2xl shadow-slate-950'
        }`}
      >
        <button
          type="button"
          onClick={() => settleEmailProofRequest(null)}
          className={`no-shelf absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            isLight ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-700' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'
          }`}
          aria-label="Yopish"
        >
          <X size={18} />
        </button>

        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
          <MailCheck size={30} />
        </div>
        <h2 id="email-proof-title" className={`text-xl font-black tracking-tight ${title}`}>Emailingizni tasdiqlang</h2>
        <p className={`mt-1.5 text-sm leading-relaxed ${muted}`}>{subtitle}</p>

        <div className="relative mx-auto mt-6 w-fit">
          <div className="flex gap-2" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => {
              const digit = code[i]
              const isActive = focused && i === activeIndex && !verifying
              return (
                <span
                  key={i}
                  className={`flex h-14 w-11 items-center justify-center rounded-xl border-2 font-mono text-2xl font-black transition-all sm:w-12 ${
                    error
                      ? 'border-rose-400 text-rose-500'
                      : isActive
                        ? 'border-indigo-500 ring-4 ring-indigo-500/20'
                        : digit
                          ? (isLight ? 'border-indigo-200 bg-indigo-50/60' : 'border-indigo-500/40 bg-indigo-500/10')
                          : (isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-700 bg-slate-950/50')
                  } ${error ? '' : title}`}
                >
                  {digit ?? (isActive ? <span className="h-6 w-0.5 animate-pulse rounded bg-indigo-500" /> : '')}
                </span>
              )
            })}
          </div>
          <input
            ref={inputRef}
            value={code}
            onChange={(event) => onCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="6 xonali kod"
            disabled={!ready}
            readOnly={verifying}
            className="absolute inset-0 h-full w-full cursor-text opacity-0"
          />
        </div>

        {devCode && (
          <p className={`mt-3 text-xs ${muted}`}>Lokal rejim: kod <span className="font-mono font-bold">{devCode}</span></p>
        )}
        {error && <p className="mt-3 text-sm font-semibold text-rose-500" role="alert">{error}</p>}

        <button
          type="submit"
          disabled={!ready || code.length !== 6 || verifying}
          className="no-shelf mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
        >
          {verifying ? <Loader2 size={18} className="animate-spin" /> : null}
          Tasdiqlash
        </button>

        <div className="mt-4 text-sm">
          {resending ? (
            <span className={muted}>Yuborilmoqda…</span>
          ) : cooldown > 0 ? (
            <span className={muted}>Kodni qayta yuborish <span className="font-semibold tabular-nums">{mmss}</span></span>
          ) : (
            <button type="button" onClick={onResend} className="no-shelf font-bold text-indigo-500 hover:underline">
              Kodni qayta yuborish
            </button>
          )}
        </div>
        <p className={`mt-2 text-xs ${muted}`}>Xat kelmasa «Spam» papkasini tekshiring.</p>
      </form>
    </div>,
    document.body,
  )
}
