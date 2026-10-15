'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  MapPin,
  Loader2,
  RefreshCw,
  Home,
  ShieldCheck,
  Sparkles,
  Compass,
  Clock,
  Radio,
  DoorClosed,
  AlertTriangle,
  ChevronRight,
  Crosshair,
  CheckCircle2,
  Send,
  Building2,
} from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'
import { getAuthHeaders } from '@/lib/auth-session'
import { clearAttendanceSummary, fetchAttendanceSummary } from '@/features/attendance/client/summary'
import { fetchStudentProfile } from '@/features/profile/client/api'
import type { CheckinResult } from '@/features/attendance/types'
import type { StudentProfilePayload } from '@/features/profile/types'

type Failure =
  | 'no_response'
  | 'no_geolocation'
  | 'denied'
  | 'position'
  | 'timeout'
  | 'rate_limited'
  | 'auth'
  | 'server'
  | 'network'

const FAILURE_COPY: Record<Failure, { title: string; body: string; tip: string }> = {
  no_response: {
    title: 'Joylashuv javob bermadi',
    body: 'Brauzer joylashuvni bera olmadi. Agar ruxsat so‘rovi chiqqan bo‘lsa, «Ruxsat berish»ni tanlang.',
    tip: 'Telefonda GPS’ni yoqing va sahifani Chrome yoki Safari’da oching (Telegram ichki brauzeridan emas).',
  },
  no_geolocation: {
    title: 'Brauzer geolokatsiyani qo‘llamaydi',
    body: 'Ushbu brauzerda joylashuv funksiyasi mavjud emas.',
    tip: 'Sahifani zamonaviy Chrome, Safari yoki Samsung Internet brauzerida ochib qayta urining.',
  },
  denied: {
    title: 'Joylashuvga ruxsat berilmagan',
    body: 'Brauzer sozlamalarida joylashuv so‘roviga taqiq qo‘yilgan.',
    tip: 'Manzil satridagi qulf belgisini bosing → Joylashuv → «Ruxsat berish»ni tanlang va qayta urining.',
  },
  position: {
    title: 'Joylashuv aniqlanmadi',
    body: 'Telefonda GPS o‘chiq yoki bino ichida sun‘iy yo‘ldosh signali sust.',
    tip: 'GPS va Wi-Fi’ni yoqing, deraza yoniga yaqinlashib qayta urinib ko‘ring.',
  },
  timeout: {
    title: 'Signal kutilgandan uzoq cho‘zildi',
    body: 'GPS signali o‘z vaqtida yetib kelmadi.',
    tip: 'Ochiq joyga yoki deraza yoniga o‘ting, telefon sozlamalarida «Aniq joylashuv» (Precise location) yoqilganini tekshiring.',
  },
  rate_limited: {
    title: 'Juda ko‘p urinish qilindi',
    body: 'Qisqa vaqt ichida ko‘p marta tasdiqlash tugmasi bosildi.',
    tip: 'Biroz kuting yoki qavat sardoringizga ayting — u sizni ro‘yxatda belgilab qo‘yadi.',
  },
  auth: {
    title: 'Hisob tasdiqlanmadi',
    body: 'Sessiya muddati tugagan yoki ruxsatda cheklov mavjud.',
    tip: 'Ilovadan chiqib qayta kiring yoki qavat sardoriga murojaat qiling.',
  },
  server: {
    title: 'Serverda vaqtinchalik uzilish',
    body: 'Server so‘rovni qayta ishlashda vaqtincha javob bermadi.',
    tip: 'Birozdan so‘ng qayta urinib ko‘ring yoki sardorga qo‘lda belgilashini ayting.',
  },
  network: {
    title: 'Internet aloqasi yo‘q',
    body: 'Internet ulanishi uzilgani sababli so‘rov serverga yetib bormadi.',
    tip: 'Mobil internet yoki Wi-Fi ulanishini tekshirib, qayta urinib ko‘ring.',
  },
}

type Phase = 'idle' | 'measuring' | 'measured' | 'sending' | 'done' | 'no_session' | 'on_leave'

type ProbeData = {
  distanceM: number
  radiusM: number
  isWithinRadius: boolean
  dormName?: string | null
  coords: { lat: number; lng: number; accuracy: number }
}

export default function TalabaYoqlamaPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const [phase, setPhase] = useState<Phase>('idle')
  const [probeData, setProbeData] = useState<ProbeData | null>(null)
  const [result, setResult] = useState<CheckinResult | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [checking, setChecking] = useState(true)
  const [closesAt, setClosesAt] = useState<string | null>(null)
  const [profile, setProfile] = useState<StudentProfilePayload['profile'] | null>(null)
  const [confirmedTime, setConfirmedTime] = useState<string | null>(null)
  const submitting = useRef(false)

  const checkSession = useCallback(async () => {
    setChecking(true)
    try {
      const [data, profilePayload] = await Promise.all([
        fetchAttendanceSummary(),
        fetchStudentProfile().catch(() => null),
      ])

      if (profilePayload?.profile) {
        setProfile(profilePayload.profile)
      }

      if (data.ok && data.onLeave) {
        setPhase('on_leave')
      } else if (data.ok && data.hasOpen && (data.myState === 'present' || data.myState === 'excused')) {
        setResult({ status: 'already', state: data.myState })
        setConfirmedTime(new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }))
        setPhase('done')
      } else {
        if (data.ok && data.hasOpen) {
          setClosesAt(data.closesAt ?? null)
          setPhase('idle')
        } else {
          setPhase('no_session')
        }
      }
    } catch {
      setPhase('no_session')
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  // 1-BOSQICH: Masofani o'lchash (yo'qlamani yubormasdan oldin masofani ko'rsatish)
  const measureDistance = useCallback(() => {
    if (submitting.current) return
    setFailure(null)
    if (!('geolocation' in navigator)) {
      setResult({ status: 'unavailable' })
      setFailure('no_geolocation')
      setPhase('done')
      return
    }
    submitting.current = true
    setPhase('measuring')

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

    const probe = async (pos: GeolocationPosition) => {
      if (settled) return
      settled = true
      window.clearTimeout(watchdog)
      try {
        const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' }
        const res = await fetch('/api/attendance/checkin', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            probe: true, // Only calculate distance, do not record attendance yet
          }),
        })
        const data = (await res.json().catch(() => null)) as (
          | Exclude<CheckinResult, { status: 'probe' }>
          | Extract<CheckinResult, { status: 'probe' }>
        ) | null

        if (!res.ok || !data) {
          setResult({ status: 'unavailable' })
          setFailure(
            res.status === 429
              ? 'rate_limited'
              : res.status === 401 || res.status === 403
                ? 'auth'
                : 'server',
          )
          setPhase('done')
        } else if (data.status === 'probe' && typeof data.distanceM === 'number') {
          // Distance measured successfully! Show the student before they submit.
          setProbeData({
            distanceM: data.distanceM,
            radiusM: data.radiusM ?? 1000,
            isWithinRadius: data.isWithinRadius ?? data.distanceM <= (data.radiusM ?? 1000),
            dormName: data.dormName,
            coords: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            },
          })
          setPhase('measured')
        } else if (data.status === 'retry') {
          setResult({ status: 'retry' })
          setPhase('done')
        } else {
          setResult(data)
          setPhase('done')
        }
      } catch {
        setResult({ status: 'unavailable' })
        setFailure('network')
        setPhase('done')
      } finally {
        submitting.current = false
      }
    }

    const locate = (highAccuracy: boolean) => {
      navigator.geolocation.getCurrentPosition(
        probe,
        (err) => {
          if (err.code === err.PERMISSION_DENIED) return fail('denied')
          if (highAccuracy) return locate(false)
          fail(err.code === err.TIMEOUT ? 'timeout' : 'position')
        },
        { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 15_000 : 10_000, maximumAge: 0 },
      )
    }

    const start = async () => {
      try {
        const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
        if (status?.state === 'denied') return fail('denied')
      } catch {
        /* permissions api fallback */
      }
      if (!settled) locate(true)
    }
    void start()
  }, [])

  // 2-BOSQICH: Yakuniy tasdiqlash va yo'qlamani serverga yuborish
  const submitConfirmedCheckin = useCallback(async () => {
    if (!probeData || submitting.current) return
    submitting.current = true
    setPhase('sending')

    try {
      const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' }
      const res = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          lat: probeData.coords.lat,
          lng: probeData.coords.lng,
          accuracy: probeData.coords.accuracy,
          // probe is omitted, so this is the real submission
        }),
      })
      const data = (await res.json().catch(() => null)) as (CheckinResult & { error?: string }) | null

      if (!res.ok || !data || typeof data.status !== 'string') {
        setResult({ status: 'unavailable' })
        setFailure(
          res.status === 429
            ? 'rate_limited'
            : res.status === 401 || res.status === 403
              ? 'auth'
              : 'server',
        )
      } else {
        setResult(data)
        if (data.status === 'present') {
          setConfirmedTime(new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }))
        }
      }
    } catch {
      setResult({ status: 'unavailable' })
      setFailure('network')
    } finally {
      submitting.current = false
      clearAttendanceSummary()
      setPhase('done')
    }
  }, [probeData])

  const retry = () => {
    setResult(null)
    setFailure(null)
    setProbeData(null)
    setPhase('idle')
  }

  // Format closing time
  const formattedClosesAt = closesAt
    ? new Date(closesAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div
      className={`relative min-h-screen min-w-0 overflow-x-clip transition-colors duration-300 ${
        isLight ? 'bg-gradient-to-b from-slate-50 via-sky-50/30 to-indigo-50/20 text-slate-900' : 'bg-[#030712] text-white'
      }`}
    >
      {/* Dynamic Ambient Background Aurora */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className={`absolute -right-20 -top-20 h-96 w-96 rounded-full blur-[100px] transition-opacity duration-700 ${
            phase === 'done' && result?.status === 'present'
              ? 'bg-emerald-500/20'
              : (phase === 'done' && result?.status === 'outside') || (phase === 'measured' && !probeData?.isWithinRadius)
                ? 'bg-rose-500/20'
                : isLight
                  ? 'bg-sky-400/20'
                  : 'bg-indigo-600/20'
          }`}
        />
        <div
          className={`absolute -bottom-20 -left-20 h-96 w-96 rounded-full blur-[100px] transition-opacity duration-700 ${
            phase === 'done' && result?.status === 'present'
              ? 'bg-teal-500/20'
              : isLight
                ? 'bg-indigo-300/15'
                : 'bg-purple-600/15'
          }`}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-160px)] max-w-lg flex-col justify-between px-2 min-[340px]:px-3 min-[380px]:px-4 py-2 min-[360px]:py-4 sm:py-6">
        {/* Top Header Bar */}
        <div className="flex min-w-0 items-center justify-between gap-1.5">
          <Link
            href="/talaba/dashboard"
            prefetch={false}
            data-student-button="plain"
            className={`no-shelf inline-flex h-8 min-[340px]:h-9 items-center gap-1 rounded-xl border px-2 min-[340px]:px-3 text-[11px] min-[340px]:text-xs font-bold uppercase tracking-wider backdrop-blur-md transition-all active:scale-95 ${
              isLight
                ? 'border-slate-200/90 bg-white/80 text-slate-700 hover:bg-white shadow-xs'
                : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white shadow-xs'
            }`}
          >
            <ArrowLeft size={13} className="shrink-0" />
            <span className="hidden min-[340px]:inline">Asosiy </span>
            <span>panel</span>
          </Link>

          {/* Session Status Pill */}
          <div className="flex items-center gap-1.5 shrink-0">
            {phase === 'idle' || phase === 'measuring' || phase === 'measured' || phase === 'sending' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 min-[340px]:px-2.5 py-0.5 min-[340px]:py-1 text-[10px] min-[360px]:text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300 backdrop-blur-md whitespace-nowrap">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden min-[340px]:inline">Jonli </span>
                <span>yo‘qlama</span>
              </span>
            ) : phase === 'on_leave' ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/15 px-2 min-[340px]:px-2.5 py-0.5 min-[340px]:py-1 text-[10px] min-[360px]:text-[11px] font-bold text-sky-600 dark:text-sky-300 whitespace-nowrap">
                <Home size={11} />
                <span>Uyda</span>
              </span>
            ) : (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 min-[340px]:px-2.5 py-0.5 min-[340px]:py-1 text-[10px] min-[360px]:text-[11px] font-semibold backdrop-blur-md whitespace-nowrap ${
                  isLight ? 'border-slate-200 bg-white/60 text-slate-500' : 'border-white/10 bg-white/5 text-slate-400'
                }`}
              >
                <Clock size={11} />
                <span>Nazorat</span>
              </span>
            )}
          </div>
        </div>

        {/* Center Main Stage Card */}
        <div className="my-auto py-2 min-[360px]:py-4 sm:py-6">
          <AnimatePresence mode="wait">
            {checking ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`no-shelf mx-auto flex w-full flex-col items-center justify-center rounded-2xl border p-6 sm:p-10 text-center backdrop-blur-xl ${
                  isLight ? 'border-slate-200/90 bg-white/95 shadow-lg shadow-slate-200/40' : 'border-white/10 bg-slate-900/60 shadow-xl shadow-black/40'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
                <p className="mt-3.5 text-sm font-bold text-slate-800 dark:text-slate-100">
                  Yo‘qlama holati tekshirilmoqda...
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Yotoqxona ma’lumotlar bazasi bilan bog‘lanilmoqda</p>
              </motion.div>
            ) : phase === 'on_leave' ? (
              <motion.div
                key="on_leave"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className={`no-shelf mx-auto w-full rounded-2xl border p-5 min-[360px]:p-6 text-center backdrop-blur-xl ${
                  isLight
                    ? 'border-sky-200 bg-white/95 shadow-lg shadow-sky-900/5'
                    : 'border-sky-500/20 bg-sky-500/[0.04] shadow-xl shadow-black/40'
                }`}
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 shadow-xs">
                  <Home size={22} strokeWidth={2} />
                </div>

                <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-300">
                  <ShieldCheck size={12} />
                  <span>Rasmiy ruxsatnoma</span>
                </div>

                <h1 className="mt-2.5 text-lg min-[360px]:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Siz uyda deb belgilangansiz
                </h1>

                <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Tasdiqlangan «Uyga ketish» arizangiz mavjud. Yo‘qlamada geolokatsiya talab etilmaydi va
                  «kelmadi» hisoblanmaysiz.
                </p>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:gap-2.5">
                  <Link
                    href="/talaba/uyga-ketish"
                    prefetch={false}
                    data-student-button="plain"
                    className="no-shelf inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-sky-500 active:scale-95"
                  >
                    <span>Arizani ko‘rish</span>
                    <ChevronRight size={13} />
                  </Link>
                  <Link
                    href="/talaba/dashboard"
                    prefetch={false}
                    data-student-button="plain"
                    className={`no-shelf inline-flex items-center justify-center rounded-xl border px-4 py-3 text-xs font-bold transition active:scale-95 ${
                      isLight
                        ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    Asosiy sahifa
                  </Link>
                </div>
              </motion.div>
            ) : phase === 'no_session' ? (
              <motion.div
                key="no_session"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className={`no-shelf mx-auto w-full rounded-2xl border p-5 min-[360px]:p-6 text-center backdrop-blur-xl ${
                  isLight ? 'border-slate-200/90 bg-white/95 shadow-lg shadow-slate-200/40' : 'border-white/10 bg-slate-900/60 shadow-xl shadow-black/40'
                }`}
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-xs">
                  <Clock size={22} strokeWidth={2} />
                </div>

                <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  <Radio size={12} className="animate-pulse" />
                  <span>Kechki yo‘qlama kutilmoqda</span>
                </div>

                <h1 className="mt-2.5 text-lg min-[360px]:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Hozircha yo‘qlama boshlanmadi
                </h1>

                <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  Yo‘qlama jadval bo‘yicha boshlanganda ushbu sahifada tasdiqlash tugmasi faollashadi hamda bildirishnoma xabari yuboriladi.
                </p>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:gap-2.5">
                  <button
                    type="button"
                    onClick={() => void checkSession()}
                    data-student-button="plain"
                    className="no-shelf inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-indigo-500 active:scale-95"
                  >
                    <RefreshCw size={13} />
                    <span>Qayta tekshirish</span>
                  </button>
                  <Link
                    href="/talaba/dashboard"
                    prefetch={false}
                    data-student-button="plain"
                    className={`no-shelf inline-flex items-center justify-center rounded-xl border px-4 py-3 text-xs font-bold transition active:scale-95 ${
                      isLight
                        ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    Asosiy sahifa
                  </Link>
                </div>
              </motion.div>
            ) : phase === 'done' && result ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full"
              >
                <ResultView
                  result={result}
                  failure={failure}
                  isLight={isLight}
                  confirmedTime={confirmedTime}
                  profile={profile}
                  onRetry={retry}
                />
              </motion.div>
            ) : phase === 'measured' && probeData ? (
              /* MASOFA ANIQ KO'RSATILGAN HOLAT (Yo'qlamani yuborishdan oldin) */
              <motion.div
                key="measured"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className={`no-shelf relative mx-auto w-full overflow-hidden rounded-2xl border p-3.5 min-[340px]:p-5 sm:p-6 text-center backdrop-blur-xl ${
                  probeData.isWithinRadius
                    ? isLight
                      ? 'border-emerald-200/90 bg-white/95 shadow-lg shadow-emerald-900/5'
                      : 'border-emerald-500/25 bg-slate-900/60 shadow-xl shadow-black/50'
                    : isLight
                      ? 'border-rose-200/90 bg-white/95 shadow-lg shadow-rose-900/5'
                      : 'border-rose-500/25 bg-slate-900/60 shadow-xl shadow-black/50'
                }`}
              >
                {/* Refined Academic Status Badge */}
                <div className="mx-auto mb-2.5 flex items-center justify-center">
                  <div
                    className={`flex h-11 w-11 min-[340px]:h-12 min-[340px]:w-12 items-center justify-center rounded-xl border transition-all ${
                      probeData.isWithinRadius
                        ? isLight
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-600 shadow-xs'
                          : 'border-emerald-500/30 bg-emerald-950/40 text-emerald-400 shadow-xs'
                        : isLight
                          ? 'border-rose-200 bg-rose-50 text-rose-600 shadow-xs'
                          : 'border-rose-500/30 bg-rose-950/40 text-rose-400 shadow-xs'
                    }`}
                  >
                    {probeData.isWithinRadius ? (
                      <CheckCircle2 size={22} strokeWidth={2.2} />
                    ) : (
                      <AlertTriangle size={22} strokeWidth={2.2} />
                    )}
                  </div>
                </div>

                {/* Status Chip */}
                <div className="min-w-0">
                  <span
                    className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 min-[340px]:px-2.5 py-0.5 text-[10px] min-[340px]:text-[11px] font-bold uppercase tracking-wider ${
                      probeData.isWithinRadius
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        probeData.isWithinRadius ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                      }`}
                    />
                    <span className="truncate">
                      {probeData.isWithinRadius ? 'Yotoqxona hududidasiz' : 'Yotoqxonadan uzoqdasiz'}
                    </span>
                  </span>

                  {/* Clean Distance Metric Box */}
                  <div
                    className={`mt-3 rounded-xl border p-2.5 min-[340px]:p-3.5 text-center ${
                      probeData.isWithinRadius
                        ? isLight
                          ? 'border-emerald-100 bg-emerald-50/50'
                          : 'border-emerald-500/15 bg-emerald-500/[0.04]'
                        : isLight
                          ? 'border-rose-100 bg-rose-50/50'
                          : 'border-rose-500/15 bg-rose-500/[0.04]'
                    }`}
                  >
                    <p className="text-[9px] min-[340px]:text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Yotoqxonagacha bo‘lgan masofa
                    </p>
                    <div className="mt-1 flex items-baseline justify-center gap-1">
                      <span
                        className={`text-2xl min-[340px]:text-3xl font-extrabold font-mono tracking-tight tabular-nums ${
                          probeData.isWithinRadius
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        ~{probeData.distanceM}
                      </span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">metr</span>
                    </div>

                    {/* Progress Bar against Allowed Radius */}
                    <div className="mt-2 mx-auto max-w-xs">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            probeData.isWithinRadius ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                          style={{
                            width: `${Math.min(100, Math.max(8, (probeData.distanceM / (probeData.radiusM || 100)) * 100))}%`,
                          }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-[9px] min-[340px]:text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        <span>0m</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Ruxsat chegarasi: {probeData.radiusM}m
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mx-auto mt-2 max-w-xs text-[11px] min-[340px]:text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {probeData.isWithinRadius ? (
                      'Siz ruxsat etilgan radius ichidasiz. Yo‘qlamangiz jurnalda «Hozir» deb qayd etilishi uchun tasdiqlang.'
                    ) : (
                      <>
                        <strong className="text-rose-600 dark:text-rose-400">Ogohlantirish:</strong> Belgilangan masofadan uzoqdasiz. Agar hozir yuborsangiz, «Uzrsiz yo‘q» deb qayd etilasiz.
                      </>
                    )}
                  </p>
                </div>

                {/* Dorm Details Box */}
                <div
                  className={`mt-3 rounded-xl border p-2.5 text-left text-xs ${
                    probeData.isWithinRadius
                      ? isLight
                        ? 'border-slate-200/80 bg-slate-50/80 text-slate-700'
                        : 'border-white/10 bg-white/[0.02] text-slate-300'
                      : isLight
                        ? 'border-slate-200/80 bg-slate-50/80 text-slate-700'
                        : 'border-white/10 bg-white/[0.02] text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 shrink-0">
                      <Building2 size={13} className="text-indigo-500 shrink-0" />
                      <span>Bino:</span>
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white truncate">
                      {probeData.dormName || 'Talabalar turar joyi'}
                    </span>
                  </div>

                  {profile?.room_number && (
                    <div className="flex items-center justify-between gap-1 mt-1.5 pt-1.5 border-t border-slate-200/50 dark:border-white/5">
                      <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 shrink-0">
                        <DoorClosed size={13} className="text-indigo-500 shrink-0" />
                        <span>Xonangiz:</span>
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white truncate">
                        #{profile.room_number}-xona
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-3.5 space-y-2">
                  {probeData.isWithinRadius ? (
                    <>
                      <button
                        type="button"
                        onClick={submitConfirmedCheckin}
                        data-student-button="plain"
                        className="no-shelf flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 px-2 min-[340px]:px-4 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition active:scale-95"
                      >
                        <Send size={14} className="shrink-0" />
                        <span>Tasdiqlash</span>
                      </button>

                      <button
                        type="button"
                        onClick={measureDistance}
                        data-student-button="plain"
                        className={`no-shelf flex w-full items-center justify-center gap-1.5 rounded-xl border py-2.5 px-2 min-[340px]:px-4 text-xs font-bold transition active:scale-95 ${
                          isLight
                            ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <RefreshCw size={12} className="shrink-0" />
                        <span>Qayta o‘lchash</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={measureDistance}
                        data-student-button="plain"
                        className="no-shelf flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 py-3 px-2 min-[340px]:px-4 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition active:scale-95"
                      >
                        <RefreshCw size={13} className="shrink-0" />
                        <span>Qayta o‘lchash</span>
                      </button>

                      <button
                        type="button"
                        onClick={submitConfirmedCheckin}
                        data-student-button="plain"
                        className="no-shelf flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 py-2.5 px-2 min-[340px]:px-4 text-xs font-bold text-rose-500 transition hover:bg-rose-500/10 active:scale-95"
                      >
                        <AlertTriangle size={12} className="shrink-0" />
                        <span>Baribir yuborish</span>
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ) : (
              /* Idle, Measuring, or Sending Stage */
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className={`no-shelf relative mx-auto w-full overflow-hidden rounded-2xl border p-3.5 min-[340px]:p-5 sm:p-6 text-center backdrop-blur-xl ${
                  isLight
                    ? 'border-slate-200/90 bg-white/95 shadow-lg shadow-slate-200/40'
                    : 'border-white/10 bg-slate-900/60 shadow-xl shadow-black/40'
                }`}
              >
                {/* Academic Refined Icon Badge */}
                <div className="relative mx-auto mb-2.5 flex items-center justify-center">
                  {phase === 'measuring' && (
                    <motion.div
                      animate={{ scale: [1, 1.45], opacity: [0.5, 0] }}
                      transition={{ repeat: Infinity, duration: 1.6, ease: 'easeOut' }}
                      className="absolute h-14 w-14 rounded-full bg-indigo-500/20"
                    />
                  )}
                  <div
                    className={`relative flex h-11 w-11 min-[340px]:h-12 min-[340px]:w-12 items-center justify-center rounded-xl border transition-all ${
                      isLight
                        ? 'border-indigo-100 bg-indigo-50/90 text-indigo-600 shadow-xs'
                        : 'border-indigo-500/30 bg-indigo-950/40 text-indigo-400 shadow-xs'
                    }`}
                  >
                    {phase === 'measuring' ? (
                      <Loader2 size={20} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                    ) : phase === 'sending' ? (
                      <Loader2 size={20} className="animate-spin text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <MapPin size={20} strokeWidth={2} />
                    )}
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="min-w-0">
                  <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 min-[340px]:px-2.5 py-0.5 text-[10px] min-[340px]:text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    <Building2 size={11} className="shrink-0" />
                    <span className="truncate">
                      {phase === 'measuring'
                        ? 'Masofa hisoblanmoqda...'
                        : phase === 'sending'
                          ? 'Yo‘qlama yuborilmoqda...'
                          : 'TTJ • Geolokatsiya tekshiruvi'}
                    </span>
                  </div>

                  <h1 className="mt-2 text-base min-[360px]:text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-snug">
                    {phase === 'measuring'
                      ? 'Yotoqxonagacha masofa aniqlanmoqda'
                      : phase === 'sending'
                        ? 'Davomat qayd etilmoqda'
                        : 'Yotoqxonada ekanligingizni tasdiqlang'}
                  </h1>

                  <p className="mx-auto mt-1 max-w-xs text-[11px] min-[340px]:text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {phase === 'measuring'
                      ? 'GPS signali qabul qilinmoqda, bino bilan masofa hisoblanmoqda…'
                      : phase === 'sending'
                        ? 'Davomatingiz jurnalda «Hozir» deb qayd etilmoqda…'
                        : 'Joylashuv orqali yotoqxonagacha masofa tekshiriladi, so‘ngra tasdiqlab yuborasiz.'}
                  </p>
                </div>

                {/* Clean, Non-Breaking 2-Row Context Box */}
                <div
                  className={`mt-3 rounded-xl border p-2.5 text-left text-xs ${
                    isLight ? 'border-slate-200 bg-slate-50/80 text-slate-700' : 'border-white/10 bg-white/[0.03] text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 shrink-0">
                      <DoorClosed size={13} className="text-indigo-500 shrink-0" />
                      <span>Xonangiz:</span>
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white truncate">
                      {profile?.room_number ? `#${profile.room_number}-xona` : 'Yotoqxona'}
                      {profile?.assigned_floor != null ? ` (${profile.assigned_floor}-qavat)` : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-1.5 pt-1.5 border-t border-slate-200/60 dark:border-white/5">
                    <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 shrink-0">
                      <Crosshair size={13} className="text-indigo-500 shrink-0" />
                      <span>Ruxsat radiusi:</span>
                    </span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                      100 metr
                    </span>
                  </div>
                </div>

                {/* Main Action Button */}
                <div className="mt-3.5">
                  <button
                    type="button"
                    onClick={measureDistance}
                    disabled={phase !== 'idle'}
                    data-student-button="plain"
                    className="no-shelf flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-3 px-2 min-[340px]:px-4 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {phase === 'measuring' ? (
                      <>
                        <Loader2 size={14} className="animate-spin shrink-0" />
                        <span>Aniqlanmoqda…</span>
                      </>
                    ) : (
                      <>
                        <Crosshair size={14} className="shrink-0" />
                        <span>Joylashuvni aniqlash</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Security Guarantee Box */}
                <div
                  className={`mt-3 flex items-start gap-2 rounded-xl border p-2 min-[340px]:p-2.5 text-left text-[10px] min-[340px]:text-[11px] leading-relaxed ${
                    isLight ? 'border-slate-200/70 bg-slate-50/70 text-slate-600' : 'border-white/5 bg-white/[0.02] text-slate-400'
                  }`}
                >
                  <ShieldCheck size={13} className="mt-0.5 shrink-0 text-indigo-500" />
                  <p>
                    <strong>Xavfsiz:</strong> Masofani ko‘rib, qoniqsangizgina yuborasiz. Koordinatangiz serverda saqlanmaydi.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Helper Info */}
        <div className="text-center text-[11px] text-slate-500 dark:text-slate-400">
          {formattedClosesAt ? (
            <p className="flex items-center justify-center gap-1.5 font-semibold">
              <Clock size={12} className="text-indigo-400" />
              <span>Yo‘qlama bugun soat {formattedClosesAt} gacha davom etadi</span>
            </p>
          ) : (
            <p>Muammo yuzaga kelsa, qavat sardoringizga xabar bering</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultView({
  result,
  failure,
  isLight,
  confirmedTime,
  profile,
  onRetry,
}: {
  result: CheckinResult
  failure: Failure | null
  isLight: boolean
  confirmedTime: string | null
  profile: StudentProfilePayload['profile'] | null
  onRetry: () => void
}) {
  const cardBorder = isLight ? 'border-slate-200/90 bg-white/95 shadow-lg shadow-slate-200/40' : 'border-white/10 bg-slate-900/60 shadow-xl shadow-black/40'

  // CASE 1: Present (Success!)
  if (
    result.status === 'present' ||
    (result.status === 'already' && (result.state === 'present' || result.state === 'excused'))
  ) {
    const isAlready = result.status === 'already'
    const distanceText =
      result.status === 'present'
        ? `Yotoqxonadan ~${result.distanceM}m masofada`
        : 'Yotoqxona hududida'

    return (
      <div
        className={`no-shelf mx-auto w-full rounded-2xl border p-5 min-[360px]:p-6 text-center backdrop-blur-xl ${
          isLight
            ? 'border-emerald-200 bg-white/95 shadow-lg shadow-emerald-900/5'
            : 'border-emerald-500/25 bg-slate-900/60 shadow-xl shadow-black/40'
        }`}
      >
        {/* Celebration Medallion */}
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shadow-xs">
          <CheckCircle2 size={24} strokeWidth={2.2} />
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
          <Sparkles size={12} />
          <span>{isAlready ? 'Allaqachon tasdiqlangan' : 'Muvaffaqiyatli tasdiqlandi'}</span>
        </div>

        <h1 className="mt-2.5 text-lg min-[360px]:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Siz yotoqxonadasiz! ✅
        </h1>

        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
          Davomatingiz jurnalda «Hozir» deb belgilandi va mas’ullarga yetkazildi.
        </p>

        {/* Verification Details Box */}
        <div
          className={`mt-4 rounded-xl border p-2.5 min-[340px]:p-3 text-left text-xs ${
            isLight ? 'border-emerald-200/80 bg-emerald-50/50' : 'border-emerald-500/20 bg-emerald-500/[0.04]'
          }`}
        >
          <div className="flex items-center justify-between gap-1 border-b border-emerald-500/15 pb-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Holat:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-right truncate">✅ Hozir (Kechki yo‘qlama)</span>
          </div>

          <div className="flex items-center justify-between gap-1 border-b border-emerald-500/15 py-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Aniq masofa:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white text-right truncate">{distanceText}</span>
          </div>

          <div className="flex items-center justify-between gap-1 border-b border-emerald-500/15 py-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Tasdiqlash vaqti:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white text-right truncate">
              {confirmedTime ? `Bugun, ${confirmedTime}` : 'Qayd etilgan'}
            </span>
          </div>

          {profile?.room_number && (
            <div className="flex items-center justify-between gap-1 pt-2">
              <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">Biriktirilgan xona:</span>
              <span className="font-bold text-slate-900 dark:text-white text-right truncate">#{profile.room_number}-xona</span>
            </div>
          )}
        </div>

        {/* Back Link Button */}
        <div className="mt-5">
          <Link
            href="/talaba/dashboard"
            prefetch={false}
            data-student-button="plain"
            className="no-shelf flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-emerald-500 active:scale-95"
          >
            <span>Bosh sahifa</span>
            <ChevronRight size={13} />
          </Link>
        </div>
      </div>
    )
  }

  // CASE 2: Outside Dormitory Radius
  if (result.status === 'outside' || (result.status === 'already' && result.state === 'absent')) {
    const dist = result.status === 'outside' ? result.distanceM : null

    return (
      <div
        className={`no-shelf mx-auto w-full rounded-2xl border p-5 min-[360px]:p-6 text-center backdrop-blur-xl ${
          isLight
            ? 'border-rose-200 bg-white/95 shadow-lg shadow-rose-900/5'
            : 'border-rose-500/25 bg-slate-900/60 shadow-xl shadow-black/40'
        }`}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 shadow-xs">
          <AlertTriangle size={24} strokeWidth={2.2} />
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
          <AlertTriangle size={12} />
          <span>Radiusdan tashqarida</span>
        </div>

        <h1 className="mt-2.5 text-lg min-[360px]:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Yotoqxonadan tashqaridasiz
        </h1>

        <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {dist ? (
            <>
              Siz yotoqxonadan taxminan <strong className="text-rose-600 dark:text-rose-400">{dist} metr</strong> uzoqda
              aniqlandingiz.
            </>
          ) : (
            'Sizning joylashuvingiz yotoqxona hududiga to‘g‘ri kelmadi.'
          )}
        </p>

        <div
          className={`mt-4 rounded-xl border p-3 text-left text-xs ${
            isLight ? 'border-rose-100 bg-rose-50/50 text-slate-700' : 'border-rose-500/15 bg-white/[0.02] text-slate-300'
          }`}
        >
          <p className="font-bold text-rose-600 dark:text-rose-400 mb-1">Agar yotoqxonada bo‘lsangiz:</p>
          <ul className="space-y-1 list-disc list-inside text-[11px] leading-relaxed">
            <li>Deraza yoki ochiq maydonga yaqinroq o‘ting;</li>
            <li>Telefonda Wi-Fi yoki GPS «Aniq joylashuv»ni qayta yoqing;</li>
            <li>Yoki qavat sardoringizga aytsangiz, u sizni xonada ko‘rib qo‘lda belgilab qo‘yadi.</li>
          </ul>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:gap-2.5">
          <button
            type="button"
            onClick={onRetry}
            data-student-button="plain"
            className="no-shelf inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-rose-500 active:scale-95"
          >
            <RefreshCw size={13} />
            <span>Qayta urinish</span>
          </button>
          <Link
            href="/talaba/dashboard"
            prefetch={false}
            data-student-button="plain"
            className={`no-shelf inline-flex items-center justify-center rounded-xl border px-4 py-3 text-xs font-bold transition active:scale-95 ${
              isLight
                ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Asosiy sahifa
          </Link>
        </div>
      </div>
    )
  }

  // CASE 3: Retry / Imprecise GPS Signal
  if (result.status === 'retry') {
    return (
      <div
        className={`no-shelf mx-auto w-full rounded-2xl border p-5 min-[360px]:p-6 text-center backdrop-blur-xl ${
          isLight
            ? 'border-amber-200 bg-white/95 shadow-lg shadow-amber-900/5'
            : 'border-amber-500/25 bg-slate-900/60 shadow-xl shadow-black/40'
        }`}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shadow-xs">
          <Compass size={24} strokeWidth={2.2} />
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          <Radio size={12} className="animate-pulse" />
          <span>Sust GPS signali</span>
        </div>

        <h1 className="mt-2.5 text-lg min-[360px]:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Joylashuv aniq emas
        </h1>

        <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Telefoningiz faqat taxminiy joylashuvni berdi. Aniqlik talab qilingan me’yordan past bo‘lgani sababli tasdiqlanmadi.
        </p>

        <div
          className={`mt-4 rounded-xl border p-3 text-left text-xs ${
            isLight ? 'border-amber-100 bg-amber-50/50 text-slate-700' : 'border-amber-500/15 bg-white/[0.02] text-slate-300'
          }`}
        >
          <p className="font-bold text-amber-600 dark:text-amber-400 mb-1">Tavsiyalar:</p>
          <ul className="space-y-1 list-disc list-inside text-[11px] leading-relaxed">
            <li>Telefon sozlamalarida «Aniq joylashuv» (Precise location)ni yoqing;</li>
            <li>Derazaga yaqinroq boring yoki Wi-Fi’ni yoqib qayta urinib ko‘ring;</li>
            <li>Telegram ichki brauzeridan emas, to‘liq Chrome yoki Safari’da oching.</li>
          </ul>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:gap-2.5">
          <button
            type="button"
            onClick={onRetry}
            data-student-button="plain"
            className="no-shelf inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-amber-500 active:scale-95"
          >
            <RefreshCw size={13} />
            <span>Qayta urinish</span>
          </button>
          <Link
            href="/talaba/dashboard"
            prefetch={false}
            data-student-button="plain"
            className={`no-shelf inline-flex items-center justify-center rounded-xl border px-4 py-3 text-xs font-bold transition active:scale-95 ${
              isLight
                ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Asosiy sahifa
          </Link>
        </div>
      </div>
    )
  }

  // CASE 4: Diagnostic Failures (Permission, Network, etc.)
  const failData = failure ? FAILURE_COPY[failure] : null

  return (
    <div
      className={`no-shelf mx-auto w-full rounded-2xl border p-5 min-[360px]:p-6 text-center backdrop-blur-xl ${cardBorder}`}
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-xs">
        <MapPin size={24} strokeWidth={2.2} />
      </div>

      <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-white/15 bg-slate-100 dark:bg-white/5 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
        <AlertTriangle size={12} />
        <span>Tasdiqlash to‘xtatildi</span>
      </div>

      <h1 className="mt-2.5 text-lg min-[360px]:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
        {failData ? failData.title : 'Tasdiqlab bo‘lmadi'}
      </h1>

      <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {failData
          ? failData.body
          : 'Joylashuvga ruxsat bering yoki qavat sardoriga aytsangiz, u sizni qo‘lda belgilab qo‘yadi.'}
      </p>

      {failData?.tip && (
        <div
          className={`mt-4 rounded-xl border p-3 text-left text-xs leading-relaxed ${
            isLight ? 'border-indigo-100 bg-indigo-50/50 text-slate-700' : 'border-indigo-500/20 bg-indigo-500/[0.04] text-slate-300'
          }`}
        >
          <strong className="text-indigo-600 dark:text-indigo-400">Yechim:</strong> {failData.tip}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:gap-2.5">
        <button
          type="button"
          onClick={onRetry}
          data-student-button="plain"
          className="no-shelf inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-indigo-500 active:scale-95"
        >
          <RefreshCw size={13} />
          <span>Qayta urinish</span>
        </button>
        <Link
          href="/talaba/dashboard"
          prefetch={false}
          data-student-button="plain"
          className={`no-shelf inline-flex items-center justify-center rounded-xl border px-4 py-3 text-xs font-bold transition active:scale-95 ${
            isLight
              ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          Asosiy sahifa
        </Link>
      </div>
    </div>
  )
}
