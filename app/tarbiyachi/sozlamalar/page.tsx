'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Wallet,
  Boxes,
  Building2,
  ClipboardCheck,
  Phone,
  Send,
  Info,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { apiRequest } from '@/lib/api-client'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI } from '@/lib/dekan-ui'
import { SkelForm } from '@/components/ui/skeletons'
import type { AppSettings } from '@/features/app-settings/types'
import type { DekanDorm } from '@/features/dorms/types'
import { fetchDekanDorm } from '@/features/dorms/client/api'
import { fetchStaffTelegramChat, updateStaffTelegramChat } from '@/features/app-settings/client/api'
import { permitFacultyLabel } from '@/lib/faculties'

function sum(value: number | null | undefined) {
  return typeof value === 'number' ? `${value.toLocaleString('uz-UZ')} so'm` : '—'
}

export default function TarbiyachiSozlamalarPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [dorm, setDorm] = useState<DekanDorm | null>(null)
  const [loading, setLoading] = useState(true)

  const [chatId, setChatId] = useState('')
  const [chatDraft, setChatDraft] = useState('')
  const [savingChat, setSavingChat] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [appSettings, dormResult, staffChat] = await Promise.all([
        apiRequest<AppSettings>('/api/dekan/settings', undefined, "Sozlamalarni yuklab bo'lmadi"),
        fetchDekanDorm().catch(() => ({ dorm: null })),
        fetchStaffTelegramChat().catch(() => ''),
      ])
      setSettings(appSettings)
      setDorm(dormResult.dorm)
      setChatId(staffChat)
      setChatDraft(staffChat)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ma'lumotlarni yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveChat = async () => {
    setSavingChat(true)
    try {
      const stored = await updateStaffTelegramChat(chatDraft.trim())
      setChatId(stored)
      setChatDraft(stored)
      toast.success(stored ? 'Telegram bildirishnoma yoqildi' : 'Telegram bildirishnoma o‘chirildi')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Saqlab bo'lmadi")
    } finally {
      setSavingChat(false)
    }
  }

  if (loading || !settings) {
    return <SkelForm />
  }

  const contacts: { label: string; name: string; phone: string }[] = [
    { label: 'Tarbiyachi', name: settings.tarbiyachiName, phone: settings.tarbiyachiPhone },
    { label: 'Komendant', name: settings.komendantName, phone: settings.komendantPhone },
    { label: 'Shifokor', name: settings.doctorName, phone: settings.doctorPhone },
    { label: 'Talabalar kengashi (o‘g‘il)', name: settings.talabaKengashiRaisiOgilName, phone: settings.talabaKengashiRaisiOgilPhone },
    { label: 'Talabalar kengashi (qiz)', name: settings.talabaKengashiRaisiQizName, phone: settings.talabaKengashiRaisiQizPhone },
    { label: 'Qo‘riqxona', name: '', phone: settings.securityPhone },
  ]

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${ui.strong}`}>Sozlamalar</h1>
        <p className={`mt-1 text-xs sm:text-sm ${ui.muted}`}>
          Yotoqxona parametrlari faqat ko‘rish uchun — ularni dekan boshqaradi. O‘zgartira oladigan yagona narsa —
          shaxsiy Telegram bildirishnomangiz.
        </p>
      </motion.div>

      {/* Editable: personal Telegram */}
      <section className={`rounded-2xl border p-5 sm:p-6 ${ui.cardElevated}`}>
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${ui.accentTile}`}>
            <Send size={18} />
          </span>
          <div>
            <h2 className={`text-sm font-bold ${ui.strong}`}>Mening Telegram bildirishnomam</h2>
            <p className={`text-[11px] ${ui.muted}`}>
              Yotoqxonangizdagi talaba yangi ariza yuborganda shu chatga xabar keladi.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
            placeholder="Masalan: 123456789 yoki @kanal"
            className={`flex-1 rounded-xl border px-4 py-2.5 text-sm ${ui.input} ${ui.ring}`}
          />
          <button
            onClick={saveChat}
            disabled={savingChat || chatDraft.trim() === chatId}
            className={`shrink-0 rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${ui.accentSolid}`}
          >
            {savingChat ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
        <div className={`mt-3 flex items-start gap-2 rounded-xl border p-3 text-[11px] ${ui.inset} ${ui.muted}`}>
          <Info size={14} className="mt-0.5 shrink-0" />
          <p>
            Chat ID ni olish uchun Telegramda <span className={`font-semibold ${ui.strong}`}>@userinfobot</span> ga
            yozing. Guruhga botni qo‘shib, guruh ID sini (manfiy son) ham kiritishingiz mumkin. Bo‘sh qoldirsangiz —
            bildirishnoma o‘chadi.
          </p>
        </div>
      </section>

      {/* Read-only: fees */}
      <ReadCard ui={ui} icon={<Wallet size={18} />} title="To‘lov tariflari">
        <Row ui={ui} label="Oylik to‘lov" value={sum(settings.monthlyFee)} />
        <Row ui={ui} label="Yillik shartnoma" value={sum(settings.yearlyContractFee)} />
      </ReadCard>

      {/* Read-only: rooms */}
      <ReadCard ui={ui} icon={<Boxes size={18} />} title="Xonalar">
        <Row ui={ui} label="Standart xona sig‘imi" value={`${settings.defaultRoomCapacity} ta o‘rin`} />
        <Row ui={ui} label="Qavatlar soni" value={`${settings.floorCount} ta`} />
        <Row ui={ui} label="Ogohlantirish chegarasi" value={`${settings.warningThreshold} ta`} />
        <Row ui={ui} label="Chek hajmi (maks.)" value={`${settings.maxUploadSizeMb} MB`} />
      </ReadCard>

      {/* Read-only: dorm building */}
      {dorm && (
        <ReadCard ui={ui} icon={<Building2 size={18} />} title="Yotoqxona binosi">
          <Row ui={ui} label="Bino raqami" value={dorm.number || '—'} />
          <Row ui={ui} label="Nomi" value={dorm.name || '—'} />
          <Row ui={ui} label="Qavatlar" value={`${dorm.floorCount} ta`} />
          <Row
            ui={ui}
            label="Hamkor fakultetlar"
            value={dorm.coFaculties.length ? dorm.coFaculties.map((f) => permitFacultyLabel(f) || f).join(', ') : 'Yo‘q'}
          />
        </ReadCard>
      )}

      {/* Read-only: attendance */}
      {dorm && (
        <ReadCard ui={ui} icon={<ClipboardCheck size={18} />} title="Yo‘qlama sozlamalari">
          <Row ui={ui} label="Holat" value={dorm.attendance.enabled ? 'Yoqilgan' : 'O‘chirilgan'} />
          <Row ui={ui} label="Vaqt oralig‘i" value={`${dorm.attendance.openTime}–${dorm.attendance.closeTime}`} />
          <Row ui={ui} label="Ruxsat radiusi" value={`${dorm.attendance.radiusM} m`} />
          <Row
            ui={ui}
            label="GPS koordinatalari"
            value={dorm.attendance.latitude !== null && dorm.attendance.longitude !== null ? 'Belgilangan' : 'Belgilanmagan'}
          />
        </ReadCard>
      )}

      {/* Read-only: contacts */}
      <ReadCard ui={ui} icon={<Phone size={18} />} title="Aloqa ma‘lumotlari">
        {contacts.map((c) => (
          <Row key={c.label} ui={ui} label={c.label} value={[c.name, c.phone].filter(Boolean).join(' · ') || '—'} />
        ))}
      </ReadCard>
    </div>
  )
}

function ReadCard({
  ui,
  icon,
  title,
  children,
}: {
  ui: ReturnType<typeof dekanUI>
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 sm:p-6 ${ui.card}`}
    >
      <div className="mb-3 flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${ui.accentSoft}`}>{icon}</span>
        <h2 className={`text-sm font-bold ${ui.strong}`}>{title}</h2>
      </div>
      <div className={`divide-y ${ui.divide}`}>{children}</div>
    </motion.section>
  )
}

function Row({ ui, label, value }: { ui: ReturnType<typeof dekanUI>; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className={`text-xs font-medium ${ui.muted}`}>{label}</span>
      <span className={`text-xs font-semibold text-right ${ui.strong}`}>{value}</span>
    </div>
  )
}
