'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { RegisterData } from './types'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Navigation, Home, Hash, ChevronDown, Check, Globe, ArrowRight, Sparkles, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'

interface Props {
  data: RegisterData
  onChange: (d: Partial<RegisterData>) => void
  onNext: () => void
  onBack: () => void
}

const FALLBACK_DISTRICTS: Record<string, string[]> = {
  'Toshkent shahri': ["Chilonzor", "Yunusobod", "Mirobod", "Yakkasaroy", "Shayxontohur", "Olmazor", "Uchtepa", "Sergeli", "Bektemir", "Mirzo Ulug'bek", "Yashnobod"],
  'Toshkent viloyati': ["Angren", "Bekobod", "Bo'ka", "Bo'stonliq", "Chinoz", "Ohangaron", "Oqqo'rg'on", "Parkent", "Piskent", "Quyichirchiq", "Toshkent tumani", "Yuqorichirchiq", "Zangiota"],
  'Samarqand viloyati': ["Samarqand", "Urgut", "Kattaqo'rg'on", "Bulung'ur", "Ishtixon", "Narpay", "Oqdaryo", "Pastdarg'om", "Payariq", "Qo'shrabot"],
}

const FALLBACK_SETTLEMENTS = ['1-mahalla', '2-mahalla', 'Bog\'iston mahallasi', 'Markaziy mahalla']
const STREETS = ["Mustaqillik ko'chasi", "Navoi ko'chasi", "Amir Temur shoh ko'chasi"]
const REGION_DATA_URL = 'https://raw.githubusercontent.com/MIMAXUZ/uzbekistan-regions-data/master/JSON/regions.json'
const DISTRICT_DATA_URL = 'https://raw.githubusercontent.com/MIMAXUZ/uzbekistan-regions-data/master/JSON/districts.json'
const VILLAGE_DATA_URL = 'https://raw.githubusercontent.com/MIMAXUZ/uzbekistan-regions-data/master/JSON/villages.json'

interface SelectOption {
  value: string
  label: string
}

interface RegionRecord {
  id: number
  name_uz: string
}

interface DistrictRecord {
  id: number
  region_id: number
  name_uz: string
}

interface VillageRecord {
  id: number
  district_id: number
  name_uz: string
}

const normalizeName = (value: string) => value.replace(/\s+/g, ' ').trim()

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
}

const Custom3DSelect = ({ label, value, options, onChange, icon: Icon, placeholder, isLight, disabled }: Custom3DSelectProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const displayValue = value || placeholder || 'Tanlang'

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
                <div className="max-h-45 overflow-y-auto p-1.5 custom-scrollbar">
                  {options.map((opt) => {
                    const isActive = opt.value === value
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => { onChange(opt.value); setIsOpen(false) }}
                        className={`
                          w-full flex items-center justify-between p-2.5 rounded-lg text-left text-[12px] transition-all duration-300 mb-0.5 last:mb-0
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
  const [regionsData, setRegionsData] = useState<RegionRecord[]>([])
  const [districtsData, setDistrictsData] = useState<DistrictRecord[]>([])
  const [villagesData, setVillagesData] = useState<VillageRecord[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadAddressData = async () => {
      try {
        const [regionsResponse, districtsResponse, villagesResponse] = await Promise.all([
          fetch(REGION_DATA_URL),
          fetch(DISTRICT_DATA_URL),
          fetch(VILLAGE_DATA_URL),
        ])

        if (!regionsResponse.ok || !districtsResponse.ok || !villagesResponse.ok) {
          throw new Error('Address data fetch failed')
        }

        const [regionsJson, districtsJson, villagesJson] = await Promise.all([
          regionsResponse.json(),
          districtsResponse.json(),
          villagesResponse.json(),
        ])

        if (!isMounted) return

        setRegionsData((regionsJson as RegionRecord[]).map((item) => ({
          id: item.id,
          name_uz: normalizeName(item.name_uz),
        })))
        setDistrictsData((districtsJson as DistrictRecord[]).map((item) => ({
          id: item.id,
          region_id: item.region_id,
          name_uz: normalizeName(item.name_uz),
        })))
        setVillagesData((villagesJson as VillageRecord[]).map((item) => ({
          id: item.id,
          district_id: item.district_id,
          name_uz: normalizeName(item.name_uz),
        })))
      } catch {
        if (!isMounted) return

        setRegionsData(
          Object.keys(FALLBACK_DISTRICTS).map((name, index) => ({
            id: index + 1,
            name_uz: name,
          }))
        )
        setDistrictsData(
          Object.entries(FALLBACK_DISTRICTS).flatMap(([regionName, districtNames], regionIndex) =>
            districtNames.map((name, districtIndex) => ({
              id: regionIndex * 100 + districtIndex + 1,
              region_id: regionIndex + 1,
              name_uz: regionName === 'Samarqand viloyati' && name === 'Samarqand sh.' ? 'Samarqand shahri' : name,
            }))
          )
        )
        setVillagesData([])
      } finally {
        if (isMounted) setIsLoadingData(false)
      }
    }

    loadAddressData()

    return () => {
      isMounted = false
    }
  }, [])

  const regionOptions = useMemo(() => uniqueOptions(regionsData.map((item) => item.name_uz)), [regionsData])

  const selectedRegion = regionsData.find((item) => normalizeName(item.name_uz) === data.region)
  const districtRecords = useMemo(
    () => (selectedRegion ? districtsData.filter((item) => item.region_id === selectedRegion.id) : []),
    [districtsData, selectedRegion]
  )
  const districtOptions = useMemo(
    () => uniqueOptions(districtRecords.map((item) => item.name_uz)),
    [districtRecords]
  )

  const selectedDistrict = districtRecords.find((item) => normalizeName(item.name_uz) === data.district)
  const selectedDistrictId = selectedDistrict?.id ?? null
  const districtVillages = useMemo(
    () => (selectedDistrictId ? villagesData.filter((item) => item.district_id === selectedDistrictId) : []),
    [selectedDistrictId, villagesData]
  )
  const villageOptions = useMemo(
    () => uniqueOptions(districtVillages.map((item) => item.name_uz)),
    [districtVillages]
  )
  const settlementOptions = useMemo(
    () => (villageOptions.length > 0 ? villageOptions : FALLBACK_SETTLEMENTS.map(toOption)),
    [villageOptions]
  )
  const hasVillageOptions = villageOptions.length > 0
  const isVillageLoading = isLoadingData && villageOptions.length === 0

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
    if (!data.qishloq) return show3DToast(hasVillageOptions ? "Qishloqni tanlang" : "Qishloqni kiriting", 'error')
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
          placeholder="Viloyat"
          onChange={handleRegionChange}
          isLight={isLight}
          disabled={isLoadingData && regionOptions.length === 0}
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
                placeholder="Tuman"
                onChange={handleDistrictChange}
                isLight={isLight}
                disabled={isLoadingData && districtOptions.length === 0}
              />

              {data.district && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <Custom3DSelect
                    label="MFY"
                    value={data.mahalla}
                    options={settlementOptions}
                    icon={Home}
                    placeholder={isLoadingData ? 'Yuklanmoqda...' : 'MFY'}
                    onChange={(v: string) => onChange({ mahalla: v })}
                    isLight={isLight}
                    disabled={isLoadingData && settlementOptions.length === 0}
                  />

                  {hasVillageOptions ? (
                    <Custom3DSelect
                      label="Qishloq"
                      value={data.qishloq}
                      options={villageOptions}
                      icon={MapPin}
                      placeholder={isLoadingData ? 'Yuklanmoqda...' : 'Qishloq'}
                      onChange={(v: string) => onChange({ qishloq: v })}
                      isLight={isLight}
                      disabled={isLoadingData && villageOptions.length === 0}
                    />
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">Qishloq</label>
                      <div className="relative flex items-center">
                        <MapPin className={`absolute left-4 z-10 pointer-events-none ${isLight ? 'text-slate-400' : 'text-slate-600'}`} size={14} />
                        <input
                          className={`w-full p-3 pl-11 rounded-xl text-[13px] font-semibold outline-none transition-all ${isLight ? 'bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-sky-400' : 'bg-white/2 border border-white/8 text-white placeholder:text-slate-600 focus:border-sky-500/40'}`}
                          placeholder={isVillageLoading ? 'Yuklanmoqda...' : 'Qishloq nomi'}
                          value={data.qishloq}
                          onChange={e => onChange({ qishloq: e.target.value })}
                          disabled={isVillageLoading}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-4">
                    <Custom3DSelect
                      label="Ko'cha"
                      value={data.street}
                      options={STREETS.map(toOption)}
                      icon={Navigation}
                      placeholder="Ko'cha"
                      onChange={(v: string) => onChange({ street: v })}
                      isLight={isLight}
                    />
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 block">Uy</label>
                      <div className="relative flex items-center">
                        <Hash className={`absolute left-4 z-10 pointer-events-none ${isLight ? 'text-slate-400' : 'text-slate-600'}`} size={14} />
                        <input
                          className={`w-full p-3 pl-11 rounded-xl text-[13px] font-semibold outline-none transition-all ${isLight ? 'bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-sky-400' : 'bg-white/2 border border-white/8 text-white placeholder:text-slate-600 focus:border-sky-500/40'}`}
                          placeholder="14A"
                          value={data.houseNumber}
                          onChange={e => onChange({ houseNumber: e.target.value })}
                        />
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
            ${isLight ? 'bg-linear-to-r from-sky-500 to-indigo-500 hover:shadow-lg hover:shadow-sky-500/15' : 'bg-linear-to-r from-sky-600 to-indigo-600 hover:shadow-lg hover:shadow-sky-500/20'}
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