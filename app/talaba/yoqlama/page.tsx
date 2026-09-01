'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MapPin, Check, X, Loader2, RefreshCw } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'
import { getAuthHeaders } from '@/lib/auth-session'
import type { CheckinResult } from '@/features/attendance/types'

type Phase = 'idle' | 'locating' | 'sending' | 'done' | 'no_session'

export default function TalabaYoqlamaPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<CheckinResult | null>(null)
  const [checking, setChecking] = useState(true)
  const submitting = useRef(false)

  const checkSession = useCallback(async () => {
    setChecking(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/attendance/summary', { headers, cache: 'no-store' })
      const data = await res.json()
      setPhase(res.ok && data.hasOpen ? 'idle' : 'no_session')
    } catch {
      setPhase('no_session')
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => { checkSession() }, [checkSession])

  const confirm = useCallback(() => {
    if (submitting.current) return
    if (!('geolocation' in navigator)) {
      setResult({ status: 'unavailable' }); setPhase('done'); return
    }
    submitting.current = true
    setPhase('locating')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
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
          const data = (await res.json()) as CheckinResult
          setResult(data)
        } catch {
          setResult({ status: 'unavailable' })
        } finally {
          submitting.current = false
          setPhase('done')
        }
      },
      () => {
        submitting.current = false
        setResult({ status: 'unavailable' })
        setPhase('done')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }, [])

  const retry = () => { setResult(null); setPhase('idle') }

  return (
    <div className={`min-h-screen ${isLight ? 'bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900' : 'bg-[#020617] text-white'}`}>
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
        <Link href="/talaba/dashboard" className={`inline-flex w-fit items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-black uppercase tracking-wider ${isLight ? 'border-slate-300 text-slate-600' : 'border-white/10 text-slate-400'}`}>
          <ArrowLeft size={14} /> Asosiy
        </Link>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {checking ? (
            <Loader2 className="animate-spin text-slate-400" />
          ) : phase === 'no_session' ? (
            <>
              <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500'}`}>
                <MapPin size={26} />
              </div>
              <h1 className="text-lg font-black">Hozircha yo‘qlama yo‘q</h1>
              <p className={`mt-1.5 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Yo‘qlama boshlanganda sizga xabar keladi.
              </p>
            </>
          ) : phase === 'done' && result ? (
            <ResultView result={result} isLight={isLight} onRetry={retry} />
          ) : (
            <>
              <div className={`mb-5 flex h-24 w-24 items-center justify-center rounded-full ${isLight ? 'bg-blue-50 text-blue-500' : 'bg-blue-500/10 text-blue-400'}`}>
                <MapPin size={40} />
              </div>
              <h1 className="text-xl font-black tracking-tight">Yotoqxonadamisiz?</h1>
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

function ResultView({ result, isLight, onRetry }: { result: CheckinResult; isLight: boolean; onRetry: () => void }) {
  const muted = isLight ? 'text-slate-500' : 'text-slate-400'
  if (result.status === 'present' || (result.status === 'already' && result.state === 'present')) {
    return (
      <>
        <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
          <Check size={44} />
        </div>
        <h1 className="text-xl font-black">Tasdiqlandi ✅</h1>
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
        <h1 className="text-xl font-black">Yotoqxonadan tashqarida</h1>
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
        <h1 className="text-xl font-black">Joylashuv aniq emas</h1>
        <p className={`mt-2 max-w-xs text-sm ${muted}`}>Deraza yoniga borib qayta urinib ko‘ring.</p>
        <RetryBtn onRetry={onRetry} isLight={isLight} />
      </>
    )
  }
  return (
    <>
      <div className={`mb-5 flex h-24 w-24 items-center justify-center rounded-full ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500'}`}>
        <MapPin size={40} />
      </div>
      <h1 className="text-xl font-black">Tasdiqlab bo‘lmadi</h1>
      <p className={`mt-2 max-w-xs text-sm ${muted}`}>
        Joylashuvga ruxsat bering yoki qavat sardoriga ayting — u sizni qo‘lda belgilaydi.
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
