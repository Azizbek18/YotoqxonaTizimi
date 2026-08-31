'use client'

import { useCallback, useEffect, useState } from 'react'
import { BellRing, CheckCircle2, Loader2, ShieldCheck, Smartphone } from 'lucide-react'
import { getAuthHeaders } from '@/lib/auth-session'

export type PermitPushBinding = { id: string; passport: string; email: string }
type PushState = 'checking' | 'ready' | 'enabling' | 'enabled' | 'denied' | 'unsupported' | 'needs-install' | 'error'

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
  const result = await response.json() as { error?: string }
  if (!response.ok) throw new Error(result.error || "Bildirishnomani ulab bo‘lmadi")
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
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      if (existing) {
        await persistSubscription(existing, permitBinding)
        setState('enabled')
      } else {
        setState('ready')
      }
    } catch {
      setState('ready')
    }
  }, [permitBinding])

  useEffect(() => { void inspect() }, [inspect])

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
      const keyResult = await keyResponse.json() as { publicKey?: string; error?: string }
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

  const enabled = state === 'enabled'
  const title = enabled ? 'Bildirishnomalar yoqildi' : 'Jarayonni o‘tkazib yubormang'
  const description = enabled
    ? 'Ariza javobi, xona, to‘lov va muhim ogohlantirishlar shu qurilmaga keladi.'
    : state === 'needs-install'
      ? "iPhone’da avval ilovani bosh ekranga o‘rnating, keyin shu yerdan bildirishnomani yoqing."
      : state === 'denied'
        ? 'Brauzer sozlamalaridan meningyotoqxonam.uz uchun bildirishnomaga ruxsat bering.'
        : state === 'unsupported'
          ? 'Bu brauzer push-bildirishnomani qo‘llamaydi. Chrome yoki o‘rnatilgan ilovadan foydalaning.'
          : 'Ariza javobi, xona biriktirilishi, to‘lov natijasi va muhim xabarlarni darhol oling.'

  return (
    <section className={`relative overflow-hidden rounded-3xl border p-5 text-left shadow-lg ${
      isLight ? 'border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-cyan-50' : 'border-indigo-400/20 bg-gradient-to-br from-indigo-500/12 via-slate-950/70 to-cyan-500/10'
    }`} aria-live="polite">
      <div className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-indigo-500/15 blur-2xl" />
      <div className="relative flex items-start gap-4">
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${enabled ? 'bg-emerald-500 text-white' : 'bg-gradient-to-br from-indigo-500 to-cyan-500 text-white'} shadow-lg`}>
          {enabled ? <CheckCircle2 size={24} /> : <BellRing size={24} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className={`text-sm font-black uppercase tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>{title}</h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${enabled ? 'bg-emerald-500/15 text-emerald-500' : 'bg-indigo-500/15 text-indigo-500'}`}>
              <ShieldCheck size={10} /> Xavfsiz
            </span>
          </div>
          <p className={`text-xs font-medium leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{description}</p>
          {message ? <p className="mt-2 text-[11px] font-bold text-rose-500">{message}</p> : null}
          {(state === 'ready' || state === 'error') ? (
            <button type="button" onClick={() => void enable()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 active:scale-[0.98]">
              <BellRing size={15} /> Bildirishnomani yoqish
            </button>
          ) : state === 'enabling' || state === 'checking' ? (
            <div className={`mt-4 flex items-center gap-2 text-[11px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}><Loader2 className="animate-spin" size={15} /> Tekshirilmoqda…</div>
          ) : state === 'needs-install' ? (
            <div className="mt-4 flex items-center gap-2 text-[11px] font-bold text-indigo-500"><Smartphone size={15} /> «Ulashish» → «Bosh ekranga»</div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
