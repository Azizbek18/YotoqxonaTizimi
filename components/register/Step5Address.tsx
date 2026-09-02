'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { RegisterData } from './types'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Navigation, Home, Hash, ChevronDown, Check, Globe, ArrowRight, Sparkles, ShieldAlert, Search, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import {
  loadUzAddress,
  districtsOfRegion,
  mahallasOfDistrict,
  normalizeName,
  type UzAddressData,
} from '@/lib/uz-address'

interface Props {
  data: RegisterData
  onChange: (d: Partial<RegisterData>) => void
  onNext: () => void
  onBack: () => void
}

interface SelectOption {
  value: string
  label: string
}

const toOption = (value: string): SelectOption => ({
  value: normalizeName(value),
  label: normalizeName(value),
})

const uniqueOptions = (values: string[]) => {
  const seen = new Set<string>()

  return values
    .map(normalizeName)
    .filter((value) => {
      if (!value || seen.has(value)) return false
      seen.add(value)
      return true
    })
    .map(toOption)
}

interface Custom3DSelectProps {
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  icon: React.ComponentType<{ size: number; className?: string }>
  placeholder?: string
  isLight: boolean
  disabled?: boolean
  /** Show a filter box inside the dropdown (helpful for long lists). */
  searchable?: boolean
  /** Let the user type a value that isn't in the list (MFY / qishloq — the
   *  reference data can never be exhaustive). */
  allowCustom?: boolean
}

const Custom3DSelect = ({ label, value, options, onChange, icon: Icon, placeholder, isLight, disabled, searchable, allowCustom }: Custom3DSelectProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement | null>(null)
  const displayValue = value || placeholder || 'Tanlang'

  const showSearch = searchable || allowCustom
  const q = normalizeName(query).toLowerCase()
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options
  const exact = options.some((o) => o.label.toLowerCase() === q)

  useEffect(() => {
    if (isOpen && showSearch) {
      setQuery('')
      const id = window.setTimeout(() => searchRef.current?.focus(), 30)
      return () => window.clearTimeout(id)
    }
  }, [isOpen, showSearch])

  const pick = (v: string) => { onChange(v); setIsOpen(false) }

  return (
    <div className="relative space-y-1.5 flex-1 font-sans">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">{label}</label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`
            w-full backdrop-blur-xl p-3 rounded-xl flex items-center justify-between text-[13px]
            transition-all duration-500 hover:bg-white/4
            ${isLight
              ? 'bg-white border border-slate-200 text-slate-900 shadow-sm hover:border-sky-300'
              : 'bg-white/2 border border-white/8 text-white'
            }
            ${isOpen ? (isLight ? 'border-sky-400 ring-4 ring-sky-500/10' : 'border-sky-500/40 bg-white/4 ring-4 ring-sky-500/5') : ''}
            ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
          `}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`shrink-0 p-1.5 rounded-lg ${value ? (isLight ? 'bg-sky-100 text-sky-600' : 'bg-sky-500/20 text-sky-400') : (isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-600')}`}>
              <Icon size={14} />
            </div>
            <span className={`truncate font-semibold tracking-wide ${!value ? (isLight ? 'text-slate-400' : 'text-slate-600') : (isLight ? 'text-slate-900' : 'text-white')}`}>
              {displayValue}
            </span>
          </div>
          <ChevronDown size={14} className={`shrink-0 transition-transform duration-500 ${isOpen ? 'rotate-180 text-sky-400' : (isLight ? 'text-slate-400' : 'text-slate-700')}`} />
        </button>

        <AnimatePresence>
          {isOpen && !disabled && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-60" onClick={() => setIsOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 4 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className={`absolute z-70 w-full rounded-xl shadow-2xl overflow-hidden ${isLight ? 'bg-white border border-slate-200' : 'bg-[#0f172a] border border-white/10'}`}
              >
                {showSearch && (
                  <div className={`flex items-center gap-2 border-b px-3 py-2 ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
                    {allowCustom ? <Pencil size={13} className="shrink-0 text-slate-400" /> : <Search size={13} className="shrink-0 text-slate-400" />}
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && allowCustom && q && !exact) { e.preventDefault(); pick(normalizeName(query)) }
                      }}
                      placeholder={allowCustom ? 'Yozing yoki ro‘yxatdan tanlang…' : 'Qidirish…'}
                      className={`w-full bg-transparent text-[12px] font-semibold outline-none ${isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-600'}`}
                    />
                  </div>
                )}
                <div className="max-h-45 overflow-y-auto p-1.5 custom-scrollbar">
                  {allowCustom && q && !exact && (
                    <button
                      type="button"
                      onClick={() => pick(normalizeName(query))}
                      className={`no-shelf mb-0.5 flex w-full items-center gap-2 rounded-lg p-2.5 text-left text-[12px] font-bold ${isLight ? 'bg-sky-50 text-sky-700 hover:bg-sky-100' : 'bg-sky-600/20 text-sky-300 hover:bg-sky-600/30'}`}
                    >
                      <Pencil size={12} /> «{normalizeName(query)}» ni ishlatish
                    </button>
                  )}
                  {filtered.map((opt) => {
                    const isActive = opt.value === value
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => pick(opt.value)}
                        className={`
                          no-shelf w-full flex items-center justify-between p-2.5 rounded-lg text-left text-[12px] transition-all duration-300 mb-0.5 last:mb-0
                          ${isActive
                            ? (isLight ? 'bg-sky-50 text-sky-700' : 'bg-sky-600 text-white')
                            : (isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/5')
                          }
                        `}
                      >
                        <span className={isActive ? 'font-bold' : ''}>{opt.label}</span>
                        {isActive && <Check size={14} />}
                      </button>
                    )
                  })}
                  {filtered.length === 0 && !(allowCustom && q) && (
                    <p className="px-2.5 py-3 text-center text-[11px] text-slate-400">Topilmadi</p>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function Step5Address({ data, onChange, onNext, onBack }: Props) {

  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const [focusedField, setFocusedField] = useState<'qishloq' | 'street' | 'houseNumber' | null>(null)
  const [addr, setAddr] = useState<UzAddressData | null>(null)
  const isLoadingData = addr === null

  useEffect(() => {
    let alive = true
    loadUzAddress().then((d) => { if (alive) setAddr(d) })
    return () => { alive = false }
  }, [])

  const regionOptions = useMemo(
    () => uniqueOptions((addr?.regions ?? []).map((r) => r.name)),
    [addr]
  )

  const districtRecords = useMemo(
    () => (addr && data.region ? districtsOfRegion(addr, data.region) : []),
    [addr, data.region]
  )
  const districtOptions = useMemo(
    () => uniqueOptions(districtRecords.map((d) => d.name)),
    [districtRecords]
  )

  const mahallaOptions = useMemo(
    () => (addr && data.region && data.district
      ? uniqueOptions(mahallasOfDistrict(addr, data.region, data.district).map((m) => m.name))
      : []),
    [addr, data.region, data.district]
  )
  // MFY / mahalla stays type-able: the reference list (~9,800 MFYs) covers
  // most districts but can never be 100% (mahallas are reorganised often,
  // a handful of newly-split districts aren't in the source yet). The
  // qishloq / shaharcha field is always free text — there is no source list
  // for it.

  // 3D Toast funksiyasi
  const show3DToast = (message: string, type: 'success' | 'error' = 'error') => {
    toast.custom((t) => (
      <AnimatePresence>
        {t.visible && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, rotateX: -15 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
            className="relative group cursor-pointer z-9999 w-[92vw] max-w-100 mx-auto"
          >
            <div className={`absolute -inset-1 rounded-2xl blur-md opacity-30 transition duration-1000 ${type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
              }`} />

            <div className={`relative backdrop-blur-2xl border p-4 rounded-2xl shadow-2xl flex items-center gap-3 ${isLight ? 'bg-white/95 border-slate-200' : 'bg-[#1e293b]/95 border-white/10'}`}>
              <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${type === 'success'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                }`}>
                {type === 'success' ? <Sparkles size={20} /> : <ShieldAlert size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[9px] font-black uppercase tracking-[0.15em] mb-0.5 ${type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                  {type === 'success' ? 'Tayyor' : 'Manzil chala'}
                </p>
                <p className={`text-[12px] font-medium leading-tight ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                  {message}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    ), { duration: 3000, position: 'top-center' });
  }

  const handleRegionChange = (region: string) => {
    onChange({ region, district: '', mahalla: '', qishloq: '', street: '', houseNumber: '' })
  }

  const handleDistrictChange = (district: string) => {
    onChange({ district, mahalla: '', qishloq: '', street: '', houseNumber: '' })
  }

  const handleValidate = () => {
    if (!data.region) return show3DToast("Viloyatni tanlang", 'error')
    if (!data.district) return show3DToast("Tuman yoki shaharni tanlang", 'error')
    if (!data.mahalla) return show3DToast("Mahallani kiriting", 'error')
    if (!data.qishloq) return show3DToast("Qishloqni kiriting", 'error')
    if (!data.street) return show3DToast("Ko'cha nomini kiriting", 'error')
    if (!data.houseNumber) return show3DToast("Uy raqamini kiriting", 'error')

    onNext()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 font-sans"
    >
      {/* Header */}
      <div className="relative">
        <div className={`flex items-center gap-3 p-2 rounded-2xl border ${isLight ? 'bg-white border-slate-200' : 'bg-white/3 border-white/5'}`}>
          <div className={`p-2 bg-linear-to-br rounded-xl border ${isLight ? 'from-sky-100 to-indigo-100 border-sky-200 text-sky-600' : 'from-sky-500/20 to-indigo-500/20 border-sky-500/20 text-sky-400'}`}>
            <Globe size={18} />
          </div>
          <div className="min-w-0">
            <h2 className={`text-[14px] font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>Yashash manzili</h2>
            <p className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-sky-600/80' : 'text-sky-400/80'}`}>Qadam 05 / 07</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Custom3DSelect
          label="Viloyat"
          value={data.region}
          options={regionOptions}
          icon={MapPin}
          placeholder={isLoadingData ? 'Yuklanmoqda…' : 'Viloyat'}
          onChange={handleRegionChange}
          isLight={isLight}
          disabled={isLoadingData}
        />

        <AnimatePresence mode="wait">
          {data.region && (
            <motion.div
              key={data.region}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <Custom3DSelect
                label="Tuman / Shahar"
                value={data.district}
                options={districtOptions}
                icon={Navigation}
                placeholder={isLoadingData ? 'Yuklanmoqda…' : 'Tuman'}
                onChange={handleDistrictChange}
                isLight={isLight}
                disabled={isLoadingData}
                searchable
              />

              {data.district && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <Custom3DSelect
                    label="MFY / Mahalla"
                    value={data.mahalla}
                    options={mahallaOptions}
                    icon={Home}
                    placeholder="Mahallangiz nomini yozing"
                    onChange={(v: string) => onChange({ mahalla: v })}
                    isLight={isLight}
                    allowCustom
                  />

                  <Custom3DSelect
                    label="Qishloq / shaharcha"
                    value={data.qishloq}
                    options={[]}
                    icon={MapPin}
                    placeholder="Qishloq / shaharcha nomini yozing"
                    onChange={(v: string) => onChange({ qishloq: v })}
                    isLight={isLight}
                    allowCustom
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">Ko&apos;cha</label>
                      <div className={`cyber-border ${focusedField === 'street' ? 'focused' : ''}`}>
                        <div className="cyber-input-inner relative flex items-center">
                          <Navigation className={`absolute left-4 z-10 transition-colors ${focusedField === 'street' ? 'text-sky-400' : isLight ? 'text-slate-400' : 'text-slate-600'}`} size={14} />
                          <input
                            className={`w-full bg-transparent p-3 pl-11 rounded-xl text-[13px] font-semibold outline-none transition-colors ${isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-600'}`}
                            placeholder="Ko'cha nomi"
                            value={data.street}
                            onFocus={() => setFocusedField('street')}
                            onBlur={() => setFocusedField(null)}
                            onChange={e => onChange({ street: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">Uy</label>
                      <div className={`cyber-border ${focusedField === 'houseNumber' ? 'focused' : ''}`}>
                        <div className="cyber-input-inner relative flex items-center">
                          <Hash className={`absolute left-4 z-10 transition-colors ${focusedField === 'houseNumber' ? 'text-sky-400' : isLight ? 'text-slate-400' : 'text-slate-600'}`} size={14} />
                          <input
                            className={`w-full bg-transparent p-3 pl-11 rounded-xl text-[13px] font-semibold outline-none transition-colors ${isLight ? 'text-slate-900 placeholder:text-slate-400' : 'text-white placeholder:text-slate-600'}`}
                            placeholder="14A"
                            value={data.houseNumber}
                            onFocus={() => setFocusedField('houseNumber')}
                            onBlur={() => setFocusedField(null)}
                            onChange={e => onChange({ houseNumber: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className={`h-12 w-12 shrink-0 flex items-center justify-center rounded-xl border transition-all ${isLight ? 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
        >
          ←
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleValidate}
          className={`
            flex-1 relative overflow-hidden h-12 rounded-xl transition-all duration-500 group
            ${isLight ? 'bg-linear-to-r from-sky-500 to-indigo-500' : 'bg-linear-to-r from-sky-600 to-indigo-600'}
          `}
        >
          <div className={`relative flex items-center justify-center gap-2 rounded-xl h-full ${isLight ? 'bg-white/90' : ''}`}>
            <span className={`font-bold text-[11px] tracking-widest uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Davom Etish
            </span>
            <ArrowRight size={16} className={`${isLight ? 'text-blue-600' : 'text-white'} group-hover:translate-x-1 transition-transform`} />
          </div>
        </motion.button>
      </div>
    </motion.div>
  )
}
