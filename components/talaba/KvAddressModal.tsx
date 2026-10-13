'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Home, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import AddressMapPicker from '@/components/talaba/foreign-docs/AddressMapPicker'
import { updateStudentProfile } from '@/features/profile/client/api'

type Props = {
  isLight: boolean
  initialAddress?: string | null
  initialCountry?: string | null
  /** Without `onClose` the dialog is mandatory (first sign-in). */
  onClose?: () => void
  onSaved: () => void
}

// KV-talaba (kvartirada turuvchi) birinchi kirishda turgan manzilini kiritadi:
// qo'lda yozadi YOKI xaritadan belgilaydi (manzil matnga avtomatik tushadi).
export default function KvAddressModal({ isLight, initialAddress, initialCountry, onClose, onSaved }: Props) {
  const [address, setAddress] = useState(initialAddress ?? '')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [foreign, setForeign] = useState(Boolean(initialCountry))
  const [country, setCountry] = useState(initialCountry ?? '')
  const [saving, setSaving] = useState(false)

  const valid = address.trim().length >= 5 && (!foreign || country.trim().length >= 3)

  const save = async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      await updateStudentProfile({
        residenceAddress: address.trim(),
        residenceLat: coords?.lat ?? null,
        residenceLng: coords?.lng ?? null,
        country: foreign ? country.trim() : null,
      })
      toast.success('Manzil saqlandi')
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Manzilni saqlab bo'lmadi")
    } finally {
      setSaving(false)
    }
  }

  const muted = isLight ? 'text-slate-500' : 'text-slate-400'

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Turgan manzil"
        className={`relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border p-4 shadow-2xl sm:rounded-3xl sm:p-5 ${
          isLight ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-[#0b1120] text-white'
        }`}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/15 text-emerald-300'}`}>
            <Home size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold leading-tight">Turgan manzilingiz</h2>
            <p className={`mt-0.5 text-xs leading-snug ${muted}`}>
              Hozir qayerda yashayotganingizni yozing yoki xaritadan belgilang.
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Yopish"
              data-student-button="plain"
              className={`rounded-lg p-1.5 ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/10'}`}
            >
              <X size={18} />
            </button>
          )}
        </div>

        <AddressMapPicker
          isLight={isLight}
          onResolved={(name) => setAddress(name)}
          onCoords={(lat, lng) => setCoords({ lat, lng })}
        />

        <label className={`mb-1.5 mt-4 block text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
          Manzil
        </label>
        <textarea
          rows={3}
          value={address}
          maxLength={300}
          onChange={(e) => {
            setAddress(e.target.value)
            // Qo'lda o'zgartirilgan matn xaritadagi nuqtaga endi mos kelmasligi mumkin.
            setCoords(null)
          }}
          placeholder="Masalan: Toshkent sh., Chilonzor t., 7-kvartal, 12-uy, 34-xonadon"
          className={`w-full resize-none rounded-xl border px-3.5 py-3 text-base outline-none transition-all ${
            isLight
              ? 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100'
              : 'border-white/12 bg-white/[0.04] text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20'
          }`}
        />
        <p className={`mt-1 text-[11px] ${muted}`}>
          Xaritadan tanlasangiz, manzil shu yerga avtomatik tushadi — keyin o&apos;zingiz tuzatishingiz mumkin.
        </p>

        <label className={`mb-1.5 mt-4 block text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
          Fuqaroligi
        </label>
        <div className="grid grid-cols-2 gap-2">
          {([[false, "O'zbekiston"], [true, 'Boshqa davlat']] as const).map(([value, label]) => {
            const active = foreign === value
            return (
              <button
                key={label}
                type="button"
                onClick={() => setForeign(value)}
                aria-pressed={active}
                data-student-button="plain"
                className={`no-shelf h-11 rounded-xl border text-sm font-bold transition-all ${
                  active
                    ? (isLight ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-blue-500 bg-blue-500/15 text-blue-200')
                    : (isLight ? 'border-slate-300 bg-white text-slate-600' : 'border-white/12 bg-white/[0.04] text-slate-300')
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        {foreign && (
          <input
            type="text"
            value={country}
            maxLength={60}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Davlat nomi (masalan, Turkmaniston)"
            className={`mt-2 h-12 w-full rounded-xl border px-3.5 text-base outline-none ${
              isLight ? 'border-slate-300 bg-white text-slate-900 focus:border-blue-600' : 'border-white/12 bg-white/[0.04] text-white focus:border-blue-500'
            }`}
          />
        )}

        <button
          type="button"
          onClick={save}
          disabled={!valid || saving}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : 'Saqlash'}
        </button>
      </div>
    </div>,
    document.body,
  )
}
