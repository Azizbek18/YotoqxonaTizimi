'use client'

import { useEffect, useMemo, useState } from 'react'
import { Phone } from 'lucide-react'
import CustomSelect from './CustomSelect'
import { PHONE_DIAL_CODES, DEFAULT_DIAL_CODE, splitPhone } from '@/lib/permit-validation'

const OTHER = '__other__'
const KNOWN = new Set<string>(PHONE_DIAL_CODES.map((c) => c.code))

interface Props {
  /** Stored value in E.164-ish form: "+998901234567", or "" while empty. */
  value: string
  onChange: (e164: string) => void
  isLight?: boolean
  disabled?: boolean
  /** National-number input placeholder. */
  placeholder?: string
  /** Overrides the national-number <input> classes. */
  inputClassName?: string
  /** Overrides the dial-code CustomSelect className. */
  selectClassName?: string
}

/**
 * Country dial code + national number. An O'zbek applicant leaves the default
 * (+998) and types 9 digits; a foreign applicant picks their country, or
 * "Boshqa davlat…" to type any code. Emits a spaceless E.164 string
 * ("+99365123456") so the whole app stores one shape.
 */
export default function PhoneField({
  value,
  onChange,
  isLight = false,
  disabled = false,
  placeholder = '90 123 45 67',
  inputClassName = '',
  selectClassName = '',
}: Props) {
  const parsed = splitPhone(value)
  // The dial code is held locally so it survives the national field being
  // cleared (an empty `value` would otherwise reset it to +998).
  const [dialCode, setDialCode] = useState(parsed.dialCode)
  const [otherMode, setOtherMode] = useState(Boolean(value) && !KNOWN.has(parsed.dialCode))
  const national = parsed.national

  // Adopt an externally-supplied code (e.g. a permit prefill) once.
  useEffect(() => {
    if (value && parsed.dialCode !== dialCode) {
      setDialCode(parsed.dialCode)
      setOtherMode(!KNOWN.has(parsed.dialCode))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const options = useMemo(
    () => [
      ...PHONE_DIAL_CODES.map((c) => ({ value: c.code, label: `${c.code}  ${c.label}` })),
      { value: OTHER, label: 'Boshqa davlat…' },
    ],
    [],
  )

  const emit = (code: string, nat: string) => {
    const cd = code.replace(/\D/g, '') || '998'
    const nn = nat.replace(/\D/g, '').slice(0, 12)
    onChange(nn ? `+${cd}${nn}` : '')
  }

  const codeInputCls = isLight
    ? 'bg-white border border-slate-300 text-slate-900 focus:border-indigo-500'
    : 'bg-white/[0.03] border border-white/12 text-white focus:border-indigo-500/50'

  return (
    <div className="flex items-stretch gap-2">
      {otherMode ? (
        <div className="relative w-[92px] shrink-0">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-slate-400">+</span>
          <input
            type="tel"
            inputMode="numeric"
            aria-label="Davlat kodi"
            disabled={disabled}
            value={dialCode.replace(/^\+/, '')}
            onChange={(e) => {
              const code = `+${e.target.value.replace(/\D/g, '').slice(0, 4)}`
              setDialCode(code)
              emit(code, national)
            }}
            placeholder="000"
            maxLength={4}
            className={`h-full w-full rounded-xl pl-5 pr-2 text-[13px] outline-none transition-colors ${codeInputCls}`}
          />
          <button
            type="button"
            onClick={() => { setOtherMode(false); setDialCode(DEFAULT_DIAL_CODE); emit(DEFAULT_DIAL_CODE, national) }}
            className="absolute -bottom-4 left-0 text-[8px] font-bold uppercase tracking-wide text-indigo-400 hover:underline"
          >
            ro&apos;yxatdan
          </button>
        </div>
      ) : (
        <CustomSelect
          value={KNOWN.has(dialCode) ? dialCode : DEFAULT_DIAL_CODE}
          onChange={(v) => {
            if (v === OTHER) { setOtherMode(true); return }
            setDialCode(v)
            emit(v, national)
          }}
          options={options}
          disabled={disabled}
          className={selectClassName || `w-[116px] shrink-0 rounded-xl px-3 py-3 text-[13px] ${isLight ? 'bg-white border border-slate-300 text-slate-900' : 'bg-white/[0.03] border border-white/12 text-white'}`}
        />
      )}

      <div className="relative flex-1">
        <Phone size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="tel"
          inputMode="numeric"
          aria-label="Telefon raqami"
          disabled={disabled}
          value={national}
          onChange={(e) => emit(dialCode, e.target.value)}
          placeholder={placeholder}
          className={inputClassName || `w-full rounded-xl border py-3 pl-9 pr-3 text-[13px] outline-none transition-colors ${isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500' : 'bg-white/[0.03] border-white/12 text-white focus:border-indigo-500/50'}`}
        />
      </div>
    </div>
  )
}
