'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, CheckCircle2, Home, Loader2, MapPin, Phone, Send, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import CustomSelect from '@/components/ui/CustomSelect'
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

const STATUS_CLASS = {
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/25',
  active: 'bg-sky-500/10 text-sky-500 border-sky-500/25',
  returned: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25',
  cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/25',
  rejected: 'bg-rose-500/10 text-rose-500 border-rose-500/25',
} as const

const KIND_OPTIONS = (Object.keys(LEAVE_KIND_LABELS) as LeaveDestinationKind[]).map((k) => ({
  value: k,
  label: LEAVE_KIND_LABELS[k],
}))

function formatRange(leave: HomeLeave): string {
  const f = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })
  return leave.startsOn === leave.endsOn ? f(leave.startsOn) : `${f(leave.startsOn)} — ${f(leave.endsOn)}`
}

export default function UygaKetishPage() {
  const isLight = useThemeStore((s) => s.theme) === 'light'
  const today = tashkentDateString()
  const [items, setItems] = useState<HomeLeave[] | null>(null)
  const [kind, setKind] = useState<LeaveDestinationKind | ''>('')
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('+998')
  const [reason, setReason] = useState('')
  const [startsOn, setStartsOn] = useState(today)
  const [endsOn, setEndsOn] = useState(today)
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setItems(await fetchMyLeaves())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Yuklab bo'lmadi")
      setItems([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const days = endsOn >= startsOn ? leaveDays(startsOn, endsOn) : 0
  const needsReview = days > LEAVE_AUTO_MAX_DAYS
  const ready = !!kind && address.trim().length >= 5 && contactName.trim().length >= 3
    && contactPhone.replace(/\D/g, '').length >= 9 && days > 0 && consent

  const submit = async () => {
    if (!kind || !ready || sending) return
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
      toast.success(review ? 'Ariza dekanga yuborildi' : 'Ariza qabul qilindi — yo‘qlamada “Uyda” deb ko‘rinasiz')
      setKind('')
      setAddress('')
      setCoords(null)
      setContactName('')
      setContactPhone('+998')
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

  const act = async (id: string, action: 'cancel' | 'return') => {
    setBusyId(id)
    try {
      await finishLeave(id, action)
      toast.success(action === 'return' ? 'Qaytganingiz qayd etildi — yo‘qlamada o‘zingizni tasdiqlang' : 'Ariza bekor qilindi')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Saqlab bo'lmadi")
    } finally {
      setBusyId(null)
    }
  }

  const shareLocation = (id: string) => {
    if (!('geolocation' in navigator)) {
      toast.error('Qurilmangiz joylashuvni qo‘llamaydi')
      return
    }
    setBusyId(id)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const leave = await shareLeaveLocation(id, pos.coords.latitude, pos.coords.longitude)
          toast.success(leave.locStatus === 'far' ? 'Joylashuv yuborildi — ko‘rsatilgan manzildan uzoqda ko‘rindi' : 'Joylashuv tasdiqlandi')
          await load()
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Yuborib bo'lmadi")
        } finally {
          setBusyId(null)
        }
      },
      () => {
        setBusyId(null)
        toast('Joylashuv yuborilmadi. Bu majburiy emas — aloqa shaxsingiz orqali tasdiqlanadi.')
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60_000 },
    )
  }

  const card = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/[0.03]'
  const strong = isLight ? 'text-slate-900' : 'text-white'
  const muted = isLight ? 'text-slate-500' : 'text-slate-400'
  const field = isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-950 border-white/10 text-white'
  const label = `mb-1.5 block text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`

  const open = (items ?? []).filter((l) => (l.status === 'active' || l.status === 'pending') && l.endsOn >= today)
  const past = (items ?? []).filter((l) => !open.includes(l))

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/talaba/dashboard" data-student-button="plain" className={`inline-flex items-center gap-1.5 text-xs font-bold ${muted}`}>
        <ArrowLeft size={14} /> Asosiy sahifa
      </Link>

      <div>
        <h1 className={`text-xl font-extrabold tracking-tight ${strong}`}>Uyga ketish arizasi</h1>
        <p className={`mt-1 text-xs ${muted}`}>
          Yotoqxonadan ketayotgan bo‘lsangiz, ariza yozing: shu kunlarda yo‘qlamada “Uyda” deb ko‘rinasiz va “kelmadi” hisoblanmaysiz.
        </p>
      </div>

      {open.map((leave) => (
        <div key={leave.id} className={`space-y-3 rounded-2xl border p-4 ${isLight ? 'border-sky-200 bg-sky-50' : 'border-sky-500/25 bg-sky-500/[0.06]'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`flex items-center gap-1.5 text-sm font-bold ${strong}`}>
                <Home size={15} className="text-sky-500" /> {LEAVE_KIND_LABELS[leave.destinationKind]}
              </p>
              <p className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${muted}`}>
                <CalendarDays size={12} /> {formatRange(leave)}
              </p>
            </div>
            <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[leave.status]}`}>
              {LEAVE_STATUS_LABELS[leave.status]}
            </span>
          </div>
          <p className={`flex items-start gap-1.5 text-xs ${muted}`}>
            <MapPin size={13} className="mt-0.5 shrink-0" /> {leave.destinationAddress}
          </p>
          <p className={`flex items-center gap-1.5 text-xs ${muted}`}>
            <Phone size={13} /> {leave.contactName} · {leave.contactPhone}
          </p>
          {leave.callResult !== 'none' && (
            <p className={`text-[11px] ${leave.callResult === 'ok' ? 'text-emerald-500' : 'text-amber-500'}`}>
              {LEAVE_CALL_LABELS[leave.callResult]}
            </p>
          )}
          {leave.locStatus !== 'none' && (
            <p className="flex items-center gap-1 text-[11px] text-emerald-500">
              <ShieldCheck size={13} />
              {leave.locStatus === 'far' ? 'Joylashuv yuborildi (manzildan uzoqda)' : 'Joylashuv tasdiqlangan'}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {leave.status === 'active' && leave.locStatus === 'none' && (
              <button
                type="button"
                disabled={busyId === leave.id}
                onClick={() => shareLocation(leave.id)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-sky-500/40 px-3.5 text-xs font-bold text-sky-500 disabled:opacity-50"
              >
                <MapPin size={14} /> Joylashuvni tasdiqlash (ixtiyoriy)
              </button>
            )}
            {leave.status === 'active' && (
              <button
                type="button"
                disabled={busyId === leave.id}
                onClick={() => act(leave.id, 'return')}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {busyId === leave.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Qaytdim
              </button>
            )}
            <button
              type="button"
              disabled={busyId === leave.id}
              onClick={() => act(leave.id, 'cancel')}
              data-btn="ghost"
              className={`inline-flex h-10 items-center rounded-xl border px-3.5 text-xs font-bold disabled:opacity-50 ${isLight ? 'border-slate-300 text-slate-600' : 'border-white/10 text-slate-300'}`}
            >
              Bekor qilish
            </button>
          </div>
        </div>
      ))}

      <div className={`space-y-3.5 rounded-2xl border p-4 ${card}`}>
        <h2 className={`text-sm font-bold ${strong}`}>Yangi ariza</h2>

        <div>
          <label className={label}>Qayerga ketasiz?</label>
          <CustomSelect
            value={kind}
            onChange={(v) => setKind(v as LeaveDestinationKind)}
            placeholder="Tanlang"
            options={KIND_OPTIONS}
            className={`w-full rounded-xl border px-4 py-2.5 text-sm ${field}`}
          />
          <p className={`mt-1 text-[11px] ${muted}`}>Uyingiz bo‘lishi shart emas — qarindosh yoki boshqa joy ham mumkin.</p>
        </div>

        <div>
          <label className={label}>Borish manzili</label>
          <AddressMapPicker
            isLight={isLight}
            onResolved={(name) => setAddress(name)}
            onCoords={(lat, lng) => setCoords({ lat, lng })}
          />
          <textarea
            rows={2}
            value={address}
            maxLength={300}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Viloyat, tuman, ko‘cha / mahalla"
            className={`mt-3 w-full rounded-xl border px-4 py-2.5 text-sm outline-none ${field}`}
          />
          <p className={`mt-1 text-[11px] ${muted}`}>Xaritadan tanlash ixtiyoriy, lekin manzilni aniq yozing.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>U yerdagi aloqa shaxsi</label>
            <input
              type="text"
              value={contactName}
              maxLength={120}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Ism (ota, amaki, tog‘a…)"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none ${field}`}
            />
          </div>
          <div>
            <label className={label}>Uning telefon raqami</label>
            <input
              type="tel"
              inputMode="tel"
              value={contactPhone}
              maxLength={20}
              onChange={(e) => setContactPhone(e.target.value)}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none ${field}`}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Ketish sanasi</label>
            <input
              type="date"
              value={startsOn}
              min={today}
              onChange={(e) => {
                setStartsOn(e.target.value)
                if (endsOn < e.target.value) setEndsOn(e.target.value)
              }}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none ${field}`}
            />
          </div>
          <div>
            <label className={label}>Qaytish sanasi</label>
            <input
              type="date"
              value={endsOn}
              min={startsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none ${field}`}
            />
          </div>
        </div>
        {days > 0 && (
          <p className={`text-[11px] ${days > LEAVE_MAX_DAYS ? 'text-rose-500' : needsReview ? 'text-amber-500' : muted}`}>
            {days} kun
            {days > LEAVE_MAX_DAYS
              ? ` — ${LEAVE_MAX_DAYS} kundan uzoq muddatga ariza berilmaydi, dekanatga murojaat qiling.`
              : needsReview
                ? ` — ${LEAVE_AUTO_MAX_DAYS} kundan uzoq bo‘lgani uchun dekan tasdiqlaydi.`
                : ' — ariza darrov kuchga kiradi.'}
          </p>
        )}

        <div>
          <label className={label}>Sabab (ixtiyoriy)</label>
          <input
            type="text"
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Masalan: oilaviy sabab, bayram"
            className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none ${field}`}
          />
        </div>

        <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs ${isLight ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-white/10 bg-white/[0.02] text-slate-300'}`}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 size-4 shrink-0"
          />
          <span>
            Ko‘rsatilgan ma‘lumotlar to‘g‘ri ekanini tasdiqlayman. Ushbu muddat davomida shu manzilda bo‘lishimga, belgilangan
            kuni yotoqxonaga qaytishimga va aloqa shaxsimga qo‘ng‘iroq qilinishi mumkinligiga roziman. Mas‘uliyat o‘zimda.
          </span>
        </label>

        <button
          type="button"
          onClick={submit}
          disabled={!ready || days > LEAVE_MAX_DAYS || sending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-bold text-white disabled:opacity-40"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Ariza yuborish
        </button>
      </div>

      <div className="space-y-3">
        <h2 className={`text-sm font-bold ${strong}`}>Oldingi arizalar</h2>
        {items === null ? (
          <div className={`flex items-center justify-center gap-2 py-8 text-sm ${muted}`}>
            <Loader2 size={16} className="animate-spin" /> Yuklanmoqda…
          </div>
        ) : past.length === 0 ? (
          <p className={`rounded-2xl border border-dashed p-5 text-center text-xs ${isLight ? 'border-slate-300' : 'border-white/15'} ${muted}`}>
            Hali ariza yo‘q
          </p>
        ) : (
          past.map((leave) => (
            <div key={leave.id} className={`rounded-2xl border p-4 ${card}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`truncate text-sm font-bold ${strong}`}>{leave.destinationAddress}</p>
                  <p className={`mt-0.5 text-[11px] ${muted}`}>{formatRange(leave)}</p>
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[leave.status]}`}>
                  {leave.status === 'active' ? 'Muddati tugagan' : LEAVE_STATUS_LABELS[leave.status]}
                </span>
              </div>
              {leave.status === 'rejected' && leave.decisionNote && (
                <p className="mt-2 text-xs text-rose-500">Sabab: {leave.decisionNote}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
