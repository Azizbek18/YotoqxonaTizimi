'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Wallet, Boxes, Phone, ShieldAlert, Globe2, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRoomFloors } from '@/lib/hooks/useRoomFloors'
import { useThemeStore } from '@/lib/stores/theme-store'
import {
    fetchAppSettings,
    updateAppSettings,
    fetchDekanTelegramChat,
    updateDekanTelegramChat,
} from '@/features/app-settings/client/api'
import type { AppSettings } from '@/features/app-settings/types'
import { fetchDekanDorm } from '@/features/dorms/client/api'
import type { DekanDorm } from '@/features/dorms/types'
import DormFloorsCard from '@/components/dekan/DormFloorsCard'
import FloorManagerCard from '@/components/dekan/FloorManagerCard'
import { dekanUI } from '@/lib/dekan-ui'

type NumberField = {
    key: 'monthlyFee' | 'yearlyContractFee' | 'defaultRoomCapacity' | 'floorCount' | 'maxUploadSizeMb' | 'warningThreshold'
    label: string
    description: string
    suffix: string
}

export default function DekanSozlamalarPage() {
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'
    const ui = dekanUI(isLight)

    const { rooms: layoutRooms, loaded: layoutLoaded, reload: reloadRoomFloors } = useRoomFloors()

    const [settings, setSettings] = useState<AppSettings | null>(null)
    const [savedSettings, setSavedSettings] = useState<AppSettings | null>(null)
    const [dorm, setDorm] = useState<DekanDorm | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    const [telegramChat, setTelegramChat] = useState('')
    const [savedTelegramChat, setSavedTelegramChat] = useState('')
    const [telegramSaving, setTelegramSaving] = useState(false)

    const loadSettings = useCallback(async () => {
        setLoading(true)
        setLoadError(null)
        try {
            const data = await fetchAppSettings()
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
            .then(({ dorm }) => setDorm(dorm))
            .catch(() => setDorm(null))
    }, [])

    useEffect(() => {
        fetchDekanTelegramChat()
            .then((chatId) => { setTelegramChat(chatId); setSavedTelegramChat(chatId) })
            .catch(() => { setTelegramChat(''); setSavedTelegramChat('') })
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
        setSettings((prev) => prev ? { ...prev, [key]: value } : prev)
    }

    const handleCancel = () => {
        if (savedSettings) setSettings(savedSettings)
    }

    const handleSave = async () => {
        if (!settings) return
        try {
            setSaving(true)
            const updated = await updateAppSettings(settings)
            setSettings(updated)
            setSavedSettings(updated)
            toast.success('Sozlamalar saqlandi!')
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Saqlanishda xato!'
            toast.error(message)
        } finally {
            setSaving(false)
        }
    }

    const paymentFields: NumberField[] = [
        { key: 'monthlyFee', label: 'Oylik to\'lov summasi', description: 'Talabalar har oy to\'lashi kerak bo\'lgan summa', suffix: "so'm" },
        { key: 'yearlyContractFee', label: 'Yillik shartnoma summasi', description: 'To\'lovlar sahifasida umumiy shartnoma miqdori sifatida ko\'rsatiladi', suffix: "so'm" },
    ]

    const roomFields: NumberField[] = [
        { key: 'defaultRoomCapacity', label: 'Xonaning standart sig\'imi', description: 'Istisno belgilanmagan barcha xonalar shu qiymatni oladi. 2/3 o\'rinli istisno xonalarni «3D Xonalar» yoki «Xonalar xaritasi»da alohida belgilaysiz.', suffix: 'kishi' },
    ]

    const limitFields: NumberField[] = [
        { key: 'maxUploadSizeMb', label: 'Fayl yuklash hajmi chegarasi', description: 'Talaba profil rasmini yuklashda ruxsat etilgan maksimal fayl hajmi', suffix: 'MB' },
        { key: 'warningThreshold', label: 'Ogohlantirish chegarasi', description: 'Talabalar ro\'yxatida shu sondan ko\'p ogohlantirilgan talaba xavfli deb belgilanadi', suffix: 'ta' },
    ]

    const contacts: Array<{ title: string; nameKey: keyof AppSettings; phoneKey: keyof AppSettings; hasName: boolean }> = [
        { title: 'Tarbiyachi (Navbatchi)', nameKey: 'tarbiyachiName', phoneKey: 'tarbiyachiPhone', hasName: true },
        { title: 'Komendant', nameKey: 'komendantName', phoneKey: 'komendantPhone', hasName: true },
        { title: 'Tibbiy yordam xonasi (Shifokor)', nameKey: 'doctorName', phoneKey: 'doctorPhone', hasName: true },
        { title: 'Talaba kengashi raisi (o\'g\'il)', nameKey: 'talabaKengashiRaisiOgilName', phoneKey: 'talabaKengashiRaisiOgilPhone', hasName: true },
        { title: 'Talaba kengashi raisi (qiz)', nameKey: 'talabaKengashiRaisiQizName', phoneKey: 'talabaKengashiRaisiQizPhone', hasName: true },
        { title: 'Xavfsizlik bo\'limi', nameKey: 'securityPhone', phoneKey: 'securityPhone', hasName: false },
    ]

    const isDirty = settings !== null && savedSettings !== null
        && JSON.stringify(settings) !== JSON.stringify(savedSettings)

    const inputCls = `rounded-lg border text-sm px-3 py-2 transition-colors ${ui.input} ${ui.ring}`

    const renderSection = (Icon: typeof Wallet, title: string, delay: number, children: React.ReactNode) => (
        <motion.section
            key={title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className={`rounded-2xl border overflow-hidden ${ui.card}`}
        >
            <div className={`flex items-center gap-3 border-b p-4 sm:px-6 ${ui.border}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${ui.accentTile}`}>
                    <Icon size={18} strokeWidth={2.2} />
                </div>
                <h2 className={`text-sm font-bold ${ui.strong}`}>{title}</h2>
            </div>
            <div className="p-4 sm:p-6 space-y-5">{children}</div>
        </motion.section>
    )

    const renderNumberRow = (field: NumberField, width: string) => (
        <div key={field.key} className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-5 border-b last:pb-0 last:border-b-0 ${ui.border}`}>
            <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-semibold ${ui.strong}`}>{field.label}</h3>
                <p className={`text-xs mt-1 ${ui.muted}`}>{field.description}</p>
            </div>
            <div className="sm:ml-4 shrink-0 flex items-center gap-2 w-full sm:w-auto">
                <input
                    type="number"
                    min={1}
                    value={settings![field.key]}
                    onChange={(e) => handleChange(field.key, Math.max(1, Number(e.target.value)) as AppSettings[typeof field.key])}
                    className={`${inputCls} w-full ${width}`}
                />
                <span className={`text-xs font-semibold shrink-0 ${ui.muted}`}>{field.suffix}</span>
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            <div>
                <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${ui.strong}`}>Tizim sozlamalari</h1>
                <p className={`mt-1 text-xs sm:text-sm ${ui.muted}`}>To&apos;lov, xona va aloqa ma&apos;lumotlarini shu yerdan boshqaring</p>
            </div>

            {loading ? (
                <div className={`flex items-center justify-center rounded-2xl border p-16 ${ui.card}`}>
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700" />
                </div>
            ) : loadError || !settings ? (
                <div className={`rounded-2xl border p-8 text-center ${ui.card}`}>
                    <ShieldAlert className={`mx-auto h-10 w-10 ${isLight ? 'text-rose-500' : 'text-rose-400'}`} />
                    <h2 className={`mt-4 text-lg font-bold ${ui.strong}`}>Sozlamalar ochilmadi</h2>
                    <p className={`mx-auto mt-2 max-w-xl text-sm ${ui.muted}`}>
                        {loadError ?? "Sozlamalarni yuklab bo'lmadi"}. Xavfsizlik uchun standart qiymatlar bilan tahrirlash bloklandi.
                    </p>
                    <button
                        type="button"
                        onClick={() => void loadSettings()}
                        className={`mt-5 rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${ui.accentSolid}`}
                    >
                        Qayta urinish
                    </button>
                </div>
            ) : (
                <>
                    <div className="space-y-6">
                        {dorm && (
                            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                                <DormFloorsCard dorm={dorm} onChange={setDorm} />
                            </motion.div>
                        )}

                        {renderSection(Wallet, "To'lov sozlamalari", 0, (
                            <>{paymentFields.map((field) => renderNumberRow(field, 'sm:w-36'))}</>
                        ))}

                        {renderSection(Boxes, 'Xona va qavat sozlamalari', 0.04, (
                          <>
                            {roomFields.map((field) => renderNumberRow(field, 'sm:w-24'))}

                            <FloorManagerCard
                                floorCount={settings.floorCount}
                                defaultCapacity={settings.defaultRoomCapacity}
                                rooms={layoutRooms}
                                roomsLoaded={layoutLoaded}
                                onFloorCountSaved={(floorCount) => {
                                    setSettings((prev) => (prev ? { ...prev, floorCount } : prev))
                                    setSavedSettings((prev) => (prev ? { ...prev, floorCount } : prev))
                                }}
                                onRoomsChanged={() => { void reloadRoomFloors() }}
                            />
                          </>
                        ))}

                        {renderSection(Globe2, 'Xorijlik/imtiyozli talabalar arizasi', 0.06, (
                          <>
                            {!settings.ttjName.trim() && (
                                <div className={`flex items-start gap-3 rounded-xl border p-4 ${isLight ? 'border-amber-200 bg-amber-50' : 'border-amber-500/25 bg-amber-500/10'}`}>
                                    <ShieldAlert size={18} className={`mt-0.5 shrink-0 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
                                    <p className={`text-xs font-medium ${isLight ? 'text-amber-800' : 'text-amber-200'}`}>
                                        TTJ nomi hali kiritilmagan — xorijlik/imtiyozli talabalarning Ariza va Tilxat hujjatlarida
                                        &laquo;___-sonli talabalar turar joyi&raquo; o&apos;rni bo&apos;sh chiqadi. Pastdan kiritib saqlang.
                                    </p>
                                </div>
                            )}
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <h3 className={`text-sm font-semibold ${ui.strong}`}>TTJ nomi</h3>
                                    <p className={`text-xs mt-1 ${ui.muted}`}>
                                        Talabalar turar joyining rasmiy raqami — Ariza va Tilxat hujjatlarida
                                        &laquo;___-sonli talabalar turar joyi&raquo; o&apos;rniga qo&apos;yiladi
                                    </p>
                                </div>
                                <div className="sm:ml-4 shrink-0 w-full sm:w-auto">
                                    <input
                                        type="text"
                                        value={settings.ttjName}
                                        onChange={(e) => handleChange('ttjName', e.target.value)}
                                        placeholder="Masalan: 14"
                                        maxLength={60}
                                        className={`${inputCls} w-full sm:w-48`}
                                    />
                                </div>
                            </div>
                          </>
                        ))}

                        {renderSection(Send, 'Yangi ariza — Telegram bildirishnomasi', 0.07, (
                          <div className="space-y-4">
                            <p className={`text-xs leading-relaxed ${ui.muted}`}>
                                Talaba yangi yo&apos;llanma yoki xorijlik/imtiyozli ariza yuborganda shu Telegram
                                guruhiga darhol xabar keladi. Yoqish uchun: guruh yarating &rarr;
                                <span className={`font-semibold ${ui.strong}`}> @MeningYotoqxonamBot</span> ni guruhga
                                qo&apos;shing &rarr; guruh ID sini (masalan <code>-1001234567890</code>) pastga yozing.
                                Bo&apos;sh qoldirilsa bildirishnoma o&apos;chadi.
                            </p>
                            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                                <div className="flex-1 min-w-0">
                                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${ui.muted}`}>
                                        Guruh ID yoki @kanal
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="text"
                                        value={telegramChat}
                                        onChange={(e) => setTelegramChat(e.target.value)}
                                        placeholder="-1001234567890"
                                        maxLength={40}
                                        className={`${inputCls} w-full`}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSaveTelegram}
                                    disabled={telegramSaving || telegramChat.trim() === savedTelegramChat.trim()}
                                    className={`shrink-0 rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${ui.accentSolid}`}
                                >
                                    {telegramSaving ? 'Saqlanmoqda...' : 'Saqlash'}
                                </button>
                            </div>
                            {savedTelegramChat && (
                                <p className={`text-[11px] ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                                    ✓ Bildirishnoma yoqilgan: <span className="font-mono">{savedTelegramChat}</span>
                                </p>
                            )}
                          </div>
                        ))}

                        {renderSection(ShieldAlert, 'Fayl va ogohlantirish chegaralari', 0.08, (
                            <>{limitFields.map((field) => renderNumberRow(field, 'sm:w-24'))}</>
                        ))}

                        {renderSection(Phone, 'Aloqa va favqulodda xizmatlar', 0.1, (
                          <>
                            {contacts.map((contact) => (
                                <div key={contact.title} className={`pb-5 border-b last:pb-0 last:border-b-0 ${ui.border}`}>
                                    <h3 className={`text-sm font-semibold mb-3 ${ui.strong}`}>{contact.title}</h3>
                                    <div className={`grid gap-3 ${contact.hasName ? 'sm:grid-cols-2' : ''}`}>
                                        {contact.hasName && (
                                            <div>
                                                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${ui.muted}`}>Ism</label>
                                                <input
                                                    type="text"
                                                    value={String(settings[contact.nameKey])}
                                                    onChange={(e) => handleChange(contact.nameKey, e.target.value as AppSettings[typeof contact.nameKey])}
                                                    placeholder="Ism familiya"
                                                    className={`${inputCls} w-full`}
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${ui.muted}`}>Telefon</label>
                                            <input
                                                type="tel"
                                                value={String(settings[contact.phoneKey])}
                                                onChange={(e) => handleChange(contact.phoneKey, e.target.value as AppSettings[typeof contact.phoneKey])}
                                                placeholder="+998 __ ___-__-__"
                                                className={`${inputCls} w-full`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                          </>
                        ))}
                    </div>

                    <div className="mt-8 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 sm:justify-end">
                        <button
                            onClick={handleCancel}
                            disabled={!isDirty || saving}
                            className={`w-full sm:w-auto rounded-lg border px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${ui.btnGhost}`}
                        >
                            Bekor qilish
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!isDirty || saving}
                            className={`w-full sm:w-auto rounded-lg px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${ui.accentSolid}`}
                        >
                            {saving ? 'Saqlanmoqda...' : 'Sozlamalarni saqlash'}
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
