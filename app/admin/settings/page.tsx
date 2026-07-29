'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Settings as SettingsIcon, Wallet, Boxes, Phone, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { fetchAppSettings, updateAppSettings } from '@/features/app-settings/client/api'
import type { AppSettings } from '@/features/app-settings/types'

type NumberField = {
    key: 'monthlyFee' | 'yearlyContractFee' | 'defaultRoomCapacity' | 'floorCount' | 'maxUploadSizeMb' | 'warningThreshold'
    label: string
    description: string
    suffix: string
}

export default function AdminSettingsPage() {
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'

    const surfaceBg = isLight ? 'bg-white/80 border-slate-200 shadow-md' : 'bg-[#0b1120]/50 border-white/10 shadow-[0_0_20px_rgba(168,85,247,0.05)]'
    const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'
    const textStrong = isLight ? 'text-slate-900' : 'text-white'
    const inputBg = isLight ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-purple-500/50' : 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-purple-500/50'
    const borderCol = isLight ? 'border-slate-200' : 'border-white/10'

    const [settings, setSettings] = useState<AppSettings | null>(null)
    const [savedSettings, setSavedSettings] = useState<AppSettings | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

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
        { key: 'defaultRoomCapacity', label: 'Xonaning standart sig\'imi', description: '3D xonalar bo\'limida yangi xonalar uchun standart qiymat', suffix: 'kishi' },
        { key: 'floorCount', label: 'Qavatlar soni', description: 'Yotoqxonadagi umumiy qavatlar soni', suffix: 'qavat' },
    ]

    const limitFields: NumberField[] = [
        { key: 'maxUploadSizeMb', label: 'Fayl yuklash hajmi chegarasi', description: 'Talaba profil rasmini yuklashda ruxsat etilgan maksimal fayl hajmi', suffix: 'MB' },
        { key: 'warningThreshold', label: 'Ogohlantirish chegarasi', description: 'Talabalar ro\'yxatida shu sondan ko\'p ogohlantirilgan talaba xavfli (qizil) deb belgilanadi', suffix: 'ta' },
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className={`flex items-center gap-3 text-3xl font-black tracking-tighter sm:text-4xl ${textStrong}`}>
                        <div className="rounded-2xl bg-purple-500/10 p-2 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                            <SettingsIcon size={30} />
                        </div>
                        Tizim sozlamalari
                    </h1>
                    <p className={`mt-2 text-sm ${textMuted}`}>To&apos;lov, xona va aloqa ma&apos;lumotlarini shu yerdan boshqaring</p>
                </div>
            </div>

            {loading ? (
                <div className={`flex items-center justify-center rounded-2xl border p-16 ${surfaceBg}`}>
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                </div>
            ) : loadError || !settings ? (
                <div className={`rounded-2xl border p-8 text-center ${surfaceBg}`}>
                    <ShieldAlert className="mx-auto h-10 w-10 text-rose-500" />
                    <h2 className={`mt-4 text-lg font-black ${textStrong}`}>Sozlamalar ochilmadi</h2>
                    <p className={`mx-auto mt-2 max-w-xl text-sm ${textMuted}`}>
                        {loadError ?? "Sozlamalarni yuklab bo'lmadi"}. Xavfsizlik uchun standart qiymatlar bilan tahrirlash bloklandi.
                    </p>
                    <button
                        type="button"
                        onClick={() => void loadSettings()}
                        className="mt-5 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-purple-700"
                    >
                        Qayta urinish
                    </button>
                </div>
            ) : (
                <>
                    {/* Settings Sections */}
                    <div className="space-y-6">
                        {/* Payment settings */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`backdrop-blur-xl border rounded-2xl overflow-hidden ${surfaceBg}`}
                        >
                            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 sm:p-6 flex items-center gap-3 shadow-md">
                                <Wallet size={24} className="text-white shrink-0" />
                                <h2 className="text-lg font-black text-white">To&apos;lov Sozlamalari</h2>
                            </div>
                            <div className="p-4 sm:p-6 space-y-6">
                                {paymentFields.map((field) => (
                                    <div
                                        key={field.key}
                                        className={`flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-6 border-b border-white/5 last:pb-0 last:border-b-0 ${borderCol}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <h3 className={`font-semibold ${textStrong}`}>{field.label}</h3>
                                            <p className={`text-xs mt-1 ${textMuted}`}>{field.description}</p>
                                        </div>
                                        <div className="sm:ml-4 shrink-0 flex items-center gap-2 w-full sm:w-auto">
                                            <input
                                                type="number"
                                                min={1}
                                                value={settings[field.key]}
                                                onChange={(e) => handleChange(field.key, Math.max(1, Number(e.target.value)) as AppSettings[typeof field.key])}
                                                className={`w-full sm:w-36 px-3 py-2 rounded-xl border text-sm outline-none transition-all ${inputBg}`}
                                            />
                                            <span className={`text-xs font-bold shrink-0 ${textMuted}`}>{field.suffix}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Room / floor settings */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 }}
                            className={`backdrop-blur-xl border rounded-2xl overflow-hidden ${surfaceBg}`}
                        >
                            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 sm:p-6 flex items-center gap-3 shadow-md">
                                <Boxes size={24} className="text-white shrink-0" />
                                <h2 className="text-lg font-black text-white">Xona va Qavat Sozlamalari</h2>
                            </div>
                            <div className="p-4 sm:p-6 space-y-6">
                                {roomFields.map((field) => (
                                    <div
                                        key={field.key}
                                        className={`flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-6 border-b border-white/5 last:pb-0 last:border-b-0 ${borderCol}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <h3 className={`font-semibold ${textStrong}`}>{field.label}</h3>
                                            <p className={`text-xs mt-1 ${textMuted}`}>{field.description}</p>
                                        </div>
                                        <div className="sm:ml-4 shrink-0 flex items-center gap-2 w-full sm:w-auto">
                                            <input
                                                type="number"
                                                min={1}
                                                value={settings[field.key]}
                                                onChange={(e) => handleChange(field.key, Math.max(1, Number(e.target.value)) as AppSettings[typeof field.key])}
                                                className={`w-full sm:w-24 px-3 py-2 rounded-xl border text-sm outline-none transition-all ${inputBg}`}
                                            />
                                            <span className={`text-xs font-bold shrink-0 ${textMuted}`}>{field.suffix}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Limits */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.08 }}
                            className={`backdrop-blur-xl border rounded-2xl overflow-hidden ${surfaceBg}`}
                        >
                            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-4 sm:p-6 flex items-center gap-3 shadow-md">
                                <ShieldAlert size={24} className="text-white shrink-0" />
                                <h2 className="text-lg font-black text-white">Fayl va Ogohlantirish Chegaralari</h2>
                            </div>
                            <div className="p-4 sm:p-6 space-y-6">
                                {limitFields.map((field) => (
                                    <div
                                        key={field.key}
                                        className={`flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-6 border-b border-white/5 last:pb-0 last:border-b-0 ${borderCol}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <h3 className={`font-semibold ${textStrong}`}>{field.label}</h3>
                                            <p className={`text-xs mt-1 ${textMuted}`}>{field.description}</p>
                                        </div>
                                        <div className="sm:ml-4 shrink-0 flex items-center gap-2 w-full sm:w-auto">
                                            <input
                                                type="number"
                                                min={1}
                                                value={settings[field.key]}
                                                onChange={(e) => handleChange(field.key, Math.max(1, Number(e.target.value)) as AppSettings[typeof field.key])}
                                                className={`w-full sm:w-24 px-3 py-2 rounded-xl border text-sm outline-none transition-all ${inputBg}`}
                                            />
                                            <span className={`text-xs font-bold shrink-0 ${textMuted}`}>{field.suffix}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Contacts */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className={`backdrop-blur-xl border rounded-2xl overflow-hidden ${surfaceBg}`}
                        >
                            <div className="bg-gradient-to-r from-rose-500 to-pink-600 p-4 sm:p-6 flex items-center gap-3 shadow-md">
                                <Phone size={24} className="text-white shrink-0" />
                                <h2 className="text-lg font-black text-white">Aloqa va Favqulodda Xizmatlar</h2>
                            </div>
                            <div className="p-4 sm:p-6 space-y-6">
                                {contacts.map((contact) => (
                                    <div
                                        key={contact.title}
                                        className={`pb-6 border-b border-white/5 last:pb-0 last:border-b-0 ${borderCol}`}
                                    >
                                        <h3 className={`font-semibold mb-3 ${textStrong}`}>{contact.title}</h3>
                                        <div className={`grid gap-3 ${contact.hasName ? 'sm:grid-cols-2' : ''}`}>
                                            {contact.hasName && (
                                                <div>
                                                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${textMuted}`}>Ism</label>
                                                    <input
                                                        type="text"
                                                        value={String(settings[contact.nameKey])}
                                                        onChange={(e) => handleChange(contact.nameKey, e.target.value as AppSettings[typeof contact.nameKey])}
                                                        placeholder="Ism familiya"
                                                        className={`w-full px-3 py-2 rounded-xl border text-sm outline-none transition-all ${inputBg}`}
                                                    />
                                                </div>
                                            )}
                                            <div>
                                                <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${textMuted}`}>Telefon</label>
                                                <input
                                                    type="tel"
                                                    value={String(settings[contact.phoneKey])}
                                                    onChange={(e) => handleChange(contact.phoneKey, e.target.value as AppSettings[typeof contact.phoneKey])}
                                                    placeholder="+998 __ ___-__-__"
                                                    className={`w-full px-3 py-2 rounded-xl border text-sm outline-none transition-all ${inputBg}`}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    {/* Save Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="mt-8 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 sm:justify-end"
                    >
                        <button
                            onClick={handleCancel}
                            disabled={!isDirty || saving}
                            className={`w-full sm:w-auto px-6 py-3 rounded-xl border font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                        >
                            Bekor qilish
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!isDirty || saving}
                            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-linear-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50 active:scale-95 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Saqlanmoqda...' : 'Sozlamalarni Saqlash'}
                        </button>
                    </motion.div>
                </>
            )}
        </div>
    )
}
