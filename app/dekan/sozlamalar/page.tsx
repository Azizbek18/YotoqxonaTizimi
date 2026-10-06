'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Wallet,
    Phone,
    ShieldAlert,
    Globe2,
    Send,
    MapPinned,
    Building2,
    RotateCcw,
    Sliders,
    Building,
    Plus,
    Check,
    KeyRound,
    FileCheck2,
    Save,
    Star,
    CheckCircle2,
    Info,
    Coins,
    UserCheck,
    Stethoscope,
    PhoneCall,
    Copy,
    Sparkles,
    FileText,
    ArrowRight,
    Lock,
    ShieldCheck,
} from 'lucide-react'
import { UZ_REGION_NAMES } from '@/lib/uz-address'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useDekanScope } from '@/lib/hooks/useDekanScope'
import { permitFacultyLabel } from '@/lib/faculties'
import {
    fetchDekanSettings,
    updateAppSettings,
    fetchDekanTelegramChat,
    updateDekanTelegramChat,
} from '@/features/app-settings/client/api'
import type { AppSettings } from '@/features/app-settings/types'
import { fetchBlockedRoomMap, fetchDekanDorm } from '@/features/dorms/client/api'
import type { BlockedRoomMapDorm, DekanDorm } from '@/features/dorms/types'
import DormFloorsCard from '@/components/dekan/DormFloorsCard'
import BlockedDormFloorsCard from '@/components/dekan/BlockedDormFloorsCard'
import AddDormCard from '@/components/dekan/AddDormCard'
import DormRoomSettingsCard from '@/components/dekan/DormRoomSettingsCard'
import AttendanceSettingsCard from '@/components/dekan/AttendanceSettingsCard'
import DekanSignatureCard from '@/components/dekan/DekanSignatureCard'
import MemberPermissionsCard from '@/components/dekan/MemberPermissionsCard'
import { dekanUI } from '@/lib/dekan-ui'
import { SkelForm } from '@/components/ui/skeletons'

type MainTab = 'dorms' | 'finance' | 'documents' | 'contacts' | 'security'
type BuildingSubTab = 'all' | 'floors' | 'rooms' | 'attendance'

type NumberField = {
    key: 'monthlyFee' | 'yearlyContractFee' | 'maxUploadSizeMb' | 'warningThreshold'
    label: string
    description: string
    suffix: string
}

export default function DekanSozlamalarPage() {
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'
    const ui = dekanUI(isLight)
    const { effectiveFaculty: dekanFaculty } = useDekanScope()

    const [settings, setSettings] = useState<AppSettings | null>(null)
    const [savedSettings, setSavedSettings] = useState<AppSettings | null>(null)
    const [dorms, setDorms] = useState<DekanDorm[]>([])
    const [blockedDorms, setBlockedDorms] = useState<BlockedRoomMapDorm[] | null>(null)
    const [blockedDormsLoadFailed, setBlockedDormsLoadFailed] = useState(false)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    const [telegramChat, setTelegramChat] = useState('')
    const [savedTelegramChat, setSavedTelegramChat] = useState('')
    const [telegramSaving, setTelegramSaving] = useState(false)
    const [copiedBot, setCopiedBot] = useState(false)

    // Navigation state
    const [activeMainTab, setActiveMainTab] = useState<MainTab>('dorms')
    const [selectedDormId, setSelectedDormId] = useState<string | null>(null)
    const [buildingSubTab, setBuildingSubTab] = useState<BuildingSubTab>('all')

    const loadSettings = useCallback(async () => {
        setLoading(true)
        setLoadError(null)
        try {
            const data = await fetchDekanSettings()
            setSettings(data)
            setSavedSettings(data)
        } catch (error) {
            const message = error instanceof Error ? error.message : "Sozlamalarni yuklab bo'lmadi"
            setSettings(null)
            setSavedSettings(null)
            setLoadError(message)
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadSettings()
    }, [loadSettings])

    useEffect(() => {
        fetchDekanDorm()
            .then(({ dorms }) => setDorms(dorms))
            .catch(() => setDorms([]))
        fetchBlockedRoomMap()
            .then(({ dorms }) => {
                setBlockedDorms(dorms)
                setBlockedDormsLoadFailed(false)
            })
            .catch(() => {
                setBlockedDorms([])
                setBlockedDormsLoadFailed(true)
            })
    }, [])

    useEffect(() => {
        fetchDekanTelegramChat()
            .then((chatId) => { setTelegramChat(chatId); setSavedTelegramChat(chatId) })
            .catch(() => { setTelegramChat(''); setSavedTelegramChat('') })
    }, [])

    // Ensure active building selection is synchronized
    useEffect(() => {
        if (dorms.length > 0) {
            if (!selectedDormId || (!dorms.some((d) => d.dormId === selectedDormId) && selectedDormId !== '__new__')) {
                const primary = dorms.find((d) => d.isPrimary) ?? dorms[0]
                setSelectedDormId(primary.dormId)
            }
        } else if (dorms.length === 0 && selectedDormId !== '__new__') {
            setSelectedDormId(null)
        }
    }, [dorms, selectedDormId])

    const activeDorm = useMemo(() => {
        if (!dorms.length || selectedDormId === '__new__') return null
        return dorms.find((d) => d.dormId === selectedDormId) ?? dorms[0]
    }, [dorms, selectedDormId])

    const updateOneDorm = useCallback((next: DekanDorm) => {
        setDorms((prev) => prev.map((d) => (d.dormId === next.dormId ? next : d)))
    }, [])

    const handleSaveTelegram = async () => {
        try {
            setTelegramSaving(true)
            const saved = await updateDekanTelegramChat(telegramChat.trim())
            setTelegramChat(saved)
            setSavedTelegramChat(saved)
            toast.success(saved ? 'Telegram bildirishnomasi yoqildi!' : 'Telegram bildirishnomasi o‘chirildi')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Saqlanmadi')
        } finally {
            setTelegramSaving(false)
        }
    }

    const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
        setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
    }

    const toggleHomeRegion = (region: string) => {
        if (!settings) return
        const has = settings.homeRegions.includes(region)
        handleChange(
            'homeRegions',
            has ? settings.homeRegions.filter((r) => r !== region) : [...settings.homeRegions, region],
        )
    }

    const selectAllRegions = () => {
        if (!settings) return
        handleChange('homeRegions', [...UZ_REGION_NAMES])
    }

    const clearAllRegions = () => {
        if (!settings) return
        handleChange('homeRegions', [])
    }

    const selectTashkentOnly = () => {
        if (!settings) return
        handleChange('homeRegions', ['Toshkent shahri', 'Toshkent viloyati'])
    }

    const handleCancel = () => {
        if (savedSettings) setSettings(savedSettings)
    }

    const handleSave = useCallback(async () => {
        if (!settings) return
        try {
            setSaving(true)
            const updated = await updateAppSettings(settings)
            setSettings(updated)
            setSavedSettings(updated)
            toast.success('Barcha sozlamalar muvaffaqiyatli saqlandi!')
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Saqlanishda xato!'
            toast.error(message)
        } finally {
            setSaving(false)
        }
    }, [settings])

    const isDirty = useMemo(() => {
        return (
            settings !== null &&
            savedSettings !== null &&
            JSON.stringify(settings) !== JSON.stringify(savedSettings)
        )
    }, [settings, savedSettings])

    // Keyboard shortcut: Ctrl + S / Cmd + S to save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                if (isDirty && !saving) {
                    void handleSave()
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isDirty, saving, handleSave])

    // Check which tabs contain unsaved edits
    const dirtyTabs = useMemo(() => {
        if (!settings || !savedSettings) return { finance: false, documents: false, contacts: false, security: false }
        return {
            finance:
                settings.monthlyFee !== savedSettings.monthlyFee ||
                settings.yearlyContractFee !== savedSettings.yearlyContractFee,
            documents:
                settings.ttjName !== savedSettings.ttjName ||
                JSON.stringify(settings.homeRegions) !== JSON.stringify(savedSettings.homeRegions),
            contacts:
                settings.tarbiyachiName !== savedSettings.tarbiyachiName ||
                settings.tarbiyachiPhone !== savedSettings.tarbiyachiPhone ||
                settings.komendantName !== savedSettings.komendantName ||
                settings.komendantPhone !== savedSettings.komendantPhone ||
                settings.doctorName !== savedSettings.doctorName ||
                settings.doctorPhone !== savedSettings.doctorPhone ||
                settings.securityPhone !== savedSettings.securityPhone,
            security:
                settings.maxUploadSizeMb !== savedSettings.maxUploadSizeMb ||
                settings.warningThreshold !== savedSettings.warningThreshold,
        }
    }, [settings, savedSettings])

    const dirtyTabNames = useMemo(() => {
        const names: string[] = []
        if (dirtyTabs.finance) names.push('Moliya')
        if (dirtyTabs.documents) names.push('Hujjatlar')
        if (dirtyTabs.contacts) names.push('Aloqa')
        if (dirtyTabs.security) names.push('Xavfsizlik')
        return names
    }, [dirtyTabs])

    const copyBot = () => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText('@MeningYotoqxonamBot')
            setCopiedBot(true)
            toast.success('Bot username nusxalandi!')
            setTimeout(() => setCopiedBot(false), 2000)
        }
    }

    const inputCls = `rounded-xl border text-sm px-3.5 py-2.5 transition-all outline-none ${ui.input} ${ui.ring}`

    const mainTabsConfig: Array<{
        id: MainTab
        label: string
        icon: typeof Building2
        hasDirty?: boolean
        badge?: string | number
        badgeColor?: string
    }> = [
        {
            id: 'dorms',
            label: 'Yotoqxona binolari',
            icon: Building2,
            badge: dorms.length > 0 ? dorms.length : undefined,
        },
        {
            id: 'finance',
            label: "Moliya & To'lovlar",
            icon: Wallet,
            hasDirty: dirtyTabs.finance,
        },
        {
            id: 'documents',
            label: 'Hujjatlar & Propiska',
            icon: Globe2,
            hasDirty: dirtyTabs.documents,
        },
        {
            id: 'contacts',
            label: 'Telegram & Aloqa',
            icon: Phone,
            hasDirty: dirtyTabs.contacts || telegramChat.trim() !== savedTelegramChat.trim(),
            badge: savedTelegramChat ? 'Ulangan' : undefined,
            badgeColor: 'emerald',
        },
        {
            id: 'security',
            label: 'Imzo & Xavfsizlik',
            icon: KeyRound,
            hasDirty: dirtyTabs.security,
        },
    ]

    const emergencyContactsList = [
        {
            title: 'Tarbiyachi (Navbatchi pedagog)',
            icon: UserCheck,
            color: 'from-blue-500 to-indigo-600',
            nameKey: 'tarbiyachiName' as const,
            phoneKey: 'tarbiyachiPhone' as const,
            hasName: true,
            placeholderName: 'Masalan: Sobir Rahimov',
            desc: "Talabalar tartib-intizomi va kechki yo'qlama uchun mas'ul pedagog",
        },
        {
            title: 'Komendant (Bino mudiri)',
            icon: Building,
            color: 'from-amber-500 to-orange-600',
            nameKey: 'komendantName' as const,
            phoneKey: 'komendantPhone' as const,
            hasName: true,
            placeholderName: 'Masalan: Jamshid Aliyev',
            desc: "Xonalar jihozi, kalitlar va bino xo'jaligi masalalari bo'yicha mas'ul",
        },
        {
            title: 'Tibbiy yordam xonasi (Shifokor)',
            icon: Stethoscope,
            color: 'from-emerald-500 to-teal-600',
            nameKey: 'doctorName' as const,
            phoneKey: 'doctorPhone' as const,
            hasName: true,
            placeholderName: 'Masalan: Malika Karimova',
            desc: 'Talabalar salomatligi va birinchi tezkor tibbiy yordam ko‘rsatish xodimi',
        },
        {
            title: 'Xavfsizlik & Qo‘riqlash xizmati',
            icon: ShieldCheck,
            color: 'from-rose-500 to-red-600',
            nameKey: 'securityPhone' as const,
            phoneKey: 'securityPhone' as const,
            hasName: false,
            placeholderName: '',
            desc: 'Yotoqxona hududida tun-u kun xavfsizlik va nazorat punkti navbatchisi',
        },
    ]

    return (
        <div className="space-y-6 pb-28">
            {/* 1. Academic Hero Header Banner */}
            <div className="no-shelf relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-950 p-5 sm:p-7 shadow-2xl shadow-indigo-950/30 border border-white/15 text-white">
                <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -left-16 -bottom-20 h-60 w-60 rounded-full bg-violet-500/20 blur-3xl" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px] opacity-[0.06]" />

                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="flex items-start sm:items-center gap-4">
                        <div className="flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-xl text-white border border-white/25 shadow-lg shadow-black/20 shrink-0">
                            <Sliders size={26} strokeWidth={2.2} />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold bg-white/15 text-white backdrop-blur-md border border-white/20">
                                    <Building2 size={12} className="text-white/80" />
                                    {dekanFaculty ? permitFacultyLabel(dekanFaculty) : 'Fakultet boshqaruvi'}
                                </span>
                                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Tizim konfiguratsiyasi faol
                                </span>
                            </div>
                            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                                Dekan tizim sozlamalari
                            </h1>
                            <p className="text-xs text-indigo-100/90 mt-1 max-w-xl leading-relaxed">
                                Binolar fondi, to‘lov tariflari, rasmiy blanklar, Telegram bildirishnomalari va xodimlar vakolatlarini markazlashgan boshqarish
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
                        <button
                            type="button"
                            onClick={() => void loadSettings()}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white text-xs font-bold transition-all disabled:opacity-50 no-shelf cursor-pointer active:scale-95 shadow-sm"
                            title="Ma'lumotlarni qayta yuklash"
                        >
                            <motion.div
                                animate={loading ? { rotate: 360 } : {}}
                                transition={loading ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}
                            >
                                <RotateCcw size={14} />
                            </motion.div>
                            <span>Yangilash</span>
                        </button>
                    </div>
                </div>

                {/* Academic Quick Status Metrics Strip */}
                {settings && (
                    <div className="relative mt-6 pt-5 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="flex items-center gap-3 bg-white/10 rounded-2xl p-3 backdrop-blur-md border border-white/10 transition-colors hover:bg-white/15">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/30 text-indigo-200 shrink-0">
                                <Building2 size={18} />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase font-bold text-indigo-200 tracking-wider">Binolar fondi</div>
                                <div className="font-extrabold truncate text-white text-sm">{dorms.length} ta yotoqxona</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-white/10 rounded-2xl p-3 backdrop-blur-md border border-white/10 transition-colors hover:bg-white/15">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/30 text-emerald-200 shrink-0">
                                <Coins size={18} />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase font-bold text-emerald-200 tracking-wider">Oylik to‘lov</div>
                                <div className="font-extrabold truncate text-white text-sm">
                                    {Number(settings.monthlyFee).toLocaleString()} so‘m
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-white/10 rounded-2xl p-3 backdrop-blur-md border border-white/10 transition-colors hover:bg-white/15">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/30 text-sky-200 shrink-0">
                                <Send size={18} />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase font-bold text-sky-200 tracking-wider">Telegram bildirishnoma</div>
                                <div className="font-extrabold truncate text-white text-sm">
                                    {savedTelegramChat ? 'Faol ulangan' : 'Ulanmagan'}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-white/10 rounded-2xl p-3 backdrop-blur-md border border-white/10 transition-colors hover:bg-white/15">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/30 text-amber-200 shrink-0">
                                <MapPinned size={18} />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase font-bold text-amber-200 tracking-wider">Mahalliy hudud</div>
                                <div className="font-extrabold truncate text-white text-sm">
                                    {settings.homeRegions.length} / {UZ_REGION_NAMES.length} viloyat
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div className={`rounded-3xl border p-6 ${ui.card}`}>
                    <SkelForm fields={6} />
                </div>
            ) : loadError || !settings ? (
                <div className={`rounded-3xl border p-12 text-center ${ui.card}`}>
                    <ShieldAlert className={`mx-auto h-14 w-14 ${isLight ? 'text-rose-500' : 'text-rose-400'}`} />
                    <h2 className={`mt-4 text-lg font-bold ${ui.strong}`}>Sozlamalar ochilmadi</h2>
                    <p className={`mx-auto mt-2 max-w-xl text-sm ${ui.muted}`}>
                        {loadError ?? "Sozlamalarni yuklab bo'lmadi"}. Fakultet xavfsizligi uchun standart parametrlar bilan tahrirlash cheklandi.
                    </p>
                    <button
                        type="button"
                        onClick={() => void loadSettings()}
                        className={`mt-6 rounded-xl px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${ui.accentSolid}`}
                    >
                        Qayta urinish
                    </button>
                </div>
            ) : (
                <>
                    {/* 2. Primary Navigation Tabs (Sleek Segmented Control) */}
                    <div className="overflow-x-auto scrollbar-none py-1">
                        <div
                            role="tablist"
                            aria-label="Sozlamalar toifalari"
                            className={`no-shelf inline-flex items-center gap-1.5 p-1.5 rounded-2xl border transition-all ${
                                isLight
                                    ? 'bg-slate-100/90 border-slate-200/90'
                                    : 'bg-slate-900/90 border-slate-800'
                            }`}
                        >
                            {mainTabsConfig.map((tab) => {
                                const Icon = tab.icon
                                const isActive = activeMainTab === tab.id
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        onClick={() => setActiveMainTab(tab.id)}
                                        className={`no-shelf group relative inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all duration-150 shrink-0 cursor-pointer select-none active:scale-[0.98] ${
                                            isActive
                                                ? isLight
                                                    ? 'bg-white text-indigo-700 border border-slate-200/90 font-bold'
                                                    : 'bg-indigo-600 text-white border border-indigo-500/40 font-bold'
                                                : isLight
                                                ? 'text-slate-600 hover:text-slate-900 hover:bg-white/70 border border-transparent font-medium'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] border border-transparent font-medium'
                                        }`}
                                        style={{
                                            boxShadow: isActive
                                                ? isLight
                                                    ? '0 1px 3px rgba(15, 23, 42, 0.08)'
                                                    : '0 2px 8px rgba(79, 70, 229, 0.3)'
                                                : 'none',
                                        }}
                                    >
                                        <Icon
                                            size={17}
                                            className={`shrink-0 transition-colors ${
                                                isActive
                                                    ? isLight
                                                        ? 'text-indigo-600'
                                                        : 'text-white'
                                                    : isLight
                                                    ? 'text-slate-400 group-hover:text-slate-600'
                                                    : 'text-slate-500 group-hover:text-slate-300'
                                            }`}
                                        />
                                        <span>{tab.label}</span>

                                        {tab.badge !== undefined && (
                                            <span
                                                className={`no-shelf inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-black rounded-full shrink-0 transition-colors ${
                                                    tab.badgeColor === 'emerald'
                                                        ? isActive
                                                            ? isLight
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                                                : 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/40'
                                                            : isLight
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                                            : 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                                                        : isActive
                                                        ? isLight
                                                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                                                            : 'bg-white/20 text-white'
                                                        : isLight
                                                        ? 'bg-slate-200/80 text-slate-700'
                                                        : 'bg-slate-800 text-slate-300'
                                                }`}
                                            >
                                                {tab.badgeColor === 'emerald' && (
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 shrink-0" />
                                                )}
                                                {tab.badge}
                                            </span>
                                        )}

                                        {tab.hasDirty && (
                                            <span
                                                title="Saqlanmagan o'zgarish bor"
                                                className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900 animate-pulse shrink-0"
                                            />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* 3. Tab Contents */}
                    <AnimatePresence mode="wait">
                        {/* ========================================================= */}
                        {/* 1. YOTOQXONA BINOLARI TABI */}
                        {/* ========================================================= */}
                        {activeMainTab === 'dorms' && (
                            <motion.div
                                key="tab-dorms"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.16 }}
                                className="space-y-6"
                            >
                                {dorms.length === 0 && selectedDormId !== '__new__' ? (
                                    <div className={`rounded-3xl border p-10 text-center space-y-4 ${ui.card}`}>
                                        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${ui.accentTileSoft}`}>
                                            <Building2 size={32} className={ui.accentText} />
                                        </div>
                                        <div>
                                            <h3 className={`text-base font-bold ${ui.strong}`}>Hozircha yotoqxona biriktirilmagan</h3>
                                            <p className={`text-xs mt-1.5 max-w-md mx-auto leading-relaxed ${ui.muted}`}>
                                                Fakultetingiz talabalari joylashishi uchun yangi yotoqxona binosini biriktiring yoki mavjudlariga ulaning.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDormId('__new__')}
                                            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider ${ui.accentSolid}`}
                                        >
                                            <Plus size={15} />
                                            <span>Yangi bino biriktirish</span>
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {/* Professional Interactive Building Switcher Carousel */}
                                        <div className={`rounded-3xl border p-4 sm:p-5 ${ui.card}`}>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${ui.accentTileSoft}`}>
                                                        <Building size={16} className={ui.accentText} />
                                                    </span>
                                                    <div>
                                                        <h3 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
                                                            Binolar fondi ({dorms.length} ta yotoqxona)
                                                        </h3>
                                                        <p className={`text-[11px] ${ui.muted}`}>Boshqarish uchun kerakli binoni tanlang</p>
                                                    </div>
                                                </div>

                                                {selectedDormId !== '__new__' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedDormId('__new__')}
                                                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl border transition-all cursor-pointer shadow-2xs ${
                                                            isLight
                                                                ? 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300'
                                                                : 'border-indigo-500/30 text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20'
                                                        }`}
                                                    >
                                                        <Plus size={14} />
                                                        <span>Yangi bino biriktirish</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Horizontal Building Cards Slider */}
                                            <div className="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-none">
                                                {dorms.map((dorm) => {
                                                    const isSelected = activeDorm?.dormId === dorm.dormId && selectedDormId !== '__new__'
                                                    const isBlocked = dorm.layoutKind === 'blocked'
                                                    return (
                                                        <button
                                                            key={dorm.dormId}
                                                            type="button"
                                                            onClick={() => setSelectedDormId(dorm.dormId)}
                                                            className={`no-shelf relative flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border text-left transition-all shrink-0 cursor-pointer min-w-[230px] ${
                                                                isSelected
                                                                    ? isLight
                                                                        ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 shadow-sm ring-2 ring-indigo-400/80'
                                                                        : 'bg-indigo-950/60 border-indigo-500 text-white shadow-md shadow-indigo-950/40 ring-2 ring-indigo-500/80'
                                                                    : isLight
                                                                    ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 text-slate-800'
                                                                    : 'bg-slate-800/40 border-slate-700 hover:border-slate-600 hover:bg-slate-800/70 text-slate-200'
                                                            }`}
                                                            style={{ boxShadow: isSelected ? (isLight ? '0 2px 6px rgba(79, 70, 229, 0.12)' : '0 4px 12px rgba(0, 0, 0, 0.4)') : 'none' }}
                                                        >
                                                            <div
                                                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform ${
                                                                    isSelected
                                                                        ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md shadow-indigo-500/30 scale-105'
                                                                        : isLight
                                                                        ? 'bg-slate-100 text-slate-600'
                                                                        : 'bg-slate-700/60 text-slate-300'
                                                                }`}
                                                            >
                                                                <Building2 size={20} strokeWidth={2.2} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-black text-sm truncate">
                                                                        {dorm.number}-yotoqxona
                                                                    </span>
                                                                    {dorm.isPrimary && (
                                                                        <span
                                                                            title="Asosiy yotoqxona"
                                                                            className="flex items-center text-amber-500 shrink-0"
                                                                        >
                                                                            <Star size={13} className="fill-amber-400" />
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 mt-1 text-[11px] opacity-80">
                                                                    <span className={`px-1.5 py-0.2 rounded font-semibold ${isBlocked ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'}`}>
                                                                        {isBlocked ? 'Blokli' : 'Oddiy'}
                                                                    </span>
                                                                    <span>•</span>
                                                                    <span className="font-bold">{dorm.floors.length} qavat</span>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    )
                                                })}

                                                {/* Add New Dorm Quick Tab */}
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedDormId('__new__')}
                                                    className={`no-shelf flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-dashed text-left transition-all shrink-0 cursor-pointer ${
                                                        selectedDormId === '__new__'
                                                            ? isLight
                                                                ? 'bg-indigo-50 border-indigo-400 text-indigo-700 ring-2 ring-indigo-400/80'
                                                                : 'bg-indigo-950/40 border-indigo-500 text-indigo-300 ring-2 ring-indigo-500/80'
                                                            : isLight
                                                            ? 'border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                                                            : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-800/40'
                                                    }`}
                                                    style={{ boxShadow: 'none' }}
                                                >
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                                                        <Plus size={18} />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold leading-tight">Yangi bino</div>
                                                        <div className="text-[10px] opacity-70 mt-0.5">Qo‘shish / bog‘lash</div>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Display AddDormCard if selected */}
                                        {selectedDormId === '__new__' ? (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.99 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ duration: 0.15 }}
                                                className="space-y-4"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <h3 className={`text-sm font-bold ${ui.strong}`}>
                                                        Yangi talabalar turar joyini biriktirish
                                                    </h3>
                                                    {dorms.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedDormId(dorms[0].dormId)}
                                                            className={`text-xs font-semibold hover:underline ${ui.accentText}`}
                                                        >
                                                            ← Mavjud binoga qaytish
                                                        </button>
                                                    )}
                                                </div>
                                                <AddDormCard
                                                    onAdded={(d) => {
                                                        setDorms((prev) => [...prev, d])
                                                        setSelectedDormId(d.dormId)
                                                    }}
                                                />
                                            </motion.div>
                                        ) : activeDorm ? (
                                            /* Active Building Management Workspace */
                                            <motion.div
                                                key={activeDorm.dormId}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="space-y-6"
                                            >
                                                {/* Selected Building Context Strip */}
                                                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl border ${ui.card}`}>
                                                    <div className="flex items-center gap-3.5">
                                                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${ui.accentTile}`}>
                                                            <Building2 size={20} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h2 className={`text-base font-black ${ui.strong}`}>
                                                                    {activeDorm.number}-sonli yotoqxona sozlamalari
                                                                </h2>
                                                                {activeDorm.isPrimary && (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                                                        <Star size={10} className="fill-amber-400" /> Asosiy bino
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className={`text-xs mt-0.5 ${ui.muted}`}>
                                                                Arxitektura: <span className="font-semibold">{activeDorm.layoutKind === 'blocked' ? 'Blokli korpuslar' : 'Xonama-xona (oddiy)'}</span> • Qavatlar: <span className="font-semibold">{activeDorm.floors.length} ta</span> • Yo&apos;qlama: <span className="font-semibold">{activeDorm.attendance.enabled ? 'Faol' : 'O‘chiq'}</span>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Building Sub-Tabs / View Mode Filter */}
                                                    <div className={`no-shelf flex items-center p-1 rounded-xl border self-start sm:self-center ${isLight ? 'bg-slate-100/90 border-slate-200/90' : 'bg-slate-800/80 border-slate-700'}`}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setBuildingSubTab('all')}
                                                            className={`no-shelf px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                                buildingSubTab === 'all'
                                                                    ? isLight
                                                                        ? 'bg-white text-indigo-700 border border-slate-200/90 font-bold'
                                                                        : 'bg-indigo-600 text-white shadow-xs'
                                                                    : `${ui.muted} hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/50`
                                                            }`}
                                                            style={{ boxShadow: buildingSubTab === 'all' && isLight ? '0 1px 2px rgba(15,23,42,0.06)' : 'none' }}
                                                        >
                                                            Barchasi
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setBuildingSubTab('floors')}
                                                            className={`no-shelf px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                                buildingSubTab === 'floors'
                                                                    ? isLight
                                                                        ? 'bg-white text-indigo-700 border border-slate-200/90 font-bold'
                                                                        : 'bg-indigo-600 text-white shadow-xs'
                                                                    : `${ui.muted} hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/50`
                                                            }`}
                                                            style={{ boxShadow: buildingSubTab === 'floors' && isLight ? '0 1px 2px rgba(15,23,42,0.06)' : 'none' }}
                                                        >
                                                            Qavatlar
                                                        </button>
                                                        {activeDorm.layoutKind !== 'blocked' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setBuildingSubTab('rooms')}
                                                                className={`no-shelf px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                                    buildingSubTab === 'rooms'
                                                                        ? isLight
                                                                            ? 'bg-white text-indigo-700 border border-slate-200/90 font-bold'
                                                                            : 'bg-indigo-600 text-white shadow-xs'
                                                                        : `${ui.muted} hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/50`
                                                                }`}
                                                                style={{ boxShadow: buildingSubTab === 'rooms' && isLight ? '0 1px 2px rgba(15,23,42,0.06)' : 'none' }}
                                                            >
                                                                Xonalar
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => setBuildingSubTab('attendance')}
                                                            className={`no-shelf px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                                buildingSubTab === 'attendance'
                                                                    ? isLight
                                                                        ? 'bg-white text-indigo-700 border border-slate-200/90 font-bold'
                                                                        : 'bg-indigo-600 text-white shadow-xs'
                                                                    : `${ui.muted} hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-700/50`
                                                            }`}
                                                            style={{ boxShadow: buildingSubTab === 'attendance' && isLight ? '0 1px 2px rgba(15,23,42,0.06)' : 'none' }}
                                                        >
                                                            Davomat
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* 1. Floor Layout Section */}
                                                {(buildingSubTab === 'all' || buildingSubTab === 'floors') && (
                                                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                                                        {activeDorm.layoutKind === 'blocked' ? (
                                                            <BlockedDormFloorsCard
                                                                dorm={activeDorm}
                                                                sections={
                                                                    blockedDorms?.find((item) => item.dormId === activeDorm.dormId)?.sections ?? []
                                                                }
                                                                loading={blockedDorms === null}
                                                                loadFailed={blockedDormsLoadFailed}
                                                            />
                                                        ) : (
                                                            <DormFloorsCard
                                                                dorm={activeDorm}
                                                                onChange={updateOneDorm}
                                                                onDormsChange={setDorms}
                                                                showBuildingControls={dorms.length > 1}
                                                            />
                                                        )}
                                                    </motion.div>
                                                )}

                                                {/* 2. Room Configuration Section */}
                                                {(buildingSubTab === 'all' || buildingSubTab === 'rooms') &&
                                                    activeDorm.layoutKind !== 'blocked' && (
                                                        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                                                            <DormRoomSettingsCard dorm={activeDorm} />
                                                        </motion.div>
                                                    )}

                                                {/* 3. Attendance & Nightly Roll-call Section */}
                                                {(buildingSubTab === 'all' || buildingSubTab === 'attendance') && (
                                                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                                                        <AttendanceSettingsCard dorm={activeDorm} onChange={updateOneDorm} />
                                                    </motion.div>
                                                )}
                                            </motion.div>
                                        ) : null}
                                    </>
                                )}
                            </motion.div>
                        )}

                        {/* ========================================================= */}
                        {/* 2. MOLIYA & TO'LOVLAR TABI */}
                        {/* ========================================================= */}
                        {activeMainTab === 'finance' && (
                            <motion.div
                                key="tab-finance"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.16 }}
                                className="space-y-6"
                            >
                                <div className={`rounded-3xl border overflow-hidden ${ui.card}`}>
                                    <div className={`flex items-center gap-3 border-b p-5 sm:px-6 ${ui.border}`}>
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${ui.accentTile}`}>
                                            <Wallet size={19} strokeWidth={2.2} />
                                        </div>
                                        <div>
                                            <h2 className={`text-base font-bold ${ui.strong}`}>To‘lov va tarif stavkalari</h2>
                                            <p className={`text-xs ${ui.muted}`}>Talabalar uchun oylik badal va rasmiy shartnoma qiymatlari</p>
                                        </div>
                                    </div>
                                    <div className="p-5 sm:p-7 space-y-7">
                                        {/* Financial Highlights */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className={`p-4.5 rounded-2xl border transition-all ${
                                                isLight ? 'bg-gradient-to-br from-indigo-50/90 to-blue-50/50 border-indigo-200/80 shadow-xs' : 'bg-gradient-to-br from-indigo-950/30 to-blue-950/20 border-indigo-500/30'
                                            }`}>
                                                <div className="flex items-center gap-3.5">
                                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md shadow-indigo-500/25">
                                                        <Coins size={20} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                                            Oylik to‘lov stavkasi
                                                        </div>
                                                        <div className={`text-xl font-black tabular-nums mt-0.5 ${ui.strong}`}>
                                                            {Number(settings.monthlyFee || 0).toLocaleString()} so‘m <span className="text-xs font-normal opacity-70">/ oy</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={`p-4.5 rounded-2xl border transition-all ${
                                                isLight ? 'bg-gradient-to-br from-violet-50/90 to-purple-50/50 border-violet-200/80 shadow-xs' : 'bg-gradient-to-br from-violet-950/30 to-purple-950/20 border-violet-500/30'
                                            }`}>
                                                <div className="flex items-center gap-3.5">
                                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-md shadow-violet-500/25">
                                                        <FileCheck2 size={20} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                                                            Yillik shartnoma summasi
                                                        </div>
                                                        <div className={`text-xl font-black tabular-nums mt-0.5 ${ui.strong}`}>
                                                            {Number(settings.yearlyContractFee || 0).toLocaleString()} so‘m <span className="text-xs font-normal opacity-70">/ yil</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Input form with presets */}
                                        <div className="space-y-6 pt-2">
                                            {/* 1. Monthly fee field */}
                                            <div className={`p-5 rounded-2xl border ${isLight ? 'bg-slate-50/60 border-slate-200' : 'bg-slate-800/30 border-slate-700/80'}`}>
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div>
                                                        <h3 className={`text-sm font-black ${ui.strong}`}>Oylik to‘lov summasi</h3>
                                                        <p className={`text-xs mt-1 leading-relaxed ${ui.muted}`}>
                                                            Talabalar har oy to‘lashi kerak bo‘lgan oylik to‘lov miqdori
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min={1000}
                                                                step={10000}
                                                                value={settings.monthlyFee}
                                                                onChange={(e) => handleChange('monthlyFee', Math.max(0, Number(e.target.value)))}
                                                                className={`${inputCls} w-full sm:w-48 font-black text-base pr-12`}
                                                            />
                                                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                                                so‘m
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Quick Presets */}
                                                <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                                                    <span className={`text-[10px] font-bold uppercase mr-1 ${ui.muted}`}>Tezkor stavkalar:</span>
                                                    {[250000, 350000, 400000, 450000, 500000, 600000].map((preset) => (
                                                        <button
                                                            key={preset}
                                                            type="button"
                                                            onClick={() => handleChange('monthlyFee', preset)}
                                                            className={`no-shelf text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                                                settings.monthlyFee === preset
                                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                                    : isLight
                                                                    ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-750'
                                                            }`}
                                                            style={{
                                                                boxShadow: settings.monthlyFee === preset ? '0 1px 2px rgba(79, 70, 229, 0.25)' : 'none',
                                                            }}
                                                        >
                                                            {(preset / 1000).toLocaleString()} ming
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* 2. Yearly contract fee field */}
                                            <div className={`p-5 rounded-2xl border ${isLight ? 'bg-slate-50/60 border-slate-200' : 'bg-slate-800/30 border-slate-700/80'}`}>
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div>
                                                        <h3 className={`text-sm font-black ${ui.strong}`}>Yillik shartnoma summasi</h3>
                                                        <p className={`text-xs mt-1 leading-relaxed ${ui.muted}`}>
                                                            To‘lovlar bo‘limi va rasmiy shartnoma kvitansiyalarida to‘liq yillik qiymat sifatida aks etadi
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min={1000}
                                                                step={50000}
                                                                value={settings.yearlyContractFee}
                                                                onChange={(e) => handleChange('yearlyContractFee', Math.max(0, Number(e.target.value)))}
                                                                className={`${inputCls} w-full sm:w-48 font-black text-base pr-12`}
                                                            />
                                                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                                                so‘m
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Auto-calculate helper */}
                                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleChange('yearlyContractFee', settings.monthlyFee * 10)}
                                                        className={`no-shelf inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                                                            isLight ? 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100' : 'bg-violet-950/40 text-violet-300 border-violet-500/30 hover:bg-violet-900/40'
                                                        }`}
                                                        style={{ boxShadow: 'none' }}
                                                    >
                                                        <Sparkles size={12} />
                                                        <span>10 oylik o‘quv yiliga tenglashtirish ({Number(settings.monthlyFee * 10).toLocaleString()} so‘m)</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={`flex items-start gap-3 rounded-2xl border p-4.5 text-xs leading-relaxed ${isLight ? 'border-indigo-100 bg-indigo-50/60 text-indigo-950' : 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200'}`}>
                                            <Info size={19} className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                                            <div>
                                                <span className="font-bold">Eslatma:</span> Bu yerda kiritilgan summalar fakultet talabalari uchun &laquo;To‘lovlar&raquo; sahifasida hisob-kitoblar, qarzdorliklar va kvitansiyalar shakllanishida asos qilib olinadi. O‘zgartirish kiritilgach pastdagi saqlash tugmasini (yoki <kbd className="px-1 py-0.5 rounded bg-white/20 font-mono text-[10px]">Ctrl+S</kbd>) bosing.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ========================================================= */}
                        {/* 3. HUJJATLAR & PROPISKA TABI */}
                        {/* ========================================================= */}
                        {activeMainTab === 'documents' && (
                            <motion.div
                                key="tab-documents"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.16 }}
                                className="space-y-6"
                            >
                                {/* TTJ Name Section with Live Document Preview */}
                                <div className={`rounded-3xl border overflow-hidden ${ui.card}`}>
                                    <div className={`flex items-center gap-3 border-b p-5 sm:px-6 ${ui.border}`}>
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${ui.accentTile}`}>
                                            <Globe2 size={19} strokeWidth={2.2} />
                                        </div>
                                        <div>
                                            <h2 className={`text-base font-bold ${ui.strong}`}>Xorijlik va imtiyozli talabalar me&apos;yoriy arizasi</h2>
                                            <p className={`text-xs ${ui.muted}`}>Ariza va Tilxat blanklarida ko&apos;rsatiladigan rasmiy TTJ nomi va raqami</p>
                                        </div>
                                    </div>
                                    <div className="p-5 sm:p-7 space-y-6">
                                        {!settings.ttjName.trim() && (
                                            <div className={`flex items-start gap-3 rounded-2xl border p-4.5 ${isLight ? 'border-amber-200 bg-amber-50' : 'border-amber-500/25 bg-amber-500/10'}`}>
                                                <ShieldAlert size={19} className={`mt-0.5 shrink-0 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
                                                <p className={`text-xs font-medium leading-relaxed ${isLight ? 'text-amber-800' : 'text-amber-200'}`}>
                                                    TTJ nomi hali kiritilmagan — xorijlik/imtiyozli talabalarning Ariza va Tilxat hujjatlarida
                                                    &laquo;___-sonli talabalar turar joyi&raquo; o&apos;rni bo&apos;sh chiqadi. Pastdan rasmiy raqamini kiritib saqlang.
                                                </p>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                            <div>
                                                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${ui.strong}`}>
                                                    TTJ nomi yoki tartib raqami
                                                </label>
                                                <p className={`text-xs leading-relaxed mb-3 ${ui.muted}`}>
                                                    Talabalar turar joyining rasmiy raqami — rasmiy blanklarda &laquo;...-sonli talabalar turar joyi&raquo; o&apos;rniga qo&apos;yiladi
                                                </p>
                                                <input
                                                    type="text"
                                                    value={settings.ttjName}
                                                    onChange={(e) => handleChange('ttjName', e.target.value)}
                                                    placeholder="Masalan: 14 yoki 4-bino"
                                                    maxLength={60}
                                                    className={`${inputCls} w-full font-bold text-base`}
                                                />
                                            </div>

                                            {/* Live Document Preview Badge */}
                                            <div className={`rounded-2xl border p-4.5 space-y-2 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700'}`}>
                                                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                                                    <FileText size={14} />
                                                    <span>Hujjatda ko‘rinish namunasi:</span>
                                                </div>
                                                <div className={`p-3.5 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-serif text-xs leading-relaxed ${ui.strong}`}>
                                                    <div className="text-center font-bold pb-2 border-b border-dashed border-slate-200 dark:border-slate-800">
                                                        ARIZA VA TILXAT
                                                    </div>
                                                    <p className="mt-2 text-justify">
                                                        «...universiteti tasarrufidagi{' '}
                                                        <span className="font-bold underline text-indigo-600 dark:text-indigo-400">
                                                            {settings.ttjName.trim() ? `${settings.ttjName}-sonli` : '[ ___ ]-sonli'}
                                                        </span>{' '}
                                                        talabalar turar joyiga joylashtirishingizni so‘rayman...»
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Propiska & Regional Supervision Section */}
                                <div className={`rounded-3xl border overflow-hidden ${ui.card}`}>
                                    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b p-5 sm:px-6 ${ui.border}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${ui.accentTile}`}>
                                                <MapPinned size={19} strokeWidth={2.2} />
                                            </div>
                                            <div>
                                                <h2 className={`text-base font-bold ${ui.strong}`}>Boshqa viloyat talabalari — Propiska nazorati</h2>
                                                <p className={`text-xs ${ui.muted}`}>
                                                    Mahalliy deb belgilanmagan viloyat talabalari uchun vaqtinchalik ro‘yxat muddati nazorati
                                                </p>
                                            </div>
                                        </div>

                                        {/* Quick selection helpers */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={selectTashkentOnly}
                                                className={`no-shelf text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                                                    isLight ? 'border-slate-300 hover:bg-slate-100 text-slate-700' : 'border-slate-700 hover:bg-slate-800 text-slate-300'
                                                }`}
                                                style={{ boxShadow: 'none' }}
                                            >
                                                Faqat Toshkent
                                            </button>
                                            <button
                                                type="button"
                                                onClick={selectAllRegions}
                                                className={`no-shelf text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                                                    isLight ? 'border-slate-300 hover:bg-slate-100 text-slate-700' : 'border-slate-700 hover:bg-slate-800 text-slate-300'
                                                }`}
                                                style={{ boxShadow: 'none' }}
                                            >
                                                Barchasini tanlash
                                            </button>
                                            <button
                                                type="button"
                                                onClick={clearAllRegions}
                                                className={`no-shelf text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                                                    isLight ? 'border-slate-300 hover:bg-slate-100 text-slate-700' : 'border-slate-700 hover:bg-slate-800 text-slate-300'
                                                }`}
                                                style={{ boxShadow: 'none' }}
                                            >
                                                Tozalash
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-5 sm:p-7 space-y-5">
                                        <p className={`text-xs leading-relaxed ${ui.muted}`}>
                                            O&apos;zbekiston fuqarosi bo&apos;lgan, lekin ro&apos;yxatga olingan doimiy viloyati pastda belgilanmagan
                                            talabaga &laquo;Hujjatlarim&raquo; bo&apos;limida propiska (vaqtinchalik ro&apos;yxatga qo&apos;yish)
                                            muddati nazorati va eslatmalari avtomatik ishga tushadi. Belgilangan viloyatlar &laquo;mahalliy&raquo;
                                            hisoblanadi va bu talab ulardan so&apos;ralmaydi.
                                        </p>

                                        {settings.homeRegions.length === 0 && (
                                            <div className={`flex items-start gap-3 rounded-2xl border p-4.5 ${isLight ? 'border-amber-200 bg-amber-50' : 'border-amber-500/25 bg-amber-500/10'}`}>
                                                <ShieldAlert size={19} className={`mt-0.5 shrink-0 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
                                                <p className={`text-xs font-medium leading-relaxed ${isLight ? 'text-amber-800' : 'text-amber-200'}`}>
                                                    Hech qaysi viloyat &laquo;mahalliy&raquo; deb belgilanmagan — shu sabab bu kengaytma hozircha
                                                    barcha talabalar uchun o&apos;chiq. Yotoqxona joylashgan viloyat(lar)ni belgilang.
                                                </p>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-2.5 pt-2">
                                            {UZ_REGION_NAMES.map((region) => {
                                                const active = settings.homeRegions.includes(region)
                                                return (
                                                    <button
                                                        key={region}
                                                        type="button"
                                                        onClick={() => toggleHomeRegion(region)}
                                                        className={`no-shelf rounded-2xl border px-4 py-2.5 text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-2 ${
                                                            active
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/30'
                                                                : isLight
                                                                ? 'bg-slate-50 hover:bg-slate-100 border-slate-200/90 text-slate-700'
                                                                : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
                                                        }`}
                                                        style={{
                                                            boxShadow: active ? '0 1px 3px rgba(79, 70, 229, 0.3)' : 'none',
                                                        }}
                                                    >
                                                        <div className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 ${active ? 'bg-white text-indigo-600' : 'border border-slate-400/60'}`}>
                                                            {active && <Check size={11} strokeWidth={3} />}
                                                        </div>
                                                        <span>{region}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        <div className="pt-2">
                                            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                                                <span className={ui.muted}>Mahalliy deb belgilangan hududlar qamrovi:</span>
                                                <span className={ui.strong}>{settings.homeRegions.length} / {UZ_REGION_NAMES.length} viloyat</span>
                                            </div>
                                            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all duration-300"
                                                    style={{ width: `${(settings.homeRegions.length / UZ_REGION_NAMES.length) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ========================================================= */}
                        {/* 4. TELEGRAM & ALOQA TABI */}
                        {/* ========================================================= */}
                        {activeMainTab === 'contacts' && (
                            <motion.div
                                key="tab-contacts"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.16 }}
                                className="space-y-6"
                            >
                                {/* Telegram Notifications Section */}
                                <div className={`rounded-3xl border overflow-hidden ${ui.card}`}>
                                    <div className={`flex items-center gap-3 border-b p-5 sm:px-6 ${ui.border}`}>
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${ui.accentTile}`}>
                                            <Send size={19} strokeWidth={2.2} />
                                        </div>
                                        <div>
                                            <h2 className={`text-base font-bold ${ui.strong}`}>Yangi arizalar — Telegram bildirishnomasi</h2>
                                            <p className={`text-xs ${ui.muted}`}>Talabalar yo‘llanma va arizalar yuborganda bot orqali darhol xabar olish</p>
                                        </div>
                                    </div>
                                    <div className="p-5 sm:p-7 space-y-6">
                                        {/* Status banner */}
                                        <div className={`flex items-center justify-between p-4 rounded-2xl border ${
                                            savedTelegramChat
                                                ? isLight ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                                                : isLight ? 'bg-amber-50/80 border-amber-200 text-amber-900' : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                                        }`}>
                                            <div className="flex items-center gap-3">
                                                {savedTelegramChat ? (
                                                    <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                                                ) : (
                                                    <ShieldAlert size={20} className="text-amber-500 shrink-0" />
                                                )}
                                                <div>
                                                    <div className="text-xs font-black">
                                                        {savedTelegramChat ? 'Telegram bildirishnomasi faol ulangan' : 'Telegram bildirishnomasi hali ulanmagan'}
                                                    </div>
                                                    <div className="text-[11px] opacity-80 mt-0.5">
                                                        {savedTelegramChat
                                                            ? `Arizalar ${savedTelegramChat} chat ID manziliga yuboriladi`
                                                            : "Talabalar yangi ariza berganda xabardor bo'lish uchun botni ulang"}
                                                    </div>
                                                </div>
                                            </div>
                                            {savedTelegramChat && (
                                                <code className="px-2.5 py-1 rounded-lg bg-emerald-500/15 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                                    ID: {savedTelegramChat}
                                                </code>
                                            )}
                                        </div>

                                        {/* Step by step connection cards */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className={`p-4.5 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700'}`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-xs">
                                                            1
                                                        </span>
                                                        <h4 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
                                                            Shaxsiy chatga olish
                                                        </h4>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={copyBot}
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline"
                                                    >
                                                        {copiedBot ? <Check size={12} /> : <Copy size={12} />}
                                                        <span>{copiedBot ? 'Nusxalandi' : 'Botni nusxalash'}</span>
                                                    </button>
                                                </div>
                                                <p className={`text-xs leading-relaxed ${ui.muted}`}>
                                                    Telegramda <b className={ui.strong}>@MeningYotoqxonamBot</b> ga kiring, <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[10px]">/start</kbd> bosing va bot bergan raqamli Chat ID ni pastga yozing.
                                                </p>
                                            </div>

                                            <div className={`p-4.5 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700'}`}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-600 text-white font-black text-xs">
                                                        2
                                                    </span>
                                                    <h4 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
                                                        Fakultet guruhiga olish
                                                    </h4>
                                                </div>
                                                <p className={`text-xs leading-relaxed ${ui.muted}`}>
                                                    Telegram guruh ochib botni admin qilib qo‘shing. Guruh ID raqamini (masalan: <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[10px]">-1001234567890</code>) pastga yozing.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Telegram Chat ID Input with inline save */}
                                        <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-2">
                                            <div className="flex-1 min-w-0">
                                                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${ui.strong}`}>
                                                    Telegram Chat ID (shaxsiy yoki guruh)
                                                </label>
                                                <div className="relative">
                                                    <Send size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        value={telegramChat}
                                                        onChange={(e) => setTelegramChat(e.target.value)}
                                                        placeholder="Masalan: 123456789 yoki -1001234567890"
                                                        maxLength={40}
                                                        className={`${inputCls} w-full font-mono text-sm pl-10`}
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSaveTelegram}
                                                disabled={telegramSaving || telegramChat.trim() === savedTelegramChat.trim()}
                                                className={`no-shelf shrink-0 rounded-xl px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${ui.accentSolid}`}
                                                style={{ boxShadow: '0 2px 8px rgba(79, 70, 229, 0.35)' }}
                                            >
                                                {telegramSaving ? 'Saqlanmoqda...' : 'Telegram ID saqlash'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Emergency & Staff Contacts Section */}
                                <div className={`rounded-3xl border overflow-hidden ${ui.card}`}>
                                    <div className={`flex items-center gap-3 border-b p-5 sm:px-6 ${ui.border}`}>
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${ui.accentTile}`}>
                                            <Phone size={19} strokeWidth={2.2} />
                                        </div>
                                        <div>
                                            <h2 className={`text-base font-bold ${ui.strong}`}>Aloqa va favqulodda xizmatlar telefonlari</h2>
                                            <p className={`text-xs ${ui.muted}`}>Talabalar mobil ilovasida favqulodda vaziyatlar uchun ko‘rsatiladigan rasmiy kontaktlar</p>
                                        </div>
                                    </div>
                                    <div className="p-5 sm:p-7 space-y-6">
                                        <div className={`rounded-2xl border p-4 text-xs leading-relaxed ${isLight ? 'border-indigo-200 bg-indigo-50/70 text-indigo-900' : 'border-indigo-500/25 bg-indigo-500/10 text-indigo-200'}`}>
                                            <span className="font-black">Talaba kengashi raisi</span> ma&apos;lumotlari alohida tizim rolida boshqariladi. Talabalar sahifasida kerakli talabani tanlab, kontekst menyudan &laquo;Kengash raisi tayinlash&raquo; tugmasini bosing.
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            {emergencyContactsList.map((contact) => {
                                                const Icon = contact.icon
                                                const phoneVal = String(settings[contact.phoneKey] || '')
                                                return (
                                                    <div
                                                        key={contact.title}
                                                        className={`p-5 rounded-2xl border transition-all ${
                                                            isLight ? 'bg-slate-50/60 border-slate-200 hover:border-slate-300' : 'bg-slate-800/30 border-slate-700/80 hover:border-slate-700'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${contact.color} text-white shadow-md`}>
                                                                <Icon size={18} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <h3 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
                                                                    {contact.title}
                                                                </h3>
                                                                <p className={`text-[11px] truncate mt-0.5 ${ui.muted}`}>
                                                                    {contact.desc}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-3 pt-2">
                                                            {contact.hasName && (
                                                                <div>
                                                                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${ui.muted}`}>
                                                                        Mas&apos;ul shaxs F.I.SH.
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        value={String(settings[contact.nameKey])}
                                                                        onChange={(e) =>
                                                                            handleChange(
                                                                                contact.nameKey,
                                                                                e.target.value as AppSettings[typeof contact.nameKey],
                                                                            )
                                                                        }
                                                                        placeholder={contact.placeholderName}
                                                                        className={`${inputCls} w-full text-xs font-semibold`}
                                                                    />
                                                                </div>
                                                            )}
                                                            <div>
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <label className={`block text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>
                                                                        Aloqa telefoni
                                                                    </label>
                                                                    {phoneVal && (
                                                                        <a
                                                                            href={`tel:${phoneVal.replace(/[^\d+]/g, '')}`}
                                                                            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:underline"
                                                                        >
                                                                            <PhoneCall size={10} />
                                                                            <span>Sinab ko‘rish</span>
                                                                        </a>
                                                                    )}
                                                                </div>
                                                                <input
                                                                    type="tel"
                                                                    value={phoneVal}
                                                                    onChange={(e) =>
                                                                        handleChange(
                                                                            contact.phoneKey,
                                                                            e.target.value as AppSettings[typeof contact.phoneKey],
                                                                        )
                                                                    }
                                                                    placeholder="+998 90 123 45 67"
                                                                    className={`${inputCls} w-full font-mono text-xs`}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ========================================================= */}
                        {/* 5. VAKOLATLAR & XAVFSIZLIK TABI */}
                        {/* ========================================================= */}
                        {activeMainTab === 'security' && (
                            <motion.div
                                key="tab-security"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.16 }}
                                className="space-y-6"
                            >
                                {/* Digital Dean Signature Card */}
                                <DekanSignatureCard isLight={isLight} delay={0.03} />

                                {/* Staff Permissions Management Card */}
                                <MemberPermissionsCard delay={0.05} />

                                {/* System Limits & Warnings Threshold Section */}
                                <div className={`rounded-3xl border overflow-hidden ${ui.card}`}>
                                    <div className={`flex items-center gap-3 border-b p-5 sm:px-6 ${ui.border}`}>
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${ui.accentTile}`}>
                                            <ShieldAlert size={19} strokeWidth={2.2} />
                                        </div>
                                        <div>
                                            <h2 className={`text-base font-bold ${ui.strong}`}>Fayl yuklash va talabalar intizomi chegaralari</h2>
                                            <p className={`text-xs ${ui.muted}`}>Xavfsizlik choralari va avtomatik nazorat qoidalari</p>
                                        </div>
                                    </div>
                                    <div className="p-5 sm:p-7 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            {/* Max upload size */}
                                            <div className={`p-5 rounded-2xl border ${isLight ? 'bg-slate-50/60 border-slate-200' : 'bg-slate-800/30 border-slate-700/80'}`}>
                                                <div className="flex items-start justify-between gap-3 mb-3">
                                                    <div>
                                                        <h3 className={`text-sm font-bold ${ui.strong}`}>Maksimal fayl hajmi chegarasi</h3>
                                                        <p className={`text-xs mt-1 leading-relaxed ${ui.muted}`}>
                                                            Talaba profil rasmini va arizalarga ilova yuklashda ruxsat etilgan maksimal hajm
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 mt-4">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={100}
                                                        value={settings.maxUploadSizeMb}
                                                        onChange={(e) => handleChange('maxUploadSizeMb', Math.max(1, Number(e.target.value)))}
                                                        className={`${inputCls} w-28 font-bold text-base`}
                                                    />
                                                    <span className={`text-xs font-black px-3 py-2 rounded-xl ${isLight ? 'bg-slate-200 text-slate-800' : 'bg-slate-800 text-slate-200'}`}>
                                                        Megabayt (MB)
                                                    </span>
                                                    <span className="text-xs text-slate-400">Tavsiya: 10 - 25 MB</span>
                                                </div>
                                            </div>

                                            {/* Warning threshold */}
                                            <div className={`p-5 rounded-2xl border ${isLight ? 'bg-slate-50/60 border-slate-200' : 'bg-slate-800/30 border-slate-700/80'}`}>
                                                <div className="flex items-start justify-between gap-3 mb-3">
                                                    <div>
                                                        <h3 className={`text-sm font-bold ${ui.strong}`}>Ogohlantirish chegarasi</h3>
                                                        <p className={`text-xs mt-1 leading-relaxed ${ui.muted}`}>
                                                            Talabalar ro‘yxatida shu sondan ko‘p ogohlantirilgan talaba avtomatik xavfli deb belgilanadi
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 mt-4">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={10}
                                                        value={settings.warningThreshold}
                                                        onChange={(e) => handleChange('warningThreshold', Math.max(1, Number(e.target.value)))}
                                                        className={`${inputCls} w-28 font-bold text-base`}
                                                    />
                                                    <span className={`text-xs font-black px-3 py-2 rounded-xl ${isLight ? 'bg-slate-200 text-slate-800' : 'bg-slate-800 text-slate-200'}`}>
                                                        ta ogohlantirish
                                                    </span>
                                                    <span className="text-xs text-slate-400">Standart: 3 ta</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* 4. Bottom Save / Cancel Action Bar */}
                    <div className="pt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-4 sm:justify-between border-t border-slate-200/80 dark:border-slate-800">
                        <div className="flex items-center gap-2.5">
                            {isDirty ? (
                                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-bold">
                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping" />
                                    <span>Tizim parametrlarida saqlanmagan o‘zgarishlar mavjud ({dirtyTabNames.join(', ')})</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                    <span>Barcha parametrlar server bilan sinxron holatda</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleCancel}
                                disabled={!isDirty || saving}
                                className={`no-shelf w-full sm:w-auto rounded-xl border px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${ui.btnGhost}`}
                                style={{ boxShadow: 'none' }}
                            >
                                Bekor qilish
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleSave()}
                                disabled={!isDirty || saving}
                                className={`no-shelf w-full sm:w-auto rounded-xl px-7 py-2.5 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 ${ui.accentSolid}`}
                                style={{ boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)' }}
                            >
                                {saving ? (
                                    <>
                                        <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Saqlanmoqda...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={15} />
                                        <span>Sozlamalarni saqlash (Ctrl+S)</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* 5. Floating Sticky Save Bar (appears when changes are unsaved) */}
                    <AnimatePresence>
                        {isDirty && (
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 30 }}
                                transition={{ duration: 0.2 }}
                                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[92%] sm:w-auto"
                            >
                                {/* The global light-mode retrofit repaints dark `bg-slate-900` panels white
                                    but leaves pale text pale, so each theme gets its own explicit colours. */}
                                <div className={`flex items-center justify-between gap-5 px-5 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl ${
                                    isLight
                                        ? 'bg-white border-slate-200 shadow-slate-400/30'
                                        : 'bg-slate-900/95 border-slate-700 text-white shadow-black/80'
                                }`}>
                                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                                        <div className="text-xs">
                                            <span className={`font-extrabold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>Saqlanmagan o‘zgarish:</span>{' '}
                                            <span className={`font-semibold ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>{dirtyTabNames.join(', ')}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={handleCancel}
                                            disabled={saving}
                                            className={`no-shelf px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                                isLight
                                                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                                            }`}
                                            style={{ boxShadow: 'none' }}
                                        >
                                            Bekor qilish
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleSave()}
                                            disabled={saving}
                                            className="no-shelf px-4 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-indigo-500 hover:bg-indigo-600 text-white transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                                            style={{ boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)' }}
                                        >
                                            {saving ? (
                                                <>
                                                    <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    <span>Saqlanmoqda...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Save size={13} />
                                                    <span>Saqlash (Ctrl+S)</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </div>
    )
}
