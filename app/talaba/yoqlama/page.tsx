'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MapPin, Check, X, Loader2, RefreshCw, Home } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'
import { getAuthHeaders } from '@/lib/auth-session'
import { clearAttendanceSummary, fetchAttendanceSummary } from '@/features/attendance/client/summary'
import type { CheckinResult } from '@/features/attendance/types'

type Failure = 'no_response' | 'no_geolocation' | 'denied' | 'position' | 'timeout' | 'rate_limited' | 'auth' | 'server' | 'network'

const FAILURE_COPY: Record<Failure, { title: string; body: string }> = {
  no_response: {
    title: 'Joylashuv javob bermadi',
    body: 'Brauzer joylashuvni bermadi. Agar ruxsat oynasi chiqqan bo‘lsa «Ruxsat berish»ni bosing. Chiqmasa — telefonda GPS’ni yoqing va sahifani Chrome/Safari’da oching (Telegram ichki brauzeridan emas), so‘ng qayta urining.',
  },
  no_geolocation: {
    title: 'Brauzer joylashuvni qo‘llamaydi',
    body: 'Bu brauzerda joylashuv ishlamaydi. Sahifani Chrome yoki Safari’da oching (Telegram/Instagram ichki brauzeridan emas).',
  },
  denied: {
    title: 'Joylashuvga ruxsat berilmagan',
    body: 'Brauzer manzil satridagi qulf belgisini bosing → «Joylashuv» → «Ruxsat berish». Telefon sozlamalarida ham brauzer uchun joylashuv yoqilgan bo‘lsin, so‘ng qayta urinib ko‘ring.',
  },
  position: {
    title: 'Joylashuv aniqlanmadi',
    body: 'Telefonda GPS (Joylashuv) o‘chiq yoki signal yo‘q. GPS’ni yoqing, deraza yoniga yoki ochiq joyga chiqib qayta urinib ko‘ring.',
  },
  timeout: {
    title: 'Joylashuv juda sekin aniqlandi',
    body: 'GPS signali kech keldi. Ochiq joyga chiqing, «Aniq joylashuv» (Precise location) yoqilganini tekshirib, qayta urinib ko‘ring.',
  },
  rate_limited: {
    title: 'Juda ko‘p urinish',
    body: 'Qisqa vaqtda juda ko‘p marta bosdingiz. 10 daqiqadan keyin qayta urinib ko‘ring yoki qavat sardoriga ayting.',
  },
  auth: {
    title: 'Hisobingiz tasdiqlanmadi',
    body: 'Sessiyangiz tugagan yoki hisobingizga cheklov qo‘yilgan. Ilovadan chiqib qayta kiring; hal bo‘lmasa qavat sardoriga ayting.',
  },
  server: {
    title: 'Server xatosi',
    body: 'Serverda vaqtincha muammo bo‘ldi. Birozdan keyin qayta urinib ko‘ring yoki qavat sardoriga ayting — u sizni qo‘lda belgilaydi.',
  },
  network: {
    title: 'Internet aloqasi yo‘q',
    body: 'So‘rov serverga yetib bormadi. Internet (Wi‑Fi yoki mobil) ulanishini tekshirib, qayta urinib ko‘ring.',
  },
}

type Phase = 'idle' | 'locating' | 'sending' | 'done' | 'no_session' | 'on_leave'

export default function TalabaYoqlamaPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<CheckinResult | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [checking, setChecking] = useState(true)
  const submitting = useRef(false)

  const checkSession = useCallback(async () => {
    setChecking(true)
    try {
      const data = await fetchAttendanceSummary()
      if (data.ok && data.onLeave) {
        // Uyga ketish arizasi amalda — joylashuv tasdig'i kerak emas.
        setPhase('on_leave')
      } else if (data.ok && data.hasOpen && (data.myState === 'present' || data.myState === 'excused')) {
        // Already confirmed — show it again after a reload instead of the button.
        setResult({ status: 'already', state: data.myState })
        setPhase('done')
      } else {
        setPhase(data.ok && data.hasOpen ? 'idle' : 'no_session')
      }
    } catch {
      setPhase('no_session')
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => { checkSession() }, [checkSession])

  const confirm = useCallback(() => {
    if (submitting.current) return
    setFailure(null)
    if (!('geolocation' in navigator)) {
      setResult({ status: 'unavailable' }); setFailure('no_geolocation'); setPhase('done'); return
    }
    submitting.current = true
    setPhase('locating')

    // Some browsers (in-app webviews, an unanswered permission prompt) never
    // call back at all, and getCurrentPosition's own timeout only starts after
    // permission is granted — so this guard is what keeps the screen from hanging.
    let settled = false
    const fail = (reason: Failure) => {
      if (settled) return
      settled = true
      window.clearTimeout(watchdog)
      submitting.current = false
      setResult({ status: 'unavailable' })
      setFailure(reason)
      setPhase('done')
    }
    const watchdog = window.setTimeout(() => fail('no_response'), 30_000)

    const send = async (pos: GeolocationPosition) => {
      if (settled) return
      settled = true
      window.clearTimeout(watchdog)
      setPhase('sending')
      try {
        const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' }
        const res = await fetch('/api/attendance/checkin', {
          method: 'POST', headers,
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        })
        const data = (await res.json().catch(() => null)) as (CheckinResult & { error?: string }) | null
        // A 4xx/5xx body is { error }, not a CheckinResult — never show it as a verdict.
        if (!res.ok || !data || typeof data.status !== 'string') {
          setResult({ status: 'unavailable' })
          setFailure(
            res.status === 429 ? 'rate_limited'
            : res.status === 401 || res.status === 403 ? 'auth'
            : 'server',
          )
        } else {
          setResult(data)
        }
      } catch {
        setResult({ status: 'unavailable' })
        setFailure('network')
      } finally {
        submitting.current = false
        clearAttendanceSummary()
        setPhase('done')
      }
    }

    const locate = (highAccuracy: boolean) => {
      navigator.geolocation.getCurrentPosition(
        send,
        (err) => {
          if (err.code === err.PERMISSION_DENIED) return fail('denied')
          // GPS could not get a fix in time: one more try with network location
          // (the server rejects a coarse fix with its own clear message).
          if (highAccuracy) return locate(false)
          fail(err.code === err.TIMEOUT ? 'timeout' : 'position')
        },
        { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 15_000 : 10_000, maximumAge: 0 },
      )
    }

    // A permission that is already blocked would otherwise fail silently on
    // some browsers; say so right away.
    const start = async () => {
      try {
        const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
        if (status?.state === 'denied') return fail('denied')
      } catch { /* Permissions API unsupported — just ask for the position */ }
      if (!settled) locate(true)
    }
    void start()
  }, [])

  const retry = () => { setResult(null); setFailure(null); setPhase('idle') }

  return (
    <div className={`min-h-screen ${isLight ? 'bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900' : 'bg-[#020617] text-white'}`}>
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
        <Link href="/talaba/dashboard" prefetch={false} className={`inline-flex w-fit items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-black uppercase tracking-wider ${isLight ? 'border-slate-300 text-slate-600' : 'border-white/10 text-slate-400'}`}>
          <ArrowLeft size={14} /> Asosiy
        </Link>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {checking ? (
            <Loader2 className="animate-spin text-slate-400" />
          ) : phase === 'on_leave' ? (
            <>
              <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-sky-500/15 text-sky-500">
                <Home size={40} />
              </div>
              <h1 className="text-xl font-extrabold">Siz uyda deb belgilangansiz</h1>
              <p className={`mt-2 max-w-xs text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Uyga ketish arizangiz amalda — yo‘qlamada “kelmadi” hisoblanmaysiz. Yotoqxonaga qaytgach arizada «Qaytdim» tugmasini bosing.
              </p>
              <Link
                href="/talaba/uyga-ketish"
                prefetch={false}
                className="mt-7 w-full rounded-2xl bg-sky-600 py-4 text-sm font-black uppercase tracking-widest text-white"
              >
                Arizani ko‘rish
              </Link>
            </>
          ) : phase === 'no_session' ? (
            <>
              <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500'}`}>
                <MapPin size={26} />
              </div>
              <h1 className="text-lg font-extrabold">Hozircha yo‘qlama yo‘q</h1>
              <p className={`mt-1.5 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Yo‘qlama boshlanganda sizga xabar keladi.
              </p>
            </>
          ) : phase === 'done' && result ? (
            <ResultView result={result} failure={failure} isLight={isLight} onRetry={retry} />
          ) : (
            <>
              <div className={`mb-5 flex h-24 w-24 items-center justify-center rounded-full ${isLight ? 'bg-blue-50 text-blue-500' : 'bg-blue-500/10 text-blue-400'}`}>
                <MapPin size={40} />
              </div>
              <h1 className="text-xl font-extrabold tracking-tight">Yotoqxonadamisiz?</h1>
              <p className={`mt-2 max-w-xs text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Tugmani bosing — tizim joylashuvingizni bir marta tekshiradi. Joylashuv tarixi saqlanmaydi.
              </p>
              <button
                type="button"
                onClick={confirm}
                disabled={phase !== 'idle'}
                className="mt-7 w-full rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110 disabled:opacity-60"
              >
                {phase === 'locating' ? 'Joylashuv aniqlanmoqda…'
                  : phase === 'sending' ? 'Yuborilmoqda…'
                  : 'Yotoqxonada ekanligimni tasdiqlash'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultView({ result, failure, isLight, onRetry }: { result: CheckinResult; failure: Failure | null; isLight: boolean; onRetry: () => void }) {
  const muted = isLight ? 'text-slate-500' : 'text-slate-400'
  if (result.status === 'no_session') {
    return (
      <>
        <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500'}`}>
          <MapPin size={26} />
        </div>
        <h1 className="text-lg font-extrabold">Hozircha yo‘qlama yo‘q</h1>
        <p className={`mt-1.5 text-sm ${muted}`}>Yo‘qlama boshlanganda sizga xabar keladi.</p>
      </>
    )
  }
  if (result.status === 'present' || (result.status === 'already' && (result.state === 'present' || result.state === 'excused'))) {
    return (
      <>
        <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
          <Check size={44} />
        </div>
        <h1 className="text-xl font-extrabold">Tasdiqlandi ✅</h1>
        <p className={`mt-2 text-sm ${muted}`}>
          {result.status === 'present' ? 'Siz yotoqxonada deb belgilandingiz.' : 'Siz allaqachon tasdiqlangansiz.'}
        </p>
      </>
    )
  }
  if (result.status === 'outside' || (result.status === 'already' && result.state === 'absent')) {
    return (
      <>
        <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
          <X size={44} />
        </div>
        <h1 className="text-xl font-extrabold">Yotoqxonadan tashqarida</h1>
        <p className={`mt-2 max-w-xs text-sm ${muted}`}>
          {result.status === 'outside' && `Yotoqxonadan ~${result.distanceM} m uzoqda ko‘rindingiz. `}
          Agar bu xato bo‘lsa, qavat sardoriga ayting.
        </p>
        <RetryBtn onRetry={onRetry} isLight={isLight} />
      </>
    )
  }
  if (result.status === 'retry') {
    return (
      <>
        <div className={`mb-5 flex h-24 w-24 items-center justify-center rounded-full ${isLight ? 'bg-amber-50 text-amber-500' : 'bg-amber-500/10 text-amber-400'}`}>
          <RefreshCw size={40} />
        </div>
        <h1 className="text-xl font-extrabold">Joylashuv aniq emas</h1>
        <p className={`mt-2 max-w-xs text-sm ${muted}`}>
          Telefon sizning aniq joyingizni topa olmadi. Sozlamalarda «Aniq joylashuv» (Precise location) va GPS yoqilganini tekshiring, deraza yoniga yoki ochiq joyga chiqib qayta urinib ko‘ring.
        </p>
        <RetryBtn onRetry={onRetry} isLight={isLight} />
      </>
    )
  }
  return (
    <>
      <div className={`mb-5 flex h-24 w-24 items-center justify-center rounded-full ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500'}`}>
        <MapPin size={40} />
      </div>
      <h1 className="text-xl font-extrabold">{failure ? FAILURE_COPY[failure].title : 'Tasdiqlab bo‘lmadi'}</h1>
      <p className={`mt-2 max-w-xs text-sm ${muted}`}>
        {failure
          ? FAILURE_COPY[failure].body
          : 'Joylashuvga ruxsat bering yoki qavat sardoriga ayting — u sizni qo‘lda belgilaydi.'}
      </p>
      <RetryBtn onRetry={onRetry} isLight={isLight} />
    </>
  )
}

function RetryBtn({ onRetry, isLight }: { onRetry: () => void; isLight: boolean }) {
  return (
    <button
      type="button" onClick={onRetry}
      className={`mt-6 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-wider ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-slate-300 hover:bg-white/5'}`}
    >
      <RefreshCw size={13} /> Qayta urinish
    </button>
  )
}
