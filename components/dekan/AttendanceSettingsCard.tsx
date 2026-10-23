'use client'

import { useMemo, useState } from 'react'
import { MapPin, Clock, Check, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { dekanUI } from '@/lib/dekan-ui'
import { useThemeStore } from '@/lib/stores/theme-store'
import { saveDormAttendanceSettings } from '@/features/dorms/client/api'
import type { DekanDorm } from '@/features/dorms/types'
import DormLocationPicker from './DormLocationPicker'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const toMinutes = (value: string) => {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

/** "22:00 → 01:00" as a human length, wrapping past midnight. */
function describeWindow(open: string, close: string) {
  if (!TIME_RE.test(open) || !TIME_RE.test(close)) return null
  const wraps = toMinutes(close) <= toMinutes(open)
  const total = toMinutes(close) - toMinutes(open) + (wraps ? 24 * 60 : 0)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  const length = [hours ? `${hours} soat` : '', minutes ? `${minutes} daq` : ''].filter(Boolean).join(' ')
  return `${length}${wraps ? ' · yarim tundan o‘tadi' : ''}`
}

function TimeField({
  label,
  value,
  onChange,
  presets,
  isLight,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  presets: string[]
  isLight: boolean
}) {
  return (
    <div className="min-w-0 sm:w-44">
      <span className={`mb-1.5 block text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
        {label}
      </span>
      <div className="relative">
        <Clock
          size={16}
          className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${isLight ? 'text-indigo-500' : 'text-indigo-400'}`}
        />
        <input
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className={`no-shelf w-full cursor-pointer rounded-xl border-2 py-2.5 pl-10 pr-3 font-mono text-lg font-extrabold tabular-nums tracking-wider outline-none transition-all [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 focus:ring-4 focus:ring-indigo-500/15 ${
            isLight
              ? 'border-slate-200 bg-white text-slate-900 hover:border-indigo-300 focus:border-indigo-500'
              : 'border-slate-700 bg-slate-800/80 text-white hover:border-indigo-500/60 focus:border-indigo-400'
          }`}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const active = value === preset
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className={`no-shelf cursor-pointer rounded-lg border px-2 py-1 font-mono text-[11px] font-bold tabular-nums transition-all active:scale-95 ${
                active
                  ? isLight
                    ? 'border-indigo-300 bg-indigo-100 text-indigo-700'
                    : 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200'
                  : isLight
                    ? 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-600'
                    : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:border-indigo-500/40 hover:text-indigo-300'
              }`}
            >
              {preset}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * "Yo'qlama" (roll-call) configuration for the whole building — shared by
 * every faculty in the dorm. The dekan pastes the dorm's coordinates from
 * Google Maps, sets the nightly window, and flips the feature on. Saved on
 * its own button (not batched with the page's Save) since it writes to the
 * shared `dorms` row, not this faculty's app_settings.
 */
export default function AttendanceSettingsCard({
  dorm,
  onChange,
}: {
  dorm: DekanDorm
  onChange: (dorm: DekanDorm) => void
}) {
  const isLight = useThemeStore((state) => state.theme === 'light')
  const ui = dekanUI(isLight)

  const a = dorm.attendance
  const [lat, setLat] = useState(a.latitude != null ? String(a.latitude) : '')
  const [lng, setLng] = useState(a.longitude != null ? String(a.longitude) : '')
  const [radius, setRadius] = useState(String(a.radiusM))
  const [openTime, setOpenTime] = useState(a.openTime)
  const [closeTime, setCloseTime] = useState(a.closeTime)
  const [enabled, setEnabled] = useState(a.enabled)
  const [saving, setSaving] = useState(false)

  const inputCls = `rounded-lg border text-sm px-3 py-2 transition-colors ${ui.input} ${ui.ring}`
  const windowLabel = describeWindow(openTime, closeTime)

  // A half-typed value ("41.", "abc") is not a coordinate yet — pass null, not NaN.
  const toCoord = (value: string) => {
    if (value.trim() === '') return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  const latNum = toCoord(lat)
  const lngNum = toCoord(lng)
  const radiusNum = Number(radius)

  const error = useMemo(() => {
    if (lat.trim() !== '' && (!Number.isFinite(latNum!) || latNum! < -90 || latNum! > 90)) return 'Kenglik (latitude) −90…90 orasida bo‘lishi kerak'
    if (lng.trim() !== '' && (!Number.isFinite(lngNum!) || lngNum! < -180 || lngNum! > 180)) return 'Uzunlik (longitude) −180…180 orasida bo‘lishi kerak'
    if ((latNum == null) !== (lngNum == null)) return 'Kenglik va uzunlikni birga kiriting'
    if (!Number.isInteger(radiusNum) || radiusNum < 50 || radiusNum > 20000) return 'Radius 50–20000 metr orasida'
    if (!TIME_RE.test(openTime) || !TIME_RE.test(closeTime)) return 'Vaqt formati SS:DD bo‘lishi kerak'
    if (enabled && latNum == null) return 'Yo‘qlamani yoqishdan oldin koordinatani kiriting'
    return null
  }, [lat, lng, latNum, lngNum, radiusNum, openTime, closeTime, enabled])

  const dirty =
    (latNum ?? null) !== (a.latitude ?? null) ||
    (lngNum ?? null) !== (a.longitude ?? null) ||
    radiusNum !== a.radiusM ||
    openTime !== a.openTime ||
    closeTime !== a.closeTime ||
    enabled !== a.enabled

  const save = async () => {
    if (error) { toast.error(error); return }
    setSaving(true)
    try {
      const { dorm: updated } = await saveDormAttendanceSettings(
        {
          latitude: latNum,
          longitude: lngNum,
          checkinRadiusM: radiusNum,
          attendanceEnabled: enabled,
          attendanceOpenTime: openTime,
          attendanceCloseTime: closeTime,
        },
        dorm.dormId,
      )
      if (updated) onChange(updated)
      toast.success('Yo‘qlama sozlamalari saqlandi')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Saqlanmadi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={`rounded-2xl border overflow-hidden ${ui.card}`}>
      <div className={`flex items-center gap-3 border-b p-4 sm:px-6 ${ui.border}`}>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${ui.accentTile}`}>
          <MapPin size={18} strokeWidth={2.2} />
        </div>
        <div>
          <h2 className={`text-sm font-bold ${ui.strong}`}>Yo&apos;qlama (joylashuv bilan)</h2>
          <p className={`text-[11px] ${ui.muted}`}>Butun bino uchun umumiy — barcha fakultetlarga tegishli</p>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        <p className={`text-xs leading-relaxed ${ui.muted}`}>
          Talaba &laquo;Yotoqxonadaman&raquo; tugmasini bosganda tizim uning joylashuvini shu nuqta bilan
          solishtiradi. Belgilangan radius (ko&apos;k doira) ichida bo&apos;lsa — <span className={ui.strong}>hozir</span>,
          bo&apos;lmasa — <span className={ui.strong}>yo&apos;q</span>. Xaritadan yotoqxona binosini qidiring yoki
          ustiga bosib nuqtani qo&apos;ying — pin&apos;ni sudrab ham aniqlashtirsa bo&apos;ladi.
        </p>

        <DormLocationPicker
          isLight={isLight}
          lat={latNum}
          lng={lngNum}
          radiusM={Number.isFinite(radiusNum) ? radiusNum : 1000}
          onChange={(la, ln) => { setLat(String(la)); setLng(String(ln)) }}
        />

        <details className="group">
          <summary className={`cursor-pointer text-[11px] font-semibold ${ui.muted} hover:${ui.strong}`}>
            Koordinatani qo&apos;lda kiritish
          </summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${ui.muted}`}>Kenglik (latitude)</label>
              <input
                type="text" inputMode="decimal" value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="41.311081"
                className={`${inputCls} w-full`}
              />
            </div>
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${ui.muted}`}>Uzunlik (longitude)</label>
              <input
                type="text" inputMode="decimal" value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="69.240562"
                className={`${inputCls} w-full`}
              />
            </div>
          </div>
        </details>

        <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-5 border-b ${ui.border}`}>
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-semibold ${ui.strong}`}>Ruxsat etilgan masofa</h3>
            <p className={`text-xs mt-1 ${ui.muted}`}>Talaba shu masofadan yaqin bo&apos;lsa &laquo;hozir&raquo; hisoblanadi. GPS xatoligi uchun 1000 m tavsiya etiladi.</p>
          </div>
          <div className="sm:ml-4 shrink-0 flex items-center gap-2 w-full sm:w-auto">
            <input
              type="number" min={50} max={20000} step={50} value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className={`${inputCls} w-full sm:w-28`}
            />
            <span className={`text-xs font-semibold shrink-0 ${ui.muted}`}>metr</span>
          </div>
        </div>

        <div>
          <div className={`flex items-center gap-2 text-sm font-semibold ${ui.strong}`}>
            <Clock size={14} className={ui.accentText} /> Kechki yo&apos;qlama oynasi
          </div>
          <p className={`text-xs mt-1 ${ui.muted}`}>
            Har kecha shu vaqtda yo&apos;qlama avtomatik ochiladi va talabalarga bildirishnoma yuboriladi;
            yopilish vaqtidan keyin tasdiqlab bo&apos;lmaydi. Yarim tundan o&apos;tsa ham bo&apos;ladi (masalan 22:00–01:00).
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <TimeField label="Ochilish vaqti" value={openTime} onChange={setOpenTime} presets={['21:00', '22:00', '23:00']} isLight={isLight} />
            <ArrowRight size={18} className={`hidden shrink-0 sm:mb-3.5 sm:block ${ui.faint}`} aria-hidden="true" />
            <TimeField label="Yopilish vaqti" value={closeTime} onChange={setCloseTime} presets={['23:30', '00:00', '01:00']} isLight={isLight} />
            {windowLabel && (
              <span
                className={`inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-xs font-bold sm:mb-2 sm:self-end ${
                  isLight ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
                }`}
              >
                <Clock size={12} /> {windowLabel}
              </span>
            )}
          </div>
        </div>

        <label
          className={`group relative flex items-start gap-3.5 rounded-2xl border p-4 cursor-pointer select-none transition-all duration-200 focus-within:ring-2 focus-within:ring-indigo-500/40 ${
            enabled
              ? isLight
                ? 'border-indigo-300 bg-indigo-50/70 shadow-sm shadow-indigo-900/5'
                : 'border-indigo-500/40 bg-indigo-500/10'
              : `${ui.inset} ${isLight ? 'hover:border-slate-300' : 'hover:border-slate-600'}`
          }`}
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-200 peer-active:scale-90 ${
              enabled
                ? 'border-indigo-600 bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-600/30'
                : isLight
                  ? 'border-slate-300 bg-white group-hover:border-indigo-400'
                  : 'border-slate-600 bg-slate-800 group-hover:border-indigo-400'
            }`}
          >
            <Check
              size={15}
              strokeWidth={3.5}
              color="#ffffff"
              className={`transition-all duration-200 ${enabled ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className={`text-sm font-bold ${ui.strong}`}>Kechki yo&apos;qlamani yoqish</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  enabled
                    ? isLight
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-emerald-500/15 text-emerald-300'
                    : isLight
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-slate-700/60 text-slate-400'
                }`}
              >
                {enabled ? 'Yoqilgan' : 'O‘chiq'}
              </span>
            </span>
            <span className={`mt-1 block text-xs leading-relaxed ${ui.muted}`}>
              O&apos;chirilgan bo&apos;lsa, sardor va tarbiyachi baribir qo&apos;lda yo&apos;qlama ochishi mumkin —
              faqat avtomatik kechki oyna ishlamaydi.
            </span>
          </span>
        </label>

        {error && (
          <p className={`text-xs ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>{error}</p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty || !!error}
            className={`no-shelf rounded-lg px-6 py-2.5 text-xs font-bold uppercase tracking-wider ${ui.accentSolid}`}
            style={{ boxShadow: '0 2px 8px rgba(79, 70, 229, 0.35)' }}
          >
            {saving ? 'Saqlanmoqda…' : 'Yo‘qlama sozlamalarini saqlash'}
          </button>
        </div>
      </div>
    </section>
  )
}
