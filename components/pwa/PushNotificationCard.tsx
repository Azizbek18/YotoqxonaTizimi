'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, CheckCircle2, Loader2, Smartphone, X } from 'lucide-react'
import { getAuthHeaders } from '@/lib/auth-session'

export type PermitPushBinding = { id: string; passport: string; email: string }
type PushState = 'checking' | 'ready' | 'enabling' | 'enabled' | 'denied' | 'unsupported' | 'needs-install' | 'error'

const DISMISS_KEY = 'push_notice_dismissed_until'

function applicationServerKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const raw = window.atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

async function persistSubscription(subscription: PushSubscription, permitBinding?: PermitPushBinding) {
  const headers = await getAuthHeaders()
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ ...subscription.toJSON(), permitBinding }),
  })
  const result = (await response.json()) as { error?: string }
  if (!response.ok) throw new Error(result.error || 'Bildirishnomani ulab bo‘lmadi')
}

export default function PushNotificationCard({
  isLight,
  permitBinding,
}: {
  isLight: boolean
  permitBinding?: PermitPushBinding
}) {
  const [state, setState] = useState<PushState>('checking')
  const [message, setMessage] = useState('')
  const [dismissed, setDismissed] = useState(false)

  // Check if user temporarily dismissed this prompt
  useEffect(() => {
    try {
      const until = localStorage.getItem(DISMISS_KEY)
      if (until && Number(until) > Date.now()) {
        setDismissed(true)
      }
    } catch {
      // localStorage may fail in private mode
    }
  }, [])

  const inspect = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported')
      return
    }
    if (isIos() && !window.matchMedia('(display-mode: standalone)').matches) {
      setState('needs-install')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    try {
      const regPromise = navigator.serviceWorker.ready
      const timeoutPromise = new Promise<ServiceWorkerRegistration | null>((resolve) =>
        setTimeout(() => resolve(null), 1200),
      )
      const registration = await Promise.race([regPromise, timeoutPromise])
      if (registration) {
        const existing = await registration.pushManager.getSubscription()
        if (existing) {
          await persistSubscription(existing, permitBinding)
          setState('enabled')
          return
        }
      }
      setState('ready')
    } catch {
      setState('ready')
    }
  }, [permitBinding])

  useEffect(() => {
    void inspect()
  }, [inspect])

  const enable = async () => {
    setState('enabling')
    setMessage('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'ready')
        return
      }
      const keyResponse = await fetch('/api/push/subscribe', { cache: 'no-store' })
      const keyResult = (await keyResponse.json()) as { publicKey?: string; error?: string }
      if (!keyResponse.ok || !keyResult.publicKey) throw new Error(keyResult.error || 'Xizmat kaliti topilmadi')

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(keyResult.publicKey),
      })
      await persistSubscription(subscription, permitBinding)
      setState('enabled')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Qayta urinib ko‘ring')
      setState('error')
    }
  }

  const dismiss = () => {
    setDismissed(true)
    try {
      // Dismiss for 7 days
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 3600 * 1000))
    } catch {
      // Ignore storage errors
    }
  }

  // If dismissed or unsupported, do not display
  if (dismissed || state === 'unsupported') {
    return null
  }

  const enabled = state === 'enabled'

  return (
    <section
      className={`no-shelf relative rounded-2xl border p-3.5 min-[360px]:p-4 text-left transition-all ${
        isLight
          ? 'border-indigo-100/90 bg-white/95 shadow-xs'
          : 'border-white/10 bg-slate-900/60 shadow-xs'
      }`}
      aria-live="polite"
    >
      {/* Top Dismiss Button */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Yopish"
        data-student-button="plain"
        className="no-shelf absolute right-2.5 top-2.5 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition"
      >
        <X size={14} />
      </button>

      <div className="flex items-start gap-3 min-w-0 pr-6">
        {/* Academic Medallion Icon */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
            enabled
              ? 'border-emerald-500/25 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
              : 'border-indigo-500/20 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
          }`}
        >
          {enabled ? <CheckCircle2 size={18} strokeWidth={2.2} /> : <Bell size={18} strokeWidth={2.2} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-xs min-[360px]:text-sm font-bold text-slate-900 dark:text-white">
              {enabled ? 'Bildirishnomalar faol' : 'Tezkor bildirishnomalar'}
            </h3>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                enabled
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
              }`}
            >
              {enabled ? 'Ulangan' : 'Tavsiya'}
            </span>
          </div>

          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {enabled
              ? 'Ariza javoblari, xona ajratilishi va to‘lov yangiliklari shu qurilmaga yuboriladi.'
              : state === 'needs-install'
                ? 'iPhone’da Safari orqali avval ilovani bosh ekranga o‘rnating, so‘ngra yoqing.'
                : state === 'denied'
                  ? 'Brauzer sozlamalaridan bildirishnomalarga ruxsat berilishi kerak.'
                  : 'Ariza javobi, xona biriktirilishi va to‘lov yangiliklaridan o‘z vaqtida xabardor bo‘ling.'}
          </p>

          {message ? (
            <p className="mt-1.5 text-[11px] font-semibold text-rose-500">{message}</p>
          ) : null}

          {/* Action Row */}
          {!enabled && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {state === 'ready' || state === 'error' ? (
                <>
                  <button
                    type="button"
                    onClick={() => void enable()}
                    data-student-button="plain"
                    className="no-shelf inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 text-xs font-bold transition active:scale-95 shadow-xs"
                  >
                    <Bell size={13} className="shrink-0" />
                    <span>Yoqish</span>
                  </button>
                  <button
                    type="button"
                    onClick={dismiss}
                    data-student-button="plain"
                    className="no-shelf inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition active:scale-95"
                  >
                    Keyinroq
                  </button>
                </>
              ) : state === 'enabling' || state === 'checking' ? (
                <div className="inline-flex items-center gap-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Loader2 className="animate-spin" size={13} />
                  <span>Ulanmoqda…</span>
                </div>
              ) : state === 'needs-install' ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  <Smartphone size={13} />
                  <span>«Ulashish» → «Bosh ekranga»</span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
