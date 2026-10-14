'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  History,
  Home,
  Info,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  PlaneTakeoff,
  PlusCircle,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import AddressMapPicker from '@/components/talaba/foreign-docs/AddressMapPicker'
import { createLeave, fetchMyLeaves, finishLeave, shareLeaveLocation } from '@/features/home-leave/client/api'
import { leaveDays } from '@/features/home-leave/domain'
import {
  LEAVE_AUTO_MAX_DAYS,
  LEAVE_CALL_LABELS,
  LEAVE_KIND_LABELS,
  LEAVE_MAX_DAYS,
  LEAVE_STATUS_LABELS,
  type HomeLeave,
  type LeaveDestinationKind,
} from '@/features/home-leave/types'
import { tashkentDateString } from '@/lib/tashkent-time'

// --- Visual Helpers & Formats ---
const DESTINATIONS: {
  kind: LeaveDestinationKind
  title: string
  desc: string
  icon: typeof Home
  badge: string
}[] = [
  {
    kind: 'uy',
    title: 'O‘z uyimga',
    desc: 'Oila va ota-onam xonadoniga',
    icon: Home,
    badge: 'Doimiy yashash joyi',
  },
  {
    kind: 'qarindosh',
    title: 'Qarindoshnikiga',
    desc: 'Amaki, tog‘a, xola yoki yaqinlar xonadoniga',
    icon: Users,
    badge: 'Yaqin qarindoshlar',
  },
  {
    kind: 'boshqa',
    title: 'Boshqa manzilga',
    desc: 'Musobaqa, davolanish, anjuman yoki xizmat safari',
    icon: Navigation,
    badge: 'Maxsus manzil',
  },
]

const QUICK_RELATIONS = ['Otam', 'Onam', 'Akam', 'Opam', 'Amakim', 'Tog‘am', 'Xolam']
const QUICK_REASONS = ['Dam olish kunlari', 'Oilaviy marosim', 'Sog‘liqni tiklash', 'Bayram ta’tili']

function formatUzbekDate(d: string, includeDayName = true): string {
  if (!d) return ''
  const date = new Date(`${d}T00:00:00`)
  const monthNames = [
    'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
    'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'
  ]
  const weekDays = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan']
  const day = date.getDate()
  const month = monthNames[date.getMonth()]
  const weekDay = weekDays[date.getDay()]
  return includeDayName ? `${day}-${month} (${weekDay})` : `${day}-${month}`
}

function addDaysToDate(dateStr: string, daysToAdd: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + daysToAdd)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function UygaKetishPage() {
  const theme = useThemeStore((s) => s.theme)
  const isLight = theme === 'light'
  const today = tashkentDateString()

  // State
  const [items, setItems] = useState<HomeLeave[] | null>(null)
  const [activeTab, setActiveTab] = useState<'form' | 'history' | 'guide'>('form')

  // Form states
  const [kind, setKind] = useState<LeaveDestinationKind>('uy')
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('+998 ')
  const [reason, setReason] = useState('')
  const [startsOn, setStartsOn] = useState(today)
  const [endsOn, setEndsOn] = useState(today)
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Modals & confirmation
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    id: string
    action: 'cancel' | 'return'
    title: string
    message: string
  } | null>(null)

  // Filter for history
  const [historyFilter, setHistoryFilter] = useState<'all' | 'returned' | 'rejected' | 'cancelled'>('all')

  const load = useCallback(async () => {
    try {
      const data = await fetchMyLeaves()
      setItems(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Yuklab bo'lmadi")
      setItems([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Calculation
  const days = endsOn >= startsOn ? leaveDays(startsOn, endsOn) : 0
  const needsReview = days > LEAVE_AUTO_MAX_DAYS
  const isPhoneValid = contactPhone.replace(/\D/g, '').length >= 9
  const isAddressValid = address.trim().length >= 5
  const isNameValid = contactName.trim().length >= 3

  const ready =
    Boolean(kind) &&
    isAddressValid &&
    isNameValid &&
    isPhoneValid &&
    days > 0 &&
    days <= LEAVE_MAX_DAYS &&
    consent

  // Quick date presets
  const applyPreset = (preset: 'today' | 'weekend' | '3days' | '7days') => {
    if (preset === 'today') {
      setStartsOn(today)
      setEndsOn(today)
    } else if (preset === '3days') {
      setStartsOn(today)
      setEndsOn(addDaysToDate(today, 2))
    } else if (preset === '7days') {
      setStartsOn(today)
      setEndsOn(addDaysToDate(today, 6))
    } else if (preset === 'weekend') {
      const d = new Date(`${today}T00:00:00`)
      const dayOfWeek = d.getDay()
      let daysUntilFriday = (5 - dayOfWeek + 7) % 7
      if (daysUntilFriday === 0 && dayOfWeek !== 5) daysUntilFriday = 7
      const fri = addDaysToDate(today, daysUntilFriday)
      const sun = addDaysToDate(fri, 2)
      setStartsOn(fri)
      setEndsOn(sun)
    }
  }

  // Quick relation tag click
  const handleRelationClick = (rel: string) => {
    if (!contactName.includes(rel)) {
      setContactName(contactName ? `${rel}: ${contactName.replace(/^.*?: /, '')}` : `${rel}: `)
    }
  }

  // Quick reason click
  const handleReasonClick = (r: string) => {
    setReason(r)
  }

  // Phone input formatting
  const handlePhoneChange = (val: string) => {
    const raw = val.replace(/[^\d+]/g, '')
    if (!raw.startsWith('+998')) {
      if (raw.startsWith('+')) setContactPhone('+998 ' + raw.replace(/^\+/, ''))
      else setContactPhone('+998 ' + raw)
    } else {
      setContactPhone(val)
    }
  }

  // Submit action
  const submit = async () => {
    if (!ready || sending) return
    setSending(true)
    try {
      const { needsReview: review } = await createLeave({
        destinationKind: kind,
        destinationAddress: address.trim(),
        destinationLat: coords?.lat ?? null,
        destinationLng: coords?.lng ?? null,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        reason: reason.trim() || undefined,
        startsOn,
        endsOn,
        consent,
      })
      toast.success(
        review
          ? 'Ariza topshirildi. 7 kundan ortiqligi sababli dekanat tasdiqlaydi.'
          : 'Ariza qabul qilindi! Yo‘qlamada “Uyda” deb qayd etilasiz.',
        { duration: 4500 }
      )
      setKind('uy')
      setAddress('')
      setCoords(null)
      setContactName('')
      setContactPhone('+998 ')
      setReason('')
      setStartsOn(today)
      setEndsOn(today)
      setConsent(false)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Yuborib bo'lmadi")
    } finally {
      setSending(false)
    }
  }

  // Act on leave (cancel or return)
  const act = async (id: string, action: 'cancel' | 'return') => {
    setBusyId(id)
    setConfirmModal(null)
    try {
      await finishLeave(id, action)
      toast.success(
        action === 'return'
          ? 'Xush kelibsiz! Qaytganingiz qayd etildi. Kechki yo‘qlamada qatnashing.'
          : 'Ariza bekor qilindi.'
      )
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Saqlab bo'lmadi")
    } finally {
      setBusyId(null)
    }
  }

  // Location sharing (GPS)
  const shareLocation = (id: string) => {
    if (!('geolocation' in navigator)) {
      toast.error('Qurilmangiz geolokatsiyani qo‘llamaydi')
      return
    }
    setBusyId(id)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const leave = await shareLeaveLocation(id, pos.coords.latitude, pos.coords.longitude)
          toast.success(
            leave.locStatus === 'far'
              ? 'Joylashuvingiz yuborildi (belgilangan manzildan uzoqda ko‘rindi).'
              : 'Joylashuvingiz tasdiqlandi!'
          )
          await load()
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Yuborib bo'lmadi")
        } finally {
          setBusyId(null)
        }
      },
      () => {
        setBusyId(null)
        toast('Joylashuv yuborilmadi. Bu ixtiyoriy.')
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60_000 }
    )
  }

  // Active / Past partition
  const open = useMemo(
    () => (items ?? []).filter((l) => (l.status === 'active' || l.status === 'pending') && l.endsOn >= today),
    [items, today]
  )
  const past = useMemo(
    () => (items ?? []).filter((l) => !open.some((o) => o.id === l.id)),
    [items, open]
  )

  const filteredPast = useMemo(() => {
    if (historyFilter === 'all') return past
    return past.filter((l) => l.status === historyFilter)
  }, [past, historyFilter])

  // Common UI styles
  const cardCls = isLight
    ? 'border-slate-200/90 bg-white shadow-sm'
    : 'border-white/10 bg-slate-900/50 shadow-black/30'
  const textTitle = isLight ? 'text-slate-900' : 'text-white'
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const inputCls = isLight
    ? 'border-slate-200 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500'
    : 'border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500 focus:bg-slate-950 focus:border-sky-500'

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4 sm:space-y-6 pb-12 overflow-x-hidden">
      {/* Top Breadcrumb & Status Pill */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <Link
          href="/talaba/dashboard"
          data-student-button="plain"
          className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold backdrop-blur-sm transition-all hover:scale-102 active:scale-98 ${
            isLight
              ? 'border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:bg-slate-50'
              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <ArrowLeft size={13} className="text-sky-500 shrink-0" />
          <span>Asosiy kabinet</span>
        </Link>

        {open.length > 0 && (
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-600 dark:text-sky-300">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500"></span>
            </span>
            <span className="truncate">{open.length} ta faol safar ruxsatnomasi</span>
          </div>
        )}
      </div>

      {/* Hero Header Banner */}
      <div
        className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border p-3.5 sm:p-6 shadow-md transition-all ${
          isLight
            ? 'border-sky-100 bg-gradient-to-br from-sky-500/10 via-white to-blue-500/5'
            : 'border-white/10 bg-gradient-to-br from-sky-600/15 via-slate-900/70 to-indigo-600/10'
        }`}
      >
        <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1 rounded-lg border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-sky-600 dark:text-sky-300">
              <PlaneTakeoff size={12} className="shrink-0" />
              <span>Yotoqxona safar nazorati</span>
            </div>
            <h1 className={`text-lg sm:text-2xl font-black tracking-tight ${textTitle}`}>
              Uyga ketish arizasi
            </h1>
            <p className={`text-xs sm:text-sm leading-relaxed ${textMuted}`}>
              Ta’til yoki safarga ketayotganda ariza yuboring. Yo‘qlamada <span className="font-semibold text-sky-500">“Uyda”</span> deb qayd etilasiz.
            </p>
          </div>

          <div className="hidden sm:flex shrink-0 flex-col items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3.5 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25">
              <Home size={20} />
            </div>
            <span className="mt-1.5 text-[11px] font-bold text-sky-600 dark:text-sky-300">Avto-tasdiq</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">7 kungacha</span>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mt-3 grid grid-cols-1 gap-1.5 pt-2 border-t border-slate-200/50 dark:border-white/5 sm:grid-cols-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            <Sparkles size={13} className="text-amber-500 shrink-0" />
            <span>1—7 kun: Tezkor avto-tasdiq</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
            <span>Yo‘qlamada “Uyda” maqomi</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            <MapPin size={13} className="text-sky-500 shrink-0" />
            <span>Xarita va GPS nazorati</span>
          </div>
        </div>
      </div>

      {/* ACTIVE LEAVES (DIGITAL BOARDING PASS STYLE) */}
      {open.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className={`flex items-center gap-1.5 text-xs sm:text-sm font-bold tracking-tight ${textTitle}`}>
              <PlaneTakeoff size={15} className="text-sky-500 shrink-0" />
              <span>Faol ruxsatnomangiz ({open.length})</span>
            </h2>
          </div>

          {open.map((leave) => {
            const leaveDayCount = leaveDays(leave.startsOn, leave.endsOn)
            const isPending = leave.status === 'pending'
            return (
              <div
                key={leave.id}
                className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border shadow-lg transition-all ${
                  isLight
                    ? 'border-sky-300/80 bg-gradient-to-b from-sky-50/90 via-white to-white'
                    : 'border-sky-500/30 bg-gradient-to-b from-sky-950/40 via-slate-900/90 to-slate-900'
                }`}
              >
                {/* Boarding Pass Top Ribbon */}
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 border-b px-3.5 sm:px-5 py-2 sm:py-3 text-xs ${
                    isLight
                      ? 'border-sky-100 bg-sky-100/50 text-sky-900'
                      : 'border-sky-500/20 bg-sky-500/10 text-sky-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-bold ${
                        isPending
                          ? 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      <span className="relative flex h-1.5 w-1.5">
                        <span
                          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                            isPending ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                        ></span>
                        <span
                          className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                            isPending ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        ></span>
                      </span>
                      {LEAVE_STATUS_LABELS[leave.status]}
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-mono opacity-60">
                      #{leave.id.slice(-5).toUpperCase()}
                    </span>
                  </div>

                  <span className="font-bold text-[10px] sm:text-[11px]">
                    {leaveDayCount} kunlik ruxsat
                  </span>
                </div>

                {/* Route visual & Destination */}
                <div className="p-3.5 sm:p-5 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sky-500">
                        Borish yo‘nalishi
                      </span>
                      <p className={`flex items-center gap-1 text-sm sm:text-base font-bold ${textTitle}`}>
                        <Home size={15} className="text-sky-500 shrink-0" />
                        <span>{LEAVE_KIND_LABELS[leave.destinationKind]}</span>
                      </p>
                      <p className={`flex items-start gap-1 text-[11px] sm:text-xs font-medium leading-tight ${textMuted}`}>
                        <MapPin size={12} className="mt-0.5 shrink-0 text-sky-500" />
                        <span className="break-words">{leave.destinationAddress}</span>
                      </p>
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sky-500">
                        Aloqa shaxsi
                      </span>
                      <p className={`text-xs sm:text-sm font-bold truncate ${textTitle}`}>
                        {leave.contactName}
                      </p>
                      <a
                        href={`tel:${leave.contactPhone}`}
                        data-student-button="plain"
                        className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:underline dark:text-sky-400"
                      >
                        <Phone size={11} />
                        <span>{leave.contactPhone}</span>
                      </a>
                    </div>
                  </div>

                  {/* Dates Ribbon Card */}
                  <div
                    className={`flex flex-col sm:flex-row items-center justify-between gap-2 rounded-xl sm:rounded-2xl border p-2.5 sm:p-3 text-xs ${
                      isLight ? 'border-slate-200/80 bg-slate-50' : 'border-white/5 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                      <div className="rounded-lg bg-sky-500/10 p-1.5 text-sky-600 dark:text-sky-400 shrink-0">
                        <Calendar size={15} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Ketish</span>
                        <p className={`font-bold text-xs truncate ${textTitle}`}>{formatUzbekDate(leave.startsOn)}</p>
                      </div>
                    </div>

                    <div className="hidden sm:flex flex-col items-center px-2">
                      <span className="text-[10px] font-semibold text-slate-400">{leaveDayCount} kun</span>
                      <div className="flex items-center gap-0.5 text-sky-500">
                        <span className="h-0.5 w-8 bg-sky-500/40 rounded-full"></span>
                        <ChevronRight size={12} />
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                      <div className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <Clock size={15} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Qaytish</span>
                        <p className={`font-bold text-xs truncate ${textTitle}`}>{formatUzbekDate(leave.endsOn)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Reason if provided */}
                  {leave.reason && (
                    <div className={`rounded-xl border px-2.5 py-1.5 text-xs ${isLight ? 'border-slate-200 bg-white text-slate-600' : 'border-white/5 bg-white/[0.01] text-slate-300'}`}>
                      <span className="font-semibold text-sky-500">Sabab: </span>
                      <span className="break-words">{leave.reason}</span>
                    </div>
                  )}

                  {/* Staff call result (tarbiyachi/sardor called the contact person) */}
                  {leave.callResult !== 'none' && (
                    <div
                      className={`flex items-center gap-1.5 text-[11px] font-semibold ${
                        leave.callResult === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      <Phone size={13} className="shrink-0" />
                      <span>{LEAVE_CALL_LABELS[leave.callResult]}</span>
                    </div>
                  )}

                  {/* Geolocation status indicator */}
                  {leave.locStatus !== 'none' && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck size={13} className="shrink-0" />
                      <span>
                        {leave.locStatus === 'far'
                          ? 'Joylashuv yuborildi (manzildan uzoqroqda)'
                          : 'Joylashuv koordinatasi tasdiqlandi'}
                      </span>
                    </div>
                  )}

                  {/* Action Buttons (Full width on 300px) */}
                  <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                    {leave.status === 'active' && leave.locStatus === 'none' && (
                      <button
                        type="button"
                        data-student-button="plain"
                        disabled={busyId === leave.id}
                        onClick={() => shareLocation(leave.id)}
                        className={`flex h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-all disabled:opacity-50 ${
                          isLight
                            ? 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100'
                            : 'border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20'
                        }`}
                      >
                        {busyId === leave.id ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
                        <span>Joylashuvni tasdiqlash (GPS)</span>
                      </button>
                    )}

                    {leave.status === 'active' && (
                      <button
                        type="button"
                        data-student-button="plain"
                        disabled={busyId === leave.id}
                        onClick={() =>
                          setConfirmModal({
                            open: true,
                            id: leave.id,
                            action: 'return',
                            title: 'Yotoqxonaga qaytdingizmi?',
                            message:
                              'Qaytganingizni tasdiqlasangiz, safar arizasi yakunlanadi va kechki yo‘qlamada o‘z xonangizda tasdiqlashingiz lozim.',
                          })
                        }
                        className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition-all hover:opacity-95 active:scale-98 disabled:opacity-50"
                      >
                        {busyId === leave.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={13} />
                        )}
                        <span>Yotoqxonaga qaytdim</span>
                      </button>
                    )}

                    <button
                      type="button"
                      data-student-button="plain"
                      disabled={busyId === leave.id}
                      onClick={() =>
                        setConfirmModal({
                          open: true,
                          id: leave.id,
                          action: 'cancel',
                          title: 'Arizani bekor qilmoqchimisiz?',
                          message:
                            'Ariza bekor qilinsa, safar muddati bekor bo‘ladi va yo‘qlamalarda odatiy tartibda ishtirok etasiz.',
                        })
                      }
                      className={`flex h-9 items-center justify-center gap-1 rounded-xl border px-3 text-xs font-semibold transition-all hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 dark:hover:bg-rose-950/20 dark:hover:border-rose-500/30 dark:hover:text-rose-400 disabled:opacity-50 ${
                        isLight ? 'border-slate-300 text-slate-600' : 'border-white/10 text-slate-400'
                      }`}
                    >
                      <XCircle size={13} />
                      <span>Bekor qilish</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── 1. TABS ROW (Single-Row Horizontal Scroll) ─── */}
      <div className="w-full max-w-full overflow-hidden">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-0.5">
          <button
            type="button"
            data-student-button="plain"
            onClick={() => setActiveTab('form')}
            className={`flex shrink-0 items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 active:scale-95 ${
              activeTab === 'form'
                ? isLight
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 border border-blue-600'
                  : 'bg-sky-500 text-white shadow-md shadow-sky-500/25 border border-sky-400'
                : isLight
                  ? 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
                  : 'bg-slate-900/60 text-slate-300 border border-white/10 hover:border-white/20 hover:bg-white/[0.06] shadow-xs'
            }`}
          >
            <PlusCircle size={15} className="shrink-0" />
            <span>Yangi ariza</span>
          </button>

          <button
            type="button"
            data-student-button="plain"
            onClick={() => setActiveTab('history')}
            className={`flex shrink-0 items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 active:scale-95 ${
              activeTab === 'history'
                ? isLight
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 border border-blue-600'
                  : 'bg-sky-500 text-white shadow-md shadow-sky-500/25 border border-sky-400'
                : isLight
                  ? 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
                  : 'bg-slate-900/60 text-slate-300 border border-white/10 hover:border-white/20 hover:bg-white/[0.06] shadow-xs'
            }`}
          >
            <History size={15} className="shrink-0" />
            <span>Arizalar tarixi</span>
            {past.length > 0 && (
              <span
                className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'history'
                    ? 'bg-white/25 text-white'
                    : isLight
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-white/10 text-slate-300'
                }`}
              >
                {past.length}
              </span>
            )}
          </button>

          <button
            type="button"
            data-student-button="plain"
            onClick={() => setActiveTab('guide')}
            className={`flex shrink-0 items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 active:scale-95 ${
              activeTab === 'guide'
                ? isLight
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 border border-blue-600'
                  : 'bg-sky-500 text-white shadow-md shadow-sky-500/25 border border-sky-400'
                : isLight
                  ? 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
                  : 'bg-slate-900/60 text-slate-300 border border-white/10 hover:border-white/20 hover:bg-white/[0.06] shadow-xs'
            }`}
          >
            <Info size={15} className="shrink-0" />
            <span>Yo‘riqnoma va qoidalar</span>
          </button>
        </div>
      </div>

      {/* TAB 1: NEW APPLICATION FORM */}
      {activeTab === 'form' && (
        <div className={`space-y-4 sm:space-y-6 rounded-2xl sm:rounded-3xl border p-3.5 sm:p-7 shadow-sm ${cardCls}`}>
          {/* Section 1: Destination Selection (Single-Row Horizontal Scroll / Carousel) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                1. Qayerga ketasiz?
              </label>
              <span className="text-[10px] text-sky-500 font-semibold">Majburiy</span>
            </div>

            {/* Single-Row Horizontal Carousel of Destination Cards */}
            <div className="w-full max-w-full overflow-hidden">
              <div className="flex gap-2.5 overflow-x-auto no-scrollbar scroll-smooth pb-2 pt-0.5 px-0.5 snap-x">
                {DESTINATIONS.map((d) => {
                  const Icon = d.icon
                  const selected = kind === d.kind
                  return (
                    <button
                      key={d.kind}
                      type="button"
                      data-student-button="plain"
                      onClick={() => setKind(d.kind)}
                      className={`snap-start relative flex flex-col justify-between p-3.5 rounded-2xl border text-left shrink-0 transition-all duration-200 w-[185px] sm:w-[210px] active:scale-98 ${
                        selected
                          ? isLight
                            ? 'border-blue-500 bg-blue-50/70 shadow-md ring-2 ring-blue-500/20'
                            : 'border-sky-400 bg-sky-500/15 shadow-md ring-2 ring-sky-400/20'
                          : isLight
                            ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 shadow-xs'
                            : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06] shadow-xs'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                            selected
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                              : isLight
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-white/10 text-slate-300'
                          }`}
                        >
                          <Icon size={18} />
                        </div>
                        {selected && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                            <Check size={11} strokeWidth={3} />
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        <span className={`block text-xs sm:text-sm font-bold ${textTitle} truncate`}>{d.title}</span>
                        <span className={`block mt-0.5 text-[10px] sm:text-[11px] leading-tight ${textMuted} line-clamp-2`}>
                          {d.desc}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Interactive Map & Detailed Address */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <label className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  2. Borish manzili va Xarita
                </label>
                <p className={`text-[10px] sm:text-[11px] ${textMuted}`}>
                  Xaritadan belgilang yoki manzilni matn qilib yozing.
                </p>
              </div>
              <span className="text-[10px] text-sky-500 font-semibold">Majburiy</span>
            </div>

            {/* UPGRADED RESPONSIVE MAP PICKER */}
            <AddressMapPicker
              isLight={isLight}
              initialCoords={coords}
              onResolved={(name) => setAddress(name)}
              onCoords={(lat, lng) => setCoords({ lat, lng })}
              showRegions={true}
            />

            {/* Address Editable Input */}
            <div className="relative">
              <textarea
                rows={2}
                value={address}
                maxLength={300}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Viloyat, tuman, shahar, ko‘cha va xonadon raqami…"
                className={`w-full rounded-xl sm:rounded-2xl border px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm outline-none transition-all ${inputCls}`}
              />
              <span className="absolute bottom-2 right-2.5 text-[10px] text-slate-400">
                {address.length}/300
              </span>
            </div>
          </div>

          {/* Section 3: Contact Person */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <label className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  3. U yerdagi aloqa shaxsi
                </label>
                <p className={`text-[10px] sm:text-[11px] ${textMuted}`}>
                  Zaruratda bog‘lanish uchun yaqin kishingiz.
                </p>
              </div>
              <span className="text-[10px] text-sky-500 font-semibold">Majburiy</span>
            </div>

            {/* Single-Row Horizontal Scroll of Relation Chips */}
            <div className="w-full max-w-full overflow-hidden">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth pb-1 pt-0.5">
                <span className={`text-[10px] sm:text-[11px] font-semibold shrink-0 ${textMuted}`}>Tezkor:</span>
                {QUICK_RELATIONS.map((rel) => (
                  <button
                    key={rel}
                    type="button"
                    data-student-button="plain"
                    onClick={() => handleRelationClick(rel)}
                    className={`shrink-0 whitespace-nowrap rounded-xl border px-3 py-1 text-[11px] font-medium transition-all hover:scale-105 active:scale-95 ${
                      isLight
                        ? 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50'
                        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-sky-500/40 hover:bg-sky-500/10'
                    }`}
                  >
                    +{rel}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="min-w-0">
                <label className={`mb-1 block text-[11px] font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  Aloqa shaxsi ismi
                </label>
                <input
                  type="text"
                  value={contactName}
                  maxLength={120}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Masalan: Otam: Aliyev Vali"
                  className={`w-full min-w-0 rounded-xl border px-3 py-2 text-xs sm:text-sm outline-none transition-all ${inputCls}`}
                />
              </div>

              <div className="min-w-0">
                <label className={`mb-1 block text-[11px] font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  Telefon raqami
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    inputMode="tel"
                    value={contactPhone}
                    maxLength={24}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="+998 90 123 45 67"
                    className={`w-full min-w-0 rounded-xl border pl-9 pr-3 py-2 text-xs sm:text-sm font-medium outline-none transition-all ${inputCls}`}
                  />
                  <Phone size={14} className="absolute left-3 top-2.5 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Travel Dates & Calculations */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <label className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  4. Safar muddatlari
                </label>
                <p className={`text-[10px] sm:text-[11px] ${textMuted}`}>
                  Ketish va qaytish kunlarini tanlang.
                </p>
              </div>
              <span className="text-[10px] text-sky-500 font-semibold">Majburiy</span>
            </div>

            {/* Single-Row Horizontal Scroll of Duration Presets */}
            <div className="w-full max-w-full overflow-hidden">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth pb-1 pt-0.5">
                <span className={`text-[10px] sm:text-[11px] font-semibold shrink-0 ${textMuted}`}>Muddat:</span>
                <button
                  type="button"
                  data-student-button="plain"
                  onClick={() => applyPreset('today')}
                  className={`shrink-0 whitespace-nowrap rounded-xl border px-3 py-1 text-[11px] font-medium transition-all hover:scale-105 active:scale-95 ${
                    isLight
                      ? 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50'
                      : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-sky-500/40 hover:bg-sky-500/10'
                  }`}
                >
                  Faqat bugun
                </button>
                <button
                  type="button"
                  data-student-button="plain"
                  onClick={() => applyPreset('weekend')}
                  className={`shrink-0 whitespace-nowrap rounded-xl border px-3 py-1 text-[11px] font-medium transition-all hover:scale-105 active:scale-95 ${
                    isLight
                      ? 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50'
                      : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-sky-500/40 hover:bg-sky-500/10'
                  }`}
                >
                  Dam olish (Jum—Yak)
                </button>
                <button
                  type="button"
                  data-student-button="plain"
                  onClick={() => applyPreset('3days')}
                  className={`shrink-0 whitespace-nowrap rounded-xl border px-3 py-1 text-[11px] font-medium transition-all hover:scale-105 active:scale-95 ${
                    isLight
                      ? 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50'
                      : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-sky-500/40 hover:bg-sky-500/10'
                  }`}
                >
                  +3 kun
                </button>
                <button
                  type="button"
                  data-student-button="plain"
                  onClick={() => applyPreset('7days')}
                  className={`shrink-0 whitespace-nowrap rounded-xl border px-3 py-1 text-[11px] font-medium transition-all hover:scale-105 active:scale-95 ${
                    isLight
                      ? 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50'
                      : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-sky-500/40 hover:bg-sky-500/10'
                  }`}
                >
                  1 hafta (7 kun)
                </button>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="min-w-0">
                <label className={`mb-1 block text-[11px] font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  Ketish sanasi
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={startsOn}
                    min={today}
                    onChange={(e) => {
                      setStartsOn(e.target.value)
                      if (endsOn < e.target.value) setEndsOn(e.target.value)
                    }}
                    className={`w-full min-w-0 max-w-full rounded-xl border px-3 py-2 text-xs sm:text-sm font-medium outline-none transition-all ${inputCls}`}
                  />
                </div>
                <p className="mt-0.5 text-[10px] text-slate-400 truncate">
                  {formatUzbekDate(startsOn)}
                </p>
              </div>

              <div className="min-w-0">
                <label className={`mb-1 block text-[11px] font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  Qaytish sanasi
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={endsOn}
                    min={startsOn}
                    onChange={(e) => setEndsOn(e.target.value)}
                    className={`w-full min-w-0 max-w-full rounded-xl border px-3 py-2 text-xs sm:text-sm font-medium outline-none transition-all ${inputCls}`}
                  />
                </div>
                <p className="mt-0.5 text-[10px] text-slate-400 truncate">
                  {formatUzbekDate(endsOn)}
                </p>
              </div>
            </div>

            {/* Dynamic Status Banner */}
            {days > 0 && (
              <div
                className={`flex items-start gap-2.5 rounded-xl border p-2.5 sm:p-3 text-xs transition-all ${
                  days > LEAVE_MAX_DAYS
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : needsReview
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {days > LEAVE_MAX_DAYS ? (
                  <ShieldAlert size={16} className="mt-0.5 shrink-0 text-rose-500" />
                ) : needsReview ? (
                  <Clock size={16} className="mt-0.5 shrink-0 text-amber-500" />
                ) : (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                )}

                <div className="space-y-0.5 min-w-0">
                  <span className="font-bold text-xs">
                    Jami muddat: {days} kun
                  </span>
                  <p className="text-[11px] leading-snug opacity-90 break-words">
                    {days > LEAVE_MAX_DAYS
                      ? `Maksimal muddat ${LEAVE_MAX_DAYS} kun. Uzoqroq muddat uchun dekanatga uchrashing.`
                      : needsReview
                        ? `${LEAVE_AUTO_MAX_DAYS} kundan ortiq bo‘lgani sababli fakultet dekani ko‘rib chiqadi.`
                        : 'Ariza darhol kuchga kiradi va yo‘qlamada “Uyda” deb qayd etilasiz.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Reason (Optional) */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
            <div className="flex items-center justify-between">
              <label className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                5. Sabab (Ixtiyoriy)
              </label>
              <span className="text-[10px] text-slate-400">Ixtiyoriy</span>
            </div>

            {/* Single-Row Horizontal Scroll of Reason Chips */}
            <div className="w-full max-w-full overflow-hidden">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth pb-1 pt-0.5">
                {QUICK_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    data-student-button="plain"
                    onClick={() => handleReasonClick(r)}
                    className={`shrink-0 whitespace-nowrap rounded-xl border px-3 py-1 text-[11px] font-medium transition-all hover:scale-105 active:scale-95 ${
                      isLight
                        ? 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50'
                        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-sky-500/40 hover:bg-sky-500/10'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Masalan: dam olish kunlari, oilaviy to‘y…"
              className={`w-full min-w-0 rounded-xl border px-3 py-2 text-xs sm:text-sm outline-none transition-all ${inputCls}`}
            />
          </div>

          {/* Section 6: Responsibility and Consent */}
          <div className="pt-2 border-t border-slate-100 dark:border-white/5">
            <label
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition-all ${
                consent
                  ? isLight
                    ? 'border-sky-300 bg-sky-50/70 text-slate-800'
                    : 'border-sky-500/40 bg-sky-500/10 text-slate-200'
                  : isLight
                    ? 'border-slate-200 bg-slate-50/50 text-slate-600'
                    : 'border-white/10 bg-white/[0.02] text-slate-400'
              }`}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 size-4 rounded text-sky-600 focus:ring-sky-500 shrink-0"
              />
              <div className="space-y-0.5 min-w-0 flex-1">
                <span className="font-bold text-xs flex items-center gap-1">
                  <ShieldCheck size={13} className="text-sky-500 shrink-0" />
                  Mas’uliyatni zimmamga olaman
                </span>
                <p className="text-[10px] sm:text-[11px] leading-snug opacity-90 break-words">
                  Ko‘rsatilgan ma’lumotlar to‘g‘riligini, belgilangan kunda yotoqxonaga qaytishimni va aloqa shaxsim bilan bog‘lanishlariga roziligimni tasdiqlayman.
                </p>
              </div>
            </label>
          </div>

          {/* Submit Action Button */}
          <button
            type="button"
            onClick={submit}
            disabled={!ready || sending}
            className="flex h-11 sm:h-12 w-full items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-3 py-2 text-xs sm:text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:opacity-95 active:scale-98 disabled:opacity-40"
          >
            {sending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Yuborilmoqda…</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>
                  {days > 0 ? `${days} kunlik ariza yuborish` : 'Ariza yuborish'}
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* TAB 2: APPLICATION HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {/* Single-Row Horizontal Scroll of Filter Pills */}
          <div className="w-full max-w-full overflow-hidden">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth pb-1">
              {[
                { id: 'all', label: 'Barchasi' },
                { id: 'returned', label: 'Qaytgan' },
                { id: 'rejected', label: 'Rad etilgan' },
                { id: 'cancelled', label: 'Bekor qilingan' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  data-student-button="plain"
                  onClick={() => setHistoryFilter(f.id as typeof historyFilter)}
                  className={`shrink-0 whitespace-nowrap rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    historyFilter === f.id
                      ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                      : isLight
                        ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {items === null ? (
            <div className={`flex flex-col items-center justify-center gap-2 py-12 rounded-2xl border ${cardCls}`}>
              <Loader2 size={20} className="animate-spin text-sky-500" />
              <span className={`text-xs ${textMuted}`}>Yuklanmoqda…</span>
            </div>
          ) : filteredPast.length === 0 ? (
            <div
              className={`flex flex-col items-center justify-center gap-2 p-8 text-center rounded-2xl border border-dashed ${
                isLight ? 'border-slate-300 bg-slate-50/50' : 'border-white/15 bg-white/[0.01]'
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
                <History size={20} />
              </div>
              <div className="space-y-0.5">
                <p className={`text-xs sm:text-sm font-bold ${textTitle}`}>Arizalar topilmadi</p>
                <p className={`text-[11px] ${textMuted}`}>
                  Ushbu toifada arizalar mavjud emas.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredPast.map((leave) => {
                const leaveDayCount = leaveDays(leave.startsOn, leave.endsOn)
                return (
                  <div key={leave.id} className={`rounded-xl sm:rounded-2xl border p-3.5 transition-all ${cardCls}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-sky-500">
                            {LEAVE_KIND_LABELS[leave.destinationKind]}
                          </span>
                          <span className="text-[10px] text-slate-400">· {leaveDayCount} kun</span>
                        </div>
                        <p className={`text-xs sm:text-sm font-bold truncate ${textTitle}`}>
                          {leave.destinationAddress}
                        </p>
                        <p className={`flex items-center gap-1 text-[11px] ${textMuted}`}>
                          <CalendarDays size={12} className="shrink-0" />
                          <span>
                            {formatUzbekDate(leave.startsOn, false)} — {formatUzbekDate(leave.endsOn, false)}
                          </span>
                        </p>
                      </div>

                      <span
                        className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                          leave.status === 'returned'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : leave.status === 'rejected'
                              ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'border-slate-500/30 bg-slate-500/10 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {leave.status === 'active' ? 'Yakunlangan' : LEAVE_STATUS_LABELS[leave.status]}
                      </span>
                    </div>

                    {leave.status === 'rejected' && leave.decisionNote && (
                      <div className="mt-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-xs text-rose-600 dark:text-rose-400">
                        <span className="font-bold">Rad etish sababi: </span>
                        {leave.decisionNote}
                      </div>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-100 dark:border-white/5 text-[10px]">
                      <span className={`truncate ${textMuted}`}>
                        Aloqa: <span className="font-medium text-slate-700 dark:text-slate-300">{leave.contactName} ({leave.contactPhone})</span>
                      </span>
                      <span className="text-slate-400 font-mono">
                        #{leave.id.slice(-5).toUpperCase()}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GUIDELINES & RULES */}
      {activeTab === 'guide' && (
        <div className="space-y-3">
          <div className={`space-y-3 rounded-2xl sm:rounded-3xl border p-4 sm:p-6 ${cardCls}`}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500 shrink-0">
                <Info size={18} />
              </div>
              <div className="min-w-0">
                <h3 className={`text-sm sm:text-base font-bold ${textTitle}`}>Safar va uyga ketish tartibi</h3>
                <p className={`text-[11px] ${textMuted}`}>Yotoqxona qoidalari haqida qisqacha</p>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
              <div className={`rounded-xl border p-3 space-y-1 ${isLight ? 'border-slate-200 bg-slate-50/60' : 'border-white/5 bg-white/[0.02]'}`}>
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-500">
                  <Sparkles size={14} className="shrink-0" />
                  <span>1. Qisqa ta’til (1—7 kun)</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${textMuted}`}>
                  Dam olish yoki oilaviy sabablar bilan berilgan arizalar tizimda darhol avtomatik tasdiqlanadi. Yo‘qlamada talaba “Uyda” deb belgilanadi.
                </p>
              </div>

              <div className={`rounded-xl border p-3 space-y-1 ${isLight ? 'border-slate-200 bg-slate-50/60' : 'border-white/5 bg-white/[0.02]'}`}>
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                  <Clock size={14} className="shrink-0" />
                  <span>2. Uzoq muddat (8—30 kun)</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${textMuted}`}>
                  7 kundan ortiq muddat o‘qish jarayoniga ta’sir qilgani uchun fakultet dekani ko‘rib chiqishi va tasdiqlashi talab etiladi.
                </p>
              </div>

              <div className={`rounded-xl border p-3 space-y-1 ${isLight ? 'border-slate-200 bg-slate-50/60' : 'border-white/5 bg-white/[0.02]'}`}>
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                  <MapPin size={14} className="shrink-0" />
                  <span>3. Xarita va Geolokatsiya</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${textMuted}`}>
                  Xaritadan manzilni belgilash talaba xavfsizligini ta’minlaydi. Safarga yetgach GPS joylashuvni ixtiyoriy 1 marta tasdiqlash mumkin.
                </p>
              </div>

              <div className={`rounded-xl border p-3 space-y-1 ${isLight ? 'border-slate-200 bg-slate-50/60' : 'border-white/5 bg-white/[0.02]'}`}>
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-500">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>4. Yotoqxonaga qaytgach</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${textMuted}`}>
                  Yetib kelganingiz zahoti “Yotoqxonaga qaytdim” tugmasini bosing va kechki yo‘qlamada o‘zingizni odatiy tartibda tasdiqlang.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className={`w-full max-w-[calc(100vw-1.5rem)] sm:max-w-md space-y-3 rounded-2xl border p-4 sm:p-6 shadow-2xl ${
              isLight ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-slate-900 text-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  confirmModal.action === 'return'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-rose-500/10 text-rose-500'
                }`}
              >
                {confirmModal.action === 'return' ? <CheckCircle2 size={20} /> : <ShieldAlert size={20} />}
              </div>
              <button
                type="button"
                data-student-button="plain"
                onClick={() => setConfirmModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-bold">{confirmModal.title}</h3>
              <p className={`text-[11px] sm:text-xs leading-relaxed ${textMuted}`}>{confirmModal.message}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                data-student-button="plain"
                onClick={() => setConfirmModal(null)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                  isLight ? 'border-slate-300 hover:bg-slate-100' : 'border-white/10 hover:bg-white/5'
                }`}
              >
                Ortga
              </button>
              <button
                type="button"
                data-student-button="plain"
                onClick={() => act(confirmModal.id, confirmModal.action)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold text-white shadow-md ${
                  confirmModal.action === 'return'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {confirmModal.action === 'return' ? 'Ha, qaytdim' : 'Bekor qilinsin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
