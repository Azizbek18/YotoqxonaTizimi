'use client'

import { useMemo, useState } from 'react'
import { MapPin, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { dekanUI } from '@/lib/dekan-ui'
import { useThemeStore } from '@/lib/stores/theme-store'
import { saveDormAttendanceSettings } from '@/features/dorms/client/api'
import type { DekanDorm } from '@/features/dorms/types'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

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

  const latNum = lat.trim() === '' ? null : Number(lat)
  const lngNum = lng.trim() === '' ? null : Number(lng)
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
          Talaba &laquo;Yotoqxonadaman&raquo; tugmasini bosganda tizim uning joylashuvini shu koordinata bilan
          solishtiradi. Belgilangan radius ichida bo&apos;lsa — <span className={ui.strong}>hozir</span>, bo&apos;lmasa —
          <span className={ui.strong}> yo&apos;q</span> deb belgilanadi. Koordinatani Google Maps&apos;dan oling:
          kerakli nuqtani bosib turing → pastda chiqqan ikkita raqamni ko&apos;chiring.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
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
          <div className="mt-3 flex items-center gap-3">
            <input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} className={`${inputCls}`} />
            <span className={ui.muted}>—</span>
            <input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className={`${inputCls}`} />
          </div>
        </div>

        <label className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer ${ui.inset}`}>
          <input
            type="checkbox" checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-indigo-600"
          />
          <span>
            <span className={`block text-sm font-semibold ${ui.strong}`}>Kechki yo&apos;qlamani yoqish</span>
            <span className={`block text-xs mt-0.5 ${ui.muted}`}>
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
            className={`rounded-lg px-6 py-2.5 text-xs font-bold uppercase tracking-wider ${ui.accentSolid}`}
          >
            {saving ? 'Saqlanmoqda…' : 'Yo‘qlama sozlamalarini saqlash'}
          </button>
        </div>
      </div>
    </section>
  )
}
