'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Settings as SettingsIcon, Lock, Bell, Server, Shield, Copy, KeyRound, MailPlus } from 'lucide-react'
import toast from 'react-hot-toast'

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
        <div>
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter flex items-center gap-2">
                        <SettingsIcon size={32} />
                        Tizim Sozlamalari
                    </h1>
                    <p className="text-slate-400 mt-2">Yotoqxona boshqaruv tizimining sozlama va konfiguratsiyasi</p>
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1120]/50 backdrop-blur-xl"
            >
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6">
                    <div className="flex items-center gap-3">
                        <KeyRound size={28} className="text-white" />
                        <div>
                            <h2 className="text-xl font-black text-white">Admin taklif kodi</h2>
                            <p className="mt-1 text-sm text-blue-100">
                                Yangi admin ro&apos;yxatdan o&apos;tishi uchun shu yerda bir martalik taklif kodi yarating.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-6 p-6">
                    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                                Admin email
                            </label>
                            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                <MailPlus size={18} className="text-slate-500" />
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="new-admin@example.com"
                                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleCreateInvite}
                            disabled={creatingInvite}
                            className="mt-auto h-12 rounded-xl bg-linear-to-r from-indigo-500 to-blue-600 px-5 text-sm font-black uppercase tracking-widest text-white transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {creatingInvite ? 'Yaratilmoqda...' : 'Kod yaratish'}
                        </button>
                    </div>

                    {generatedInviteCode && (
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">
                                Oxirgi yaratilgan kod
                            </p>
                            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-white/10 bg-[#020617]/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <code className="break-all text-sm text-white">{generatedInviteCode}</code>
                                <button
                                    type="button"
                                    onClick={() => void handleCopy(generatedInviteCode)}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-200 transition-all hover:bg-white/5"
                                >
                                    <Copy size={14} />
                                    Nusxalash
                                </button>
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-300">
                                    Yaratilgan takliflar
                                </h3>
                                <p className="mt-1 text-xs text-slate-500">
                                    Admin ro&apos;yxatdan o&apos;tish sahifasida shu kod email bilan birga ishlatiladi.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => void loadInvites()}
                                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-300 transition-all hover:bg-white/5"
                            >
                                Yangilash
                            </button>
                        </div>

                        <div className="space-y-3">
                            {loadingInvites ? (
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                                    Taklif kodlari yuklanmoqda...
                                </div>
                            ) : invites.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-500">
                                    Hozircha taklif kodlari yo&apos;q.
                                </div>
                            ) : (
                                invites.map((invite) => (
                                    <div
                                        key={invite.id}
                                        className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-[1.2fr_1fr_auto]"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-white">{invite.email}</p>
                                            <p className="mt-1 break-all font-mono text-xs text-slate-400">{invite.code}</p>
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            <p>Yaratilgan: {new Date(invite.created_at).toLocaleString('uz-UZ')}</p>
                                            <p>Ishlatilgan: {invite.used_at ? new Date(invite.used_at).toLocaleString('uz-UZ') : 'Yo‘q'}</p>
                                        </div>
                                        <div className="flex items-start justify-between gap-3 lg:justify-end">
                                            <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${invite.used ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                                                {invite.used ? 'Ishlatilgan' : 'Faol'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => void handleCopy(invite.code)}
                                                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-300 transition-all hover:bg-white/5"
                                            >
                                                <Copy size={14} />
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
                            className="bg-[#0b1120]/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden"
                        >
                            {/* Section Header */}
                            <div className={`bg-gradient-to-r ${section.color} p-6 flex items-center gap-3`}>
                                <Icon size={28} className="text-white" />
                                <h2 className="text-xl font-black text-white">{section.title}</h2>
                            </div>

                            {/* Settings */}
                            <div className="p-6 space-y-6">
                                {section.settings.map((setting, setIdx) => (
                                    <motion.div
                                        key={setIdx}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: (idx * 0.1) + (setIdx * 0.05) }}
                                        className="flex items-start justify-between pb-6 border-b border-white/5 last:pb-0 last:border-b-0"
                                    >
                                        <div className="flex-1">
                                            <h3 className="text-white font-semibold">{setting.label}</h3>
                                            <p className="text-sm text-slate-400 mt-1">{setting.description}</p>
                                        </div>

                                        <div className="ml-4">
                                            {setting.type === 'toggle' && (
                                                <button
                                                    onClick={() => handleToggle(setting.key as keyof typeof settings)}
                                                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all ${settings[setting.key as keyof typeof settings]
                                                            ? 'bg-green-500'
                                                            : 'bg-slate-700'
                                                        }`}
                                                >
                                                    <span
                                                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings[setting.key as keyof typeof settings]
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
                                                    className="w-32 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500 text-sm"
                                                />
                                            )}
                                            {setting.type === 'textarea' && (
                                                <textarea
                                                    value={String(settings[setting.key])}
                                                    onChange={(e) =>
                                                        handleInputChange(setting.key as keyof typeof settings, e.target.value)
                                                    }
                                                    rows={3}
                                                    className="w-64 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500 text-sm placeholder-slate-500"
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
                <button className="px-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold transition-all">
                    Bekor qilish
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? 'Saqlanmoqda...' : 'Sozlamalarni Saqlash'}
                </button>
            </motion.div>

            {/* Info Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6"
            >
                <h3 className="text-lg font-black text-blue-300 mb-2 flex items-center gap-2">
                    <Lock size={20} />
                    Xavfsizlik Xususiyatlari
                </h3>
                <p className="text-sm text-blue-200 mb-3">
                    Tizim quyidagi xavfsizlik xususiyatlarini qo&apos;llab-quvvatlaydi:
                </p>
                <ul className="text-sm text-blue-200 space-y-1 ml-4">
                    <li>✓ SSL/TLS Enkriptlash</li>
                    <li>✓ Parolning Qat&apos;iy Tahlilchisi</li>
                    <li>✓ SQL Injection Himoyasi</li>
                    <li>✓ XSS Himoyasi</li>
                    <li>✓ CSRF Tokenlari</li>
                    <li>✓ Rate Limiting</li>
                </ul>
            </motion.div>
        </div>
    )
}
