'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Settings as SettingsIcon, Lock, Bell, Server, Shield, Copy, KeyRound, MailPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'

type SettingsState = {
    maintenanceMode: boolean
    enableNotifications: boolean
    twoFactorAuth: boolean
    sessionTimeout: number
    ipWhitelist: string
}

type SettingConfig =
    | {
        label: string
        description: string
        type: 'toggle'
        key: keyof SettingsState
    }
    | {
        label: string
        description: string
        type: 'input'
        key: keyof SettingsState
        inputType: 'number' | 'text'
    }
    | {
        label: string
        description: string
        type: 'textarea'
        key: keyof SettingsState
    }

type AdminInvite = {
    id: string
    code: string
    email: string
    used: boolean
    created_at: string
    used_at: string | null
}

export default function AdminSettingsPage() {
    const theme = useThemeStore((state) => state.theme)
    const isLight = theme === 'light'

    const surfaceBg = isLight ? 'bg-white/80 border-slate-200 shadow-md' : 'bg-[#0b1120]/50 border-white/10 shadow-[0_0_20px_rgba(168,85,247,0.05)]'
    const cardBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
    const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'
    const textStrong = isLight ? 'text-slate-900' : 'text-white'
    const inputBg = isLight ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-purple-500/50' : 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-purple-500/50'
    const borderCol = isLight ? 'border-slate-200' : 'border-white/10'

    const [settings, setSettings] = useState<SettingsState>({
        maintenanceMode: false,
        enableNotifications: true,
        twoFactorAuth: false,
        sessionTimeout: 30,
        ipWhitelist: '',
    })

    const [saving, setSaving] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const [creatingInvite, setCreatingInvite] = useState(false)
    const [loadingInvites, setLoadingInvites] = useState(true)
    const [generatedInviteCode, setGeneratedInviteCode] = useState('')
    const [invites, setInvites] = useState<AdminInvite[]>([])

    const loadInvites = async () => {
        try {
            setLoadingInvites(true)
            const response = await fetch('/api/admin/invites')
            const result = await response.json()

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Taklif kodlarini yuklab bo‘lmadi')
            }

            setInvites(Array.isArray(result.invites) ? result.invites : [])
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Taklif kodlarini yuklab bo‘lmadi')
        } finally {
            setLoadingInvites(false)
        }
    }

    useEffect(() => {
        void loadInvites()
    }, [])

    const handleToggle = (key: keyof typeof settings) => {
        setSettings(prev => ({
            ...prev,
            [key]: typeof prev[key] === 'boolean' ? !prev[key] : prev[key],
        }))
    }

    const handleCreateInvite = async () => {
        const normalizedEmail = inviteEmail.trim().toLowerCase()

        if (!normalizedEmail) {
            toast.error('Admin email manzilini kiriting')
            return
        }

        setCreatingInvite(true)
        try {
            const response = await fetch('/api/admin/invites', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: normalizedEmail }),
            })
            const result = await response.json()

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Taklif kodi yaratilmadi')
            }

            setGeneratedInviteCode(result.inviteCode)
            setInviteEmail('')
            toast.success('Taklif kodi yaratildi')
            await loadInvites()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Taklif kodi yaratishda xato')
        } finally {
            setCreatingInvite(false)
        }
    }

    const handleCopy = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value)
            toast.success('Nusxalandi')
        } catch {
            toast.error('Nusxalab bo‘lmadi')
        }
    }

    const handleInputChange = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
        setSettings(prev => ({
            ...prev,
            [key]: value,
        }))
    }

    const handleSave = async () => {
        try {
            setSaving(true)
            // Simulate saving settings
            await new Promise(resolve => setTimeout(resolve, 1000))
            toast.success("Sozlamalar saqlandi!")
        } catch {
            toast.error("Saqlanishda xato!")
        } finally {
            setSaving(false)
        }
    }

    const settingSections: Array<{
        title: string
        icon: typeof Server | typeof Shield | typeof Bell
        color: string
        settings: SettingConfig[]
    }> = [
        {
            title: 'Tizim Sozlamalari',
            icon: Server,
            color: 'from-blue-500 to-indigo-600',
            settings: [
                {
                    label: 'Tekshiruv Rejimi',
                    description: 'Foydalanuvchilar tizimdan foydalana olmaydi',
                    type: 'toggle',
                    key: 'maintenanceMode',
                },
                {
                    label: 'Session Vaqti (Minutlarda)',
                    description: 'Foydalanuvchi sessiyasini avtomatik tugatish vaqti',
                    type: 'input',
                    key: 'sessionTimeout',
                    inputType: 'number',
                },
            ],
        },
        {
            title: 'Xavfsizlik Sozlamalari',
            icon: Shield,
            color: 'from-red-500 to-pink-600',
            settings: [
                {
                    label: 'Ikki Omildan Autentifikatsiya',
                    description: 'Admin hisoblari uchun 2FA ni talab qilish',
                    type: 'toggle',
                    key: 'twoFactorAuth',
                },
                {
                    label: 'IP Ro\'yxati (vergul bilan ajratilgan)',
                    description: 'Faqat ushbu IP manzillardan ruxsat beriladi',
                    type: 'textarea',
                    key: 'ipWhitelist',
                },
            ],
        },
        {
            title: 'Bildirishnomalar',
            icon: Bell,
            color: 'from-green-500 to-emerald-600',
            settings: [
                {
                    label: 'Bildirishnomalarni Faollashtirish',
                    description: 'Muhim hodisalar haqida bildirishnomalar yuborish',
                    type: 'toggle',
                    key: 'enableNotifications',
                },
            ],
        },
    ]

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
                    <p className={`mt-2 text-sm ${textMuted}`}>Yotoqxona boshqaruv tizimining sozlama va konfiguratsiyasi</p>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className={`mb-6 overflow-hidden rounded-2xl border backdrop-blur-xl ${surfaceBg}`}
            >
                <div className="bg-linear-to-r from-purple-600 to-indigo-600 p-6 shadow-md">
                    <div className="flex items-center gap-3">
                        <KeyRound size={28} className="text-white" />
                        <div>
                            <h2 className="text-xl font-black text-white">Admin taklif kodi</h2>
                            <p className="mt-1 text-sm text-purple-100">
                                Yangi admin ro&apos;yxatdan o&apos;tishi uchun shu yerda bir martalik taklif kodi yarating.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-6 p-6">
                    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                        <div className="space-y-2">
                            <label className={`text-xs font-black uppercase tracking-[0.2em] ${textMuted}`}>
                                Admin email
                            </label>
                            <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${inputBg}`}>
                                <MailPlus size={18} className="text-slate-500" />
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="new-admin@example.com"
                                    className={`w-full bg-transparent text-sm outline-none ${textStrong} placeholder:text-slate-500`}
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleCreateInvite}
                            disabled={creatingInvite}
                            className="mt-auto h-12 rounded-xl bg-linear-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 px-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-purple-500/10 transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
                        >
                            {creatingInvite ? 'Yaratilmoqda...' : 'Kod yaratish'}
                        </button>
                    </div>

                    {generatedInviteCode && (
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">
                                Oxirgi yaratilgan kod
                            </p>
                            <div className={`mt-3 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${cardBg}`}>
                                <code className={`break-all text-sm font-bold ${textStrong}`}>{generatedInviteCode}</code>
                                <button
                                    type="button"
                                    onClick={() => void handleCopy(generatedInviteCode)}
                                    className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-all ${isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'}`}
                                >
                                    <Copy size={14} />
                                    Nusxalash
                                </button>
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h3 className={`text-sm font-black uppercase tracking-[0.2em] ${textStrong}`}>
                                    Yaratilgan takliflar
                                </h3>
                                <p className={`mt-1 text-xs ${textMuted}`}>
                                    Admin ro&apos;yxatdan o&apos;tish sahifasida shu kod email bilan birga ishlatiladi.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => void loadInvites()}
                                className={`rounded-xl border px-3.5 py-2 text-xs font-bold uppercase tracking-widest transition-all ${isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                            >
                                Yangilash
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-1 no-scrollbar">
                            {loadingInvites ? (
                                <div className={`rounded-xl border p-4 text-sm ${borderCol} ${textMuted} animate-pulse`}>
                                    Taklif kodlari yuklanmoqda...
                                </div>
                            ) : invites.length === 0 ? (
                                <div className={`rounded-xl border border-dashed p-4 text-sm text-center ${borderCol} ${textMuted}`}>
                                    Hozircha taklif kodlari yo&apos;q.
                                </div>
                            ) : (
                                invites.map((invite) => (
                                    <div
                                        key={invite.id}
                                        className={`grid gap-3 rounded-xl border p-4 lg:grid-cols-[1.2fr_1fr_auto] ${cardBg}`}
                                    >
                                        <div className="min-w-0">
                                            <p className={`truncate text-sm font-semibold ${textStrong}`}>{invite.email}</p>
                                            <p className={`mt-1 break-all font-mono text-xs ${textMuted}`}>{invite.code}</p>
                                        </div>
                                        <div className={`text-xs ${textMuted} space-y-0.5`}>
                                            <p>Yaratilgan: {new Date(invite.created_at).toLocaleString('uz-UZ')}</p>
                                            <p>Ishlatilgan: {invite.used_at ? new Date(invite.used_at).toLocaleString('uz-UZ') : 'Yo‘q'}</p>
                                        </div>
                                        <div className="flex items-start justify-between gap-3 lg:justify-end">
                                            <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${invite.used ? 'bg-amber-500/15 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/20'}`}>
                                                {invite.used ? 'Ishlatilgan' : 'Faol'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => void handleCopy(invite.code)}
                                                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                                            >
                                                <Copy size={12} />
                                                Kod
                                            </button>
                                        </div>
                                    </div>
                                    ))
                                )}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Settings Sections */}
            <div className="space-y-6">
                {settingSections.map((section, idx) => {
                    const Icon = section.icon
                    return (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`backdrop-blur-xl border rounded-2xl overflow-hidden ${surfaceBg}`}
                        >
                            {/* Section Header */}
                            <div className={`bg-gradient-to-r ${section.color} p-6 flex items-center gap-3 shadow-md`}>
                                <Icon size={24} className="text-white" />
                                <h2 className="text-lg font-black text-white">{section.title}</h2>
                            </div>

                            {/* Settings */}
                            <div className="p-6 space-y-6">
                                {section.settings.map((setting, setIdx) => (
                                    <motion.div
                                        key={setIdx}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: (idx * 0.1) + (setIdx * 0.05) }}
                                        className={`flex items-start justify-between pb-6 border-b border-white/5 last:pb-0 last:border-b-0 ${borderCol}`}
                                    >
                                        <div className="flex-1">
                                            <h3 className={`font-semibold ${textStrong}`}>{setting.label}</h3>
                                            <p className={`text-xs mt-1 ${textMuted}`}>{setting.description}</p>
                                        </div>

                                        <div className="ml-4">
                                            {setting.type === 'toggle' && (
                                                <button
                                                    onClick={() => handleToggle(setting.key as keyof typeof settings)}
                                                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all ${settings[setting.key as keyof typeof settings]
                                                            ? 'bg-emerald-500'
                                                            : isLight ? 'bg-slate-300' : 'bg-slate-700'
                                                        }`}
                                                >
                                                    <span
                                                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md ${settings[setting.key as keyof typeof settings]
                                                                ? 'translate-x-7'
                                                                : 'translate-x-1'
                                                            }`}
                                                    />
                                                </button>
                                            )}
                                            {setting.type === 'input' && (
                                                <input
                                                    type={setting.inputType || 'text'}
                                                    value={setting.inputType === 'number' ? Number(settings[setting.key]) : String(settings[setting.key])}
                                                    onChange={(e) =>
                                                        handleInputChange(
                                                            setting.key as keyof typeof settings,
                                                            setting.inputType === 'number' ? parseInt(e.target.value) : e.target.value
                                                        )
                                                    }
                                                    className={`w-32 px-3 py-2 rounded-xl border text-sm outline-none transition-all ${inputBg}`}
                                                />
                                            )}
                                            {setting.type === 'textarea' && (
                                                <textarea
                                                    value={String(settings[setting.key])}
                                                    onChange={(e) =>
                                                        handleInputChange(setting.key as keyof typeof settings, e.target.value)
                                                    }
                                                    rows={3}
                                                    className={`w-64 px-3 py-2 rounded-xl border text-sm outline-none transition-all placeholder-slate-500 ${inputBg}`}
                                                    placeholder="127.0.0.1, 192.168.1.1"
                                                />
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            {/* Save Button */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-8 flex gap-4 justify-end"
            >
                <button className={`px-6 py-3 rounded-xl border font-bold text-xs uppercase tracking-widest transition-all ${isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>
                    Bekor qilish
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 rounded-xl bg-linear-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-purple-500/10 transition-all disabled:opacity-50 active:scale-95 disabled:cursor-not-allowed"
                >
                    {saving ? 'Saqlanmoqda...' : 'Sozlamalarni Saqlash'}
                </button>
            </motion.div>

            {/* Info Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className={`mt-8 border rounded-2xl p-6 bg-blue-500/5 ${isLight ? 'border-blue-500/20 text-blue-800' : 'border-blue-500/30 text-blue-300'}`}
            >
                <h3 className="text-lg font-black mb-2 flex items-center gap-2">
                    <Lock size={20} />
                    Xavfsizlik Xususiyatlari
                </h3>
                <p className="text-sm mb-3 opacity-90">
                    Tizim quyidagi xavfsizlik xususiyatlarini qo&apos;llab-quvvatlaydi:
                </p>
                <ul className="text-sm space-y-1 ml-4 opacity-80 list-disc">
                    <li>SSL/TLS Enkriptlash</li>
                    <li>Parolning Qat&apos;iy Tahlilchisi</li>
                    <li>SQL Injection Himoyasi</li>
                    <li>XSS Himoyasi</li>
                    <li>CSRF Tokenlari</li>
                    <li>Rate Limiting</li>
                </ul>
            </motion.div>
        </div>
    )
}
