'use client'

import React, { useEffect, useState } from 'react'
import {
  Mail,
  PhoneCall,
  RotateCcw,
  UserCog,
  KeyRound,
  Copy,
  Trash2,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Check,
  Layers,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { SkelList } from '@/components/ui/skeletons'
import { useThemeStore } from '@/lib/stores/theme-store'
import { fetchStaffAccounts } from '@/features/staff-accounts/client/api'
import { fetchStaffInvites, createStaffInvite, revokeStaffInvite } from '@/features/staff-invites/client/api'
import type { StaffInviteRow } from '@/features/staff-invites/types'
import { adminUI } from '@/lib/admin-ui'
import type { ManagedStaffRole, StaffAccountRow } from '@/features/staff-accounts/types'

const ROLE_LABELS: Record<ManagedStaffRole, string> = {
  admin: 'Admin',
  tarbiyachi: 'Tarbiyachi',
}

const initialInviteForm = { email: '', label: '', expiryDays: '14' }

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function AdminXodimlarPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const ui = adminUI(isLight)

  const [staff, setStaff] = useState<StaffAccountRow[]>([])
  const [loading, setLoading] = useState(true)

  const [invites, setInvites] = useState<StaffInviteRow[]>([])
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState(initialInviteForm)
  const [newCode, setNewCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<StaffInviteRow | null>(null)
  const [revoking, setRevoking] = useState(false)

  const loadStaff = async () => {
    setLoading(true)
    try {
      const rows = await fetchStaffAccounts()
      setStaff(rows)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xodimlarni yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }

  const loadInvites = async () => {
    try {
      setInvites(await fetchStaffInvites())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Taklif kodlarini yuklab bo'lmadi")
    }
  }

  useEffect(() => {
    void loadStaff()
    void loadInvites()
  }, [])

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(inviteForm.email.trim())) {
      toast.error("Email manzili noto'g'ri kiritildi")
      return
    }
    setCreatingInvite(true)
    try {
      const created = await createStaffInvite({
        role: 'tarbiyachi',
        email: inviteForm.email.trim(),
        label: inviteForm.label.trim() || undefined,
        expiryDays: Number(inviteForm.expiryDays) || 14,
      })
      setNewCode(created.code)
      setCopied(false)
      setInviteForm(initialInviteForm)
      void loadInvites()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Taklif kodini yaratib bo'lmadi")
    } finally {
      setCreatingInvite(false)
    }
  }

  const handleRevokeInvite = async () => {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      await revokeStaffInvite(revokeTarget.id)
      toast.success('Taklif kodi bekor qilindi')
      setRevokeTarget(null)
      void loadInvites()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bekor qilib bo'lmadi")
    } finally {
      setRevoking(false)
    }
  }

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success('Nusxa olindi')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Nusxa olib bo\'lmadi')
    }
  }

  const activeInvitesCount = invites.filter((i) => i.active).length
  const usedInvitesCount = invites.filter((i) => i.useCount > 0).length
  const tarbiyachiStaff = staff.filter((s) => s.role === 'tarbiyachi')

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. Executive Hero Banner */}
      <div className="no-shelf relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-800 p-5 sm:p-7 text-white shadow-xl shadow-indigo-950/15 border border-white/20">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-200 border border-emerald-400/30">
                <ShieldCheck size={11} /> Xodimlar Boshqaruvi
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-indigo-100 border border-white/15">
                <UserCog size={11} /> Pedagog-Tarbiyachilar
              </span>
            </div>
            <h1
              className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white drop-shadow-sm"
              style={{ color: '#ffffff' }}
            >
              Tarbiyachilar va Taklif Kodlari
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100 max-w-2xl font-medium leading-relaxed">
              Yotoqxona tarbiyachilari hisoblarini boshqarish va yangi xodimlar uchun bir martalik ro‘yxatdan o‘tish taklif kodlarini yaratish tizimi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Kod yaratish tugmasi */}
            <button
              type="button"
              onClick={() => {
                setNewCode(null)
                setCopied(false)
                setInviteForm(initialInviteForm)
                setInviteModalOpen(true)
              }}
              className="no-shelf cursor-pointer inline-flex items-center gap-2 rounded-xl bg-white text-indigo-950 hover:bg-white/90 px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-950/20 transition-all active:scale-95"
            >
              <Plus size={15} />
              <span>Kod yaratish</span>
            </button>

            {/* Refresh */}
            <button
              type="button"
              onClick={() => {
                void loadStaff()
                void loadInvites()
              }}
              disabled={loading}
              className="no-shelf cursor-pointer inline-flex items-center justify-center h-10 w-10 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white transition-all active:scale-95 shadow-xs disabled:opacity-50"
              title="Yangilash"
            >
              <RotateCcw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. 3 Sleek KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: Faol Tarbiyachilar */}
        <div className={`no-shelf rounded-2xl border p-4 sm:p-5 flex items-center gap-4 shadow-xs ${ui.card}`}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
            <UserCog size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Faol Tarbiyachilar
            </span>
            <p className={`text-2xl font-black tracking-tight leading-tight mt-0.5 ${ui.strong}`}>
              {loading ? '…' : tarbiyachiStaff.length}
            </p>
            <p className="text-[11px] font-medium text-slate-500 truncate">
              Tizimda faol xodimlar
            </p>
          </div>
        </div>

        {/* Card 2: Faol (Kutilayotgan) Kodlar */}
        <div className={`no-shelf rounded-2xl border p-4 sm:p-5 flex items-center gap-4 shadow-xs ${ui.card}`}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
            <KeyRound size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Faol Taklif Kodlari
            </span>
            <p className={`text-2xl font-black tracking-tight leading-tight mt-0.5 ${ui.strong}`}>
              {loading ? '…' : activeInvitesCount}
            </p>
            <p className="text-[11px] font-medium text-slate-500 truncate">
              Ro‘yxatdan o‘tishga tayyor
            </p>
          </div>
        </div>

        {/* Card 3: Jami Takliflar */}
        <div className={`no-shelf rounded-2xl border p-4 sm:p-5 flex items-center gap-4 shadow-xs ${ui.card}`}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50">
            <CheckCircle2 size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Jami Takliflar
            </span>
            <p className={`text-2xl font-black tracking-tight leading-tight mt-0.5 ${ui.strong}`}>
              {loading ? '…' : invites.length}
            </p>
            <p className="text-[11px] font-medium text-slate-500 truncate">
              {usedInvitesCount} tasi ishlatilgan
            </p>
          </div>
        </div>
      </div>

      {/* 3. Section: Taklif Kodlari (Invite Codes) */}
      <div className={`no-shelf rounded-3xl border p-4 sm:p-6 space-y-4 shadow-xs ${ui.card}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start sm:items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <KeyRound size={16} />
            </span>
            <div>
              <h3 className={`text-xs sm:text-sm font-black uppercase tracking-wider ${ui.strong}`}>
                Yaratilgan Taklif Kodlari
              </h3>
              <p className="text-[11px] font-medium text-slate-500 max-w-xl">
                Kod aynan kiritilgan emailga biriktiriladi. Tarbiyachi <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">/register/xodim</span> orqali F.I.Sh., telefon va parolini o‘zi kiritadi.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setNewCode(null)
              setCopied(false)
              setInviteForm(initialInviteForm)
              setInviteModalOpen(true)
            }}
            className="no-shelf cursor-pointer self-start sm:self-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3.5 py-2 text-xs font-black uppercase tracking-wider shadow-md shadow-blue-500/20 transition-all active:scale-95"
          >
            <Plus size={14} />
            <span>Kod yaratish</span>
          </button>
        </div>

        {invites.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400">
              <KeyRound size={18} />
            </div>
            <p className="text-xs font-bold text-slate-500">Hozircha taklif kodi yaratilmagan.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Yangi tarbiyachi qo‘shish uchun &laquo;Kod yaratish&raquo; tugmasidan foydalaning.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {invites.map((inv) => {
              const isInvActive = inv.active
              const isRevoked = Boolean(inv.revokedAt)
              const isUsed = inv.useCount > 0

              return (
                <div
                  key={inv.id}
                  className={`no-shelf rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition-all ${ui.inset}`}
                >
                  <div className="space-y-2 min-w-0">
                    {/* Status badges */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                          {inv.role}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            isInvActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : isRevoked
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : isUsed
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isInvActive ? 'bg-emerald-500 animate-pulse' : isRevoked ? 'bg-rose-500' : 'bg-slate-400'
                            }`}
                          />
                          {isInvActive
                            ? 'Faol'
                            : isRevoked
                            ? 'Bekor qilingan'
                            : isUsed
                            ? 'Ishlatilgan'
                            : 'Muddati tugagan'}
                        </span>
                      </div>

                      <span className="text-[10px] font-medium text-slate-400">
                        Muddat: {new Date(inv.expiresAt).toLocaleDateString('uz-UZ')}
                      </span>
                    </div>

                    {/* Email & Label */}
                    <div className="min-w-0">
                      <p className={`font-mono text-xs font-bold truncate ${ui.strong}`}>
                        {inv.email || 'Har qanday email'}
                      </p>
                      {inv.label && (
                        <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                          Izoh: {inv.label}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {isInvActive && (
                    <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/80 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setRevokeTarget(inv)}
                        className="no-shelf cursor-pointer inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                      >
                        <Trash2 size={11} />
                        <span>Bekor qilish</span>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 4. Section: Faol Tarbiyachilar Ro‘yxati */}
      <div className={`no-shelf rounded-3xl border p-4 sm:p-6 space-y-4 shadow-xs ${ui.card}`}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <UserCog size={16} />
            </span>
            <div>
              <h3 className={`text-xs sm:text-sm font-black uppercase tracking-wider ${ui.strong}`}>
                Faol Tarbiyachilar Ro‘yxati
              </h3>
              <p className="text-[11px] font-medium text-slate-500">
                Fakultet talabalariga mas’ul bo‘lgan rasmiy xodimlar hisobi
              </p>
            </div>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
            Jami: {tarbiyachiStaff.length} nafar
          </span>
        </div>

        {loading ? (
          <SkelList count={4} className="p-1" />
        ) : tarbiyachiStaff.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400">
              <UserCog size={22} />
            </div>
            <h4 className={`text-sm font-bold ${ui.strong}`}>Hozircha tarbiyachi akkounti mavjud emas</h4>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Yangi tarbiyachiga taklif kodi yuborilgach va u tizimdan ro‘yxatdan o‘tgach, ushbu ro‘yxatda ko‘rinadi.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tarbiyachiStaff.map((row) => (
              <div
                key={row.id}
                className={`no-shelf rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-all ${ui.inset}`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar with initials */}
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-sm font-black text-white shadow-xs">
                    {getInitials(row.full_name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`text-sm font-black truncate leading-tight ${ui.strong}`}>
                        {row.full_name}
                      </h4>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                        {ROLE_LABELS[row.role]}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {row.status === 'active' ? 'Faol' : row.status ?? "Faol"}
                      </span>
                    </div>

                    {/* Assigned Floor / Gender */}
                    {(row.assigned_floor || row.assigned_gender) && (
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        <Layers size={12} />
                        {row.assigned_floor ? `${row.assigned_floor}-qavat mas’uli` : ''}
                        {row.assigned_gender ? ` (${row.assigned_gender === 'female' ? 'Qizlar' : "O'g'il bolalar"})` : ''}
                      </div>
                    )}
                  </div>
                </div>

                {/* Contacts & Quick Call */}
                <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] truncate max-w-[200px]">
                    <Mail size={12} className="shrink-0 text-slate-400" />
                    <span className="truncate">{row.email}</span>
                  </div>

                  {row.phone_number ? (
                    <a
                      href={`tel:${row.phone_number.replace(/[^\d+]/g, '')}`}
                      className="no-shelf inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold transition-colors"
                      title="Qo‘ng‘iroq qilish"
                    >
                      <PhoneCall size={11} />
                      <span>{row.phone_number}</span>
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-400">Telefon kiritilmagan</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Create Invite Modal */}
      <ConfirmModal
        isOpen={inviteModalOpen}
        title={newCode ? "Taklif kodi yaratildi" : "Yangi taklif kodi yaratish"}
        description={newCode ? "Ushbu kodni nusxa oling va tarbiyachiga yuboring" : "Tarbiyachi uchun bir martalik taklif kodi yaratiladi"}
        onClose={() => {
          setInviteModalOpen(false)
          setNewCode(null)
          setCopied(false)
          setInviteForm(initialInviteForm)
        }}
        confirmText={newCode ? "Yopish" : undefined}
      >
        {newCode ? (
          <div className="space-y-4 text-center py-2">
            <div className="rounded-2xl border-2 border-dashed border-indigo-400 dark:border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 p-4">
              <p className="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                Bir martalik taklif kodi
              </p>
              <p className="font-mono text-2xl sm:text-3xl font-black tracking-[0.2em] text-slate-900 dark:text-white select-all">
                {newCode}
              </p>
            </div>

            <button
              type="button"
              onClick={() => copyCode(newCode)}
              className="no-shelf cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all active:scale-95"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Nusxa olindi!' : 'Kodni nusxa olish'}</span>
            </button>

            <div className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3 text-[11px] text-slate-500 space-y-1">
              <p className="font-bold text-slate-700 dark:text-slate-300">Keyingi qadamlar:</p>
              <p>1. Ushbu kodni tarbiyachiga yuboring.</p>
              <p>2. Tarbiyachi <span className="font-mono font-bold text-indigo-600">/register/xodim</span> sahifasiga kirib, kodni kiritadi.</p>
              <p>3. U o‘z F.I.Sh., telefon va parolini o‘zi o‘rnatadi.</p>
              <p className="text-rose-600 dark:text-rose-400 font-bold pt-1">
                Eslatma: Ushbu oyna yopilgach, xavfsizlik sababli kod qayta ko‘rsatilmaydi.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateInvite} className="space-y-3.5 text-left pt-1">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Tarbiyachi emaili <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="masalan: tarbiyachi@gmail.com"
                className={`no-shelf w-full rounded-xl border px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${ui.input}`}
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Kod aynan shu emailga biriktiriladi va boshqa email bilan ishlamaydi.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Izoh yoki Tarbiyachi ismi (Ixtiyoriy)
              </label>
              <input
                value={inviteForm.label}
                onChange={(e) => setInviteForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="masalan: 1-bino tarbiyachisi (Akram aka)"
                className={`no-shelf w-full rounded-xl border px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${ui.input}`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Amal qilish muddati (kun)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={inviteForm.expiryDays}
                onChange={(e) => setInviteForm((f) => ({ ...f, expiryDays: e.target.value }))}
                placeholder="14"
                className={`no-shelf w-full rounded-xl border px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${ui.input}`}
              />
            </div>

            <button
              type="submit"
              disabled={creatingInvite}
              className="no-shelf cursor-pointer w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 py-2.5 text-xs font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 mt-2"
            >
              {creatingInvite ? 'Yaratilmoqda...' : 'Kod yaratish'}
            </button>
          </form>
        )}
      </ConfirmModal>

      {/* 6. Revoke Invite Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(revokeTarget)}
        title="Taklif kodini bekor qilish"
        description={revokeTarget ? `${revokeTarget.email || 'Ushbu taklif kodi'} bekor qilinadi` : undefined}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevokeInvite}
        confirmText="Bekor qilish"
        confirmVariant="danger"
        isLoading={revoking}
      >
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Ushbu taklif kodi darhol bekor qilinadi va tarbiyachi undan foydalanib ro‘yxatdan o‘ta olmaydi.
        </p>
      </ConfirmModal>
    </div>
  )
}
