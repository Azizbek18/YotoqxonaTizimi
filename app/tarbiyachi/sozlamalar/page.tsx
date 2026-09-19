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
  RotateCcw,
  Sliders,
  CheckCircle2,
  PhoneCall,
  ShieldAlert,
  Sparkles,
  Bot,
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
import { useDekanScope } from '@/lib/hooks/useDekanScope'

function sum(value: number | null | undefined) {
  return typeof value === 'number' ? `${value.toLocaleString('uz-UZ')} so'm` : '—'
}

export default function TarbiyachiSozlamalarPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)
  const { faculty: dekanFaculty } = useDekanScope()

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

  const contacts: { label: string; role: string; name: string; phone: string; icon: typeof Phone }[] = [
    { label: 'Tarbiyachi', role: 'Navbatchi pedagog', name: settings.tarbiyachiName, phone: settings.tarbiyachiPhone, icon: Phone },
    { label: 'Komendant', role: 'Bino boshqaruvchisi', name: settings.komendantName, phone: settings.komendantPhone, icon: Building2 },
    { label: 'Shifokor', role: 'Tibbiy xizmat', name: settings.doctorName, phone: settings.doctorPhone, icon: Sparkles },
    { label: 'Qo‘riqxona', role: 'Xavfsizlik xizmati', name: 'Navbatchilik posti', phone: settings.securityPhone, icon: ShieldAlert },
  ]

  return (
    <div className="space-y-6 pb-12">
      {/* ── Executive Multi-Layered Hero Banner (Compact) ── */}
      <div className="no-shelf relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-800 p-4 sm:p-5 shadow-lg shadow-indigo-950/15 border border-white/20 text-white">
        {/* Ambient lighting & subtle micro-dot texture */}
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-16 h-48 w-48 rounded-full bg-violet-400/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.07]" />

        {/* Top bar inside hero */}
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md text-white border border-white/25 shadow-inner shrink-0">
              <Sliders size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-white backdrop-blur-md border border-white/20"
                  style={{ color: '#ffffff' }}
                >
                  <Building2 size={11} className="text-white/80" />
                  {dekanFaculty ? permitFacultyLabel(dekanFaculty) : "Fakultet ma'muriyati"}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Tarbiyachi kabineti
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white" style={{ color: '#ffffff' }}>
                Tizim va Xabarnoma sozlamalari
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center justify-center h-8.5 w-8.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white transition-all disabled:opacity-50 no-shelf cursor-pointer active:scale-95 shadow-xs"
              title="Yangilash"
            >
              <motion.div
                animate={loading ? { rotate: 360 } : {}}
                transition={loading ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}}
              >
                <RotateCcw size={15} />
              </motion.div>
            </button>
          </div>
        </div>

        {/* Hero Status Row (Compact Horizontal) */}
        <div className="relative mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Card 1: Telegram Status */}
          <div className="relative text-left rounded-xl px-3.5 py-2.5 backdrop-blur-md transition-all no-shelf flex items-center justify-between gap-3 border bg-white/10 border-white/15">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-400/25 text-sky-200 shrink-0">
                <Send size={15} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-indigo-100 truncate" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  Telegram bildirishnoma
                </p>
                <p className="text-sm font-extrabold text-white truncate" style={{ color: '#ffffff' }}>
                  {chatId ? `Faol (${chatId})` : 'Ulanmagan'}
                </p>
              </div>
            </div>
            <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
              chatId ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30' : 'bg-white/15 text-white/80'
            }`}>
              {chatId && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              {chatId ? 'Ulangan' : 'Nofaol'}
            </span>
          </div>

          {/* Card 2: Biriktirilgan bino */}
          <div className="relative text-left rounded-xl px-3.5 py-2.5 backdrop-blur-md transition-all no-shelf flex items-center justify-between gap-3 border bg-white/10 border-white/15">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white shrink-0">
                <Building2 size={15} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-indigo-100 truncate" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  Biriktirilgan bino
                </p>
                <p className="text-sm font-extrabold text-white truncate" style={{ color: '#ffffff' }}>
                  {dorm ? `${dorm.number}-yotoqxona` : 'Bino tanlanmagan'}
                </p>
              </div>
            </div>
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/15 text-white">
              {dorm?.floorCount ? `${dorm.floorCount} qavat` : 'Asosiy'}
            </span>
          </div>

          {/* Card 3: Yo'qlama nazorati */}
          <div className="relative text-left rounded-xl px-3.5 py-2.5 backdrop-blur-md transition-all no-shelf flex items-center justify-between gap-3 border bg-white/10 border-white/15">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/25 text-emerald-200 shrink-0">
                <ClipboardCheck size={15} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-indigo-100 truncate" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  Yo‘qlama rejimi
                </p>
                <p className="text-sm font-extrabold text-white truncate" style={{ color: '#ffffff' }}>
                  {dorm?.attendance.enabled ? `${dorm.attendance.openTime} – ${dorm.attendance.closeTime}` : 'O‘chirilgan'}
                </p>
              </div>
            </div>
            <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
              dorm?.attendance.enabled ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30' : 'bg-white/15 text-white/80'
            }`}>
              {dorm?.attendance.enabled ? 'Faol' : 'Nofaol'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Telegram Bildirishnoma Sozlamasi (Interactive) ── */}
      <section className={`rounded-3xl border p-5 sm:p-6 backdrop-blur-xl transition-all ${ui.card} shadow-xs space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 dark:border-slate-800 border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60 shrink-0">
              <Send size={18} />
            </div>
            <div>
              <h2 className={`text-sm font-extrabold tracking-tight ${ui.strong}`}>
                Mening Telegram bildirishnomam
              </h2>
              <p className={`text-[11px] font-medium ${ui.muted}`}>
                Talaba yangi ariza yuborganda yoki navbat holati o‘zgarganda to‘g‘ridan-to‘g‘ri shaxsiy xabar keladi
              </p>
            </div>
          </div>

          <span className={`self-start sm:self-center px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 ${
            chatId
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'
              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${chatId ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            {chatId ? `Faol: ${chatId}` : 'Ulanmagan'}
          </span>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Bot size={16} />
            </div>
            <input
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="Masalan: 123456789 (shaxsiy Chat ID) yoki -100123456789 (guruh ID)"
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${ui.input} ${ui.ring}`}
            />
          </div>
          <button
            type="button"
            onClick={saveChat}
            disabled={savingChat || chatDraft.trim() === chatId}
            className="no-shelf shrink-0 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 size={15} />
            <span>{savingChat ? 'Saqlanmoqda…' : 'Saqlash'}</span>
          </button>
        </div>

        <div className={`flex items-start gap-2.5 rounded-2xl border p-3.5 text-xs leading-relaxed ${
          isLight ? 'bg-slate-50 border-slate-200/80 text-slate-600' : 'bg-slate-900/40 border-slate-800 text-slate-300'
        }`}>
          <Info size={16} className="text-sky-500 shrink-0 mt-0.5" />
          <p>
            <strong>Chat ID ni qanday olish mumkin?</strong> Telegram orqali <span className="font-bold text-indigo-600 dark:text-indigo-400">@userinfobot</span> ga <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">/start</code> yuboring va qaytgan sonli <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">Id:</code> qiymatini kiriting. Agar bildirishnomalarni bekor qilmoqchi bo‘lsangiz, maydonni bo‘sh qoldirib saqlang.
          </p>
        </div>
      </section>

      {/* ── 2 Ustunli Tizim Parametrlari (Grid Layout) ────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Yotoqxona Binosi */}
        {dorm && (
          <div className={`rounded-3xl border p-5 sm:p-6 backdrop-blur-xl transition-all ${ui.card} shadow-xs space-y-3`}>
            <div className="flex items-center gap-3 border-b pb-3.5 dark:border-slate-800 border-slate-200/80">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 shrink-0">
                <Building2 size={17} />
              </div>
              <div>
                <h3 className={`text-sm font-extrabold tracking-tight ${ui.strong}`}>Yotoqxona binosi</h3>
                <p className={`text-[11px] font-medium ${ui.muted}`}>Bino tuzilishi va fakultetlar taqsimoti</p>
              </div>
            </div>
            <div className={`divide-y ${ui.divide}`}>
              <Row ui={ui} label="Bino raqami" value={`${dorm.number}-sonli bino`} />
              <Row ui={ui} label="Rasmiy nomi" value={dorm.name || 'Asosiy korpus'} />
              <Row ui={ui} label="Qavatlar soni" value={`${dorm.floorCount} ta qavat`} />
              <Row
                ui={ui}
                label="Hamkor fakultetlar"
                value={dorm.coFaculties.length ? dorm.coFaculties.map((f) => permitFacultyLabel(f) || f).join(', ') : 'Faqat biriktirilgan fakultet'}
              />
            </div>
          </div>
        )}

        {/* Card 2: Yo'qlama Sozlamalari */}
        {dorm && (
          <div className={`rounded-3xl border p-5 sm:p-6 backdrop-blur-xl transition-all ${ui.card} shadow-xs space-y-3`}>
            <div className="flex items-center gap-3 border-b pb-3.5 dark:border-slate-800 border-slate-200/80">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
                <ClipboardCheck size={17} />
              </div>
              <div>
                <h3 className={`text-sm font-extrabold tracking-tight ${ui.strong}`}>Yo‘qlama nazorati</h3>
                <p className={`text-[11px] font-medium ${ui.muted}`}>Kunlik davomat va geolocation qoidalari</p>
              </div>
            </div>
            <div className={`divide-y ${ui.divide}`}>
              <Row ui={ui} label="Yo‘qlama holati" value={dorm.attendance.enabled ? 'Faol (Yoqilgan)' : 'O‘chirilgan'} />
              <Row ui={ui} label="Vaqt oralig‘i" value={`${dorm.attendance.openTime} – ${dorm.attendance.closeTime}`} />
              <Row ui={ui} label="Ruxsat etilgan radius" value={`${dorm.attendance.radiusM} metr`} />
              <Row
                ui={ui}
                label="GPS koordinatalari"
                value={dorm.attendance.latitude !== null && dorm.attendance.longitude !== null ? 'Belgilangan (Geo-Lock)' : 'Belgilanmagan'}
              />
            </div>
          </div>
        )}

        {/* Card 3: To'lov Tariflari */}
        <div className={`rounded-3xl border p-5 sm:p-6 backdrop-blur-xl transition-all ${ui.card} shadow-xs space-y-3`}>
          <div className="flex items-center gap-3 border-b pb-3.5 dark:border-slate-800 border-slate-200/80">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/60 shrink-0">
              <Wallet size={17} />
            </div>
            <div>
              <h3 className={`text-sm font-extrabold tracking-tight ${ui.strong}`}>To‘lov tariflari</h3>
              <p className={`text-[11px] font-medium ${ui.muted}`}>Universitet tomonidan belgilangan rasmiy stavkalar</p>
            </div>
          </div>
          <div className={`divide-y ${ui.divide}`}>
            <Row ui={ui} label="Oylik to‘lov miqdori" value={sum(settings.monthlyFee)} />
            <Row ui={ui} label="Yillik shartnoma summasi" value={sum(settings.yearlyContractFee)} />
            <Row ui={ui} label="Chek fayl hajmi (maks.)" value={`${settings.maxUploadSizeMb} MB`} />
            <Row ui={ui} label="Boshqaruv darajasi" value="Dekanat / Rektorat tomonidan" />
          </div>
        </div>

        {/* Card 4: Xonalar va Qoidalar */}
        <div className={`rounded-3xl border p-5 sm:p-6 backdrop-blur-xl transition-all ${ui.card} shadow-xs space-y-3`}>
          <div className="flex items-center gap-3 border-b pb-3.5 dark:border-slate-800 border-slate-200/80">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 shrink-0">
              <Boxes size={17} />
            </div>
            <div>
              <h3 className={`text-sm font-extrabold tracking-tight ${ui.strong}`}>Xona va Qoidalar</h3>
              <p className={`text-[11px] font-medium ${ui.muted}`}>Yotoqxona yashash standartlari</p>
            </div>
          </div>
          <div className={`divide-y ${ui.divide}`}>
            <Row ui={ui} label="Standart xona sig‘imi" value={`${settings.defaultRoomCapacity} ta o‘rin`} />
            <Row ui={ui} label="Qavatlar soni" value={`${settings.floorCount} ta`} />
            <Row ui={ui} label="Ogohlantirish chegarasi" value={`${settings.warningThreshold} ta ogohlantirish`} />
            <Row ui={ui} label="Nazorat tartibi" value="Tarbiyachi va Dekanat nazoratida" />
          </div>
        </div>
      </div>

      {/* ── Mas'ul Xodimlar va Favqulodda Aloqa Directory ─── */}
      <section className={`rounded-3xl border p-5 sm:p-6 backdrop-blur-xl transition-all ${ui.card} shadow-xs space-y-4`}>
        <div className="flex items-center gap-3 border-b pb-3.5 dark:border-slate-800 border-slate-200/80">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 shrink-0">
            <Phone size={17} />
          </div>
          <div>
            <h3 className={`text-sm font-extrabold tracking-tight ${ui.strong}`}>
              Mas&apos;ul xodimlar va Favqulodda aloqa
            </h3>
            <p className={`text-[11px] font-medium ${ui.muted}`}>
              Yotoqxona bo‘yicha tezkor bog‘lanish kontaktlari
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {contacts.map((c) => {
            const Icon = c.icon
            const hasPhone = Boolean(c.phone)
            return (
              <div
                key={c.label}
                className={`rounded-2xl border p-4 transition-all flex flex-col justify-between gap-3 ${
                  isLight ? 'bg-slate-50/70 border-slate-200/80 hover:bg-white' : 'bg-slate-900/40 border-slate-800 hover:bg-slate-900/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      {c.role}
                    </span>
                    <Icon size={14} className="text-slate-400" />
                  </div>
                  <h4 className={`mt-1 text-sm font-extrabold truncate ${ui.strong}`} title={c.name || c.label}>
                    {c.name || c.label}
                  </h4>
                  <p className={`text-xs font-semibold mt-0.5 ${c.phone ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
                    {c.phone || 'Kiritilmagan'}
                  </p>
                </div>

                {hasPhone ? (
                  <a
                    href={`tel:${c.phone}`}
                    className="no-shelf inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800/80 transition-all cursor-pointer"
                  >
                    <PhoneCall size={13} />
                    <span>Qo‘ng‘iroq qilish</span>
                  </a>
                ) : (
                  <div className="py-2 text-center text-[11px] text-slate-400 font-medium">
                    Raqam yo‘q
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Row({ ui, label, value }: { ui: ReturnType<typeof dekanUI>; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-xs">
      <span className={`font-medium ${ui.muted}`}>{label}</span>
      <span className={`font-bold text-right ${ui.strong}`}>{value}</span>
    </div>
  )
}
