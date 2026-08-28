'use client'

import { useEffect, useState } from 'react'
import { UserPlus, Mail, Phone, RotateCcw, UserCog, KeyRound, Copy, Trash2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useThemeStore } from '@/lib/stores/theme-store'
import { fetchStaffAccounts, createStaffAccount } from '@/features/staff-accounts/client/api'
import { fetchStaffInvites, createStaffInvite, revokeStaffInvite } from '@/features/staff-invites/client/api'
import type { StaffInviteRole, StaffInviteRow } from '@/features/staff-invites/types'
import { fetchAppSettings } from '@/features/app-settings/client/api'
import { adminUI, adminStatusChip, type AdminStatusTone } from '@/lib/admin-ui'
import type { ManagedStaffRole, StaffAccountRow } from '@/features/staff-accounts/types'

const ROLE_LABELS: Record<ManagedStaffRole, string> = {
  admin: 'Admin',
  tarbiyachi: 'Tarbiyachi',
}

const ROLE_TONE: Record<ManagedStaffRole, AdminStatusTone> = {
  admin: 'danger',
  tarbiyachi: 'info',
}

const initialForm = {
  fullName: '',
  email: '',
  phone: '',
  role: 'tarbiyachi' as ManagedStaffRole,
  password: '',
  confirmPassword: '',
  assignedFloor: '',
  assignedGender: '' as '' | 'male' | 'female',
}

export default function AdminXodimlarPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const [staff, setStaff] = useState<StaffAccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(initialForm)

  const [invites, setInvites] = useState<StaffInviteRow[]>([])
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ role: 'tarbiyachi' as StaffInviteRole, label: '', expiryDays: '14', maxUses: '' })
  const [newCode, setNewCode] = useState<string | null>(null)
  // null (not a guessed default) while settings are loading or unavailable —
  // a wrong guess here would set the input's native `max`, which the browser
  // enforces on submit and would block legitimate floors above the guess.
  const [floorCount, setFloorCount] = useState<number | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const settings = await fetchAppSettings()
        setFloorCount(settings.floorCount)
      } catch {
        toast.error("Qavatlar sozlamasini yuklab bo'lmadi — qavat cheklovi tekshirilmayapti")
      }
    })()
  }, [])

  const ui = adminUI(isLight)
  const cardSurface = ui.card
  const textMuted = ui.muted
  const textStrong = ui.strong
  const inputCls = `${ui.input} ${ui.ring}`

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
    setCreatingInvite(true)
    try {
      const created = await createStaffInvite({
        role: inviteForm.role,
        label: inviteForm.label.trim() || undefined,
        expiryDays: Number(inviteForm.expiryDays) || 14,
        maxUses: inviteForm.maxUses.trim() ? Number(inviteForm.maxUses) : null,
      })
      setNewCode(created.code)
      setInviteForm({ role: 'tarbiyachi', label: '', expiryDays: '14', maxUses: '' })
      void loadInvites()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Taklif kodini yaratib bo'lmadi")
    } finally {
      setCreatingInvite(false)
    }
  }

  const handleRevokeInvite = async (id: string) => {
    try {
      await revokeStaffInvite(id)
      toast.success('Taklif kodi bekor qilindi')
      void loadInvites()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bekor qilib bo'lmadi")
    }
  }

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Nusxa olindi')
    } catch {
      toast.error('Nusxa olib bo\'lmadi')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fullName || !form.email || !form.password) {
      toast.error("Majburiy maydonlarni to'ldiring")
      return
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Parollar bir xil emas')
      return
    }
    if (!form.assignedFloor || !form.assignedGender) {
      toast.error("Tarbiyachi uchun qavat va jins tanlanishi shart")
      return
    }

    setCreating(true)
    try {
      await createStaffAccount({
        ...form,
        assignedFloor: Number(form.assignedFloor),
        assignedGender: form.assignedGender,
      })
      toast.success("Xodim akkaunti yaratildi")
      setAddModalOpen(false)
      setForm(initialForm)
      void loadStaff()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xodim yaratib bo'lmadi")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={`flex items-center gap-3 text-2xl font-extrabold tracking-tight sm:text-3xl ${textStrong}`}>
            <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${ui.accentTile}`}>
              <UserCog size={22} strokeWidth={2.4} />
            </span>
            Tarbiyachilar
          </h1>
          <p className={`mt-2 text-sm ${textMuted}`}>Tarbiyachi akkauntlarini shu yerdan qo&apos;shing</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setAddModalOpen(true)}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-extrabold uppercase tracking-widest ${ui.accentSolid}`}
          >
            <UserPlus size={16} />
            Xodim qo&apos;shish
          </button>
          <button
            onClick={loadStaff}
            disabled={loading}
            className={`no-shelf inline-flex items-center justify-center p-3 rounded-xl border transition-all disabled:opacity-50 ${ui.btnGhost}`}
            title="Yangilash"
          >
            <RotateCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:max-w-xs">
        {[
          { label: 'Tarbiyachilar', count: staff.filter((s) => s.role === 'tarbiyachi').length, icon: UserCog },
        ].map((stat) => (
          <div key={stat.label} className={`flex items-center gap-3 rounded-2xl border p-4 ${cardSurface}`}>
            <div className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center ${ui.accentTile}`}>
              <stat.icon size={19} strokeWidth={2.3} />
            </div>
            <div>
              <p className={`text-[9px] font-extrabold uppercase tracking-wider ${textMuted}`}>{stat.label}</p>
              <p className={`text-lg font-extrabold leading-none mt-0.5 ${textStrong}`}>{stat.count}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Taklif kodlari ── */}
      <div className={`mb-6 rounded-2xl border p-4 sm:p-5 ${cardSurface}`}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className={`flex items-center gap-2 text-base font-extrabold ${textStrong}`}>
              <KeyRound size={16} /> Taklif kodlari
            </h2>
            <p className={`mt-1 text-xs ${textMuted}`}>
              Kodni tarbiyachi/co-dekanga bering — ular <span className="font-mono">/register/xodim</span> orqali ro&apos;yxatdan o&apos;tadi. Fakultet va rol koddan olinadi.
            </p>
          </div>
          <button
            onClick={() => { setNewCode(null); setInviteModalOpen(true) }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-widest ${ui.accentSolid}`}
          >
            <Plus size={14} /> Kod yaratish
          </button>
        </div>

        {invites.length === 0 ? (
          <p className={`py-4 text-center text-xs ${textMuted}`}>Hozircha taklif kodi yaratilmagan.</p>
        ) : (
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.id} className={`flex flex-col gap-2 rounded-xl border p-3 text-xs sm:flex-row sm:items-center sm:justify-between ${ui.inset}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${inv.role === 'dekan' ? 'bg-rose-500/15 text-rose-500' : 'bg-indigo-500/15 text-indigo-400'}`}>
                      {inv.role}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${inv.active ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-400'}`}>
                      {inv.active ? 'Faol' : inv.revokedAt ? 'Bekor qilingan' : 'Muddati tugagan'}
                    </span>
                    {inv.label && <span className={textStrong}>{inv.label}</span>}
                  </div>
                  <p className={`mt-1 ${textMuted}`}>
                    Muddat: {new Date(inv.expiresAt).toLocaleDateString('uz-UZ')} · Ishlatilgan: {inv.useCount}{inv.maxUses !== null ? ` / ${inv.maxUses}` : ''}
                  </p>
                </div>
                {inv.active && (
                  <button
                    onClick={() => handleRevokeInvite(inv.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${ui.btnGhost}`}
                  >
                    <Trash2 size={12} /> Bekor qilish
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`rounded-2xl border p-2 sm:p-4 ${cardSurface}`}>
        {loading ? (
          <div className="flex items-center justify-center p-10">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500'}`}>
              <UserCog size={22} />
            </div>
            <p className={`text-sm font-bold ${textMuted}`}>Hozircha tarbiyachi akkounti yo&apos;q.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {staff.map((row) => (
              <div
                key={row.id}
                className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${ui.inset}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${adminStatusChip(ROLE_TONE[row.role], isLight).chip}`}>
                    {row.full_name.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`truncate text-sm font-bold ${textStrong}`}>{row.full_name}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest ${adminStatusChip(ROLE_TONE[row.role], isLight).chip}`}>
                        {ROLE_LABELS[row.role]}
                      </span>
                    </div>
                    <div className={`mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs ${textMuted}`}>
                      <span className="inline-flex items-center gap-1.5"><Mail size={12} />{row.email}</span>
                      {row.phone_number && <span className="inline-flex items-center gap-1.5"><Phone size={12} />{row.phone_number}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-xs pl-[52px] sm:pl-0">
                  <span className={`rounded-full px-2.5 py-1 font-bold uppercase tracking-wider ${row.status === 'active' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-400'}`}>
                    {row.status === 'active' ? 'Faol' : row.status ?? "Noma'lum"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={inviteModalOpen}
        title="Taklif kodi"
        description="Kod bir marta ko'rsatiladi — nusxa oling va xodimga bering"
        onClose={() => { setInviteModalOpen(false); setNewCode(null) }}
      >
        {newCode ? (
          <div className="space-y-4 text-center">
            <div className={`rounded-xl border-2 border-dashed p-4 ${ui.accentBorder}`}>
              <p className={`font-mono text-xl font-black tracking-[0.2em] ${textStrong}`}>{newCode}</p>
            </div>
            <button
              onClick={() => copyCode(newCode)}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[10px] font-extrabold uppercase tracking-widest ${ui.accentSolid}`}
            >
              <Copy size={14} /> Nusxa olish
            </button>
            <p className={`text-[10px] ${textMuted}`}>Bu oyna yopilgach kod qayta ko&apos;rsatilmaydi.</p>
          </div>
        ) : (
          <form onSubmit={handleCreateInvite} className="space-y-4">
            <select
              value={inviteForm.role}
              onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value as StaffInviteRole }))}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none ${inputCls}`}
            >
              <option value="tarbiyachi">Tarbiyachi</option>
              <option value="dekan">Co-dekan</option>
            </select>
            <input
              value={inviteForm.label}
              onChange={(e) => setInviteForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Izoh (ixtiyoriy, masalan: 3-qavat tarbiyachisi)"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none ${inputCls}`}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number" min={1} max={60}
                value={inviteForm.expiryDays}
                onChange={(e) => setInviteForm((f) => ({ ...f, expiryDays: e.target.value }))}
                placeholder="Kun (muddat)"
                className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none ${inputCls}`}
              />
              <input
                type="number" min={1} max={500}
                value={inviteForm.maxUses}
                onChange={(e) => setInviteForm((f) => ({ ...f, maxUses: e.target.value }))}
                placeholder="Limit (ixtiyoriy)"
                className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none ${inputCls}`}
              />
            </div>
            <button
              type="submit"
              disabled={creatingInvite}
              className={`w-full h-11 rounded-xl uppercase tracking-widest text-[10px] ${ui.accentSolid}`}
            >
              {creatingInvite ? 'Yaratilmoqda...' : 'Kod yaratish'}
            </button>
          </form>
        )}
      </ConfirmModal>

      <ConfirmModal
        isOpen={addModalOpen}
        title="Yangi xodim qo'shish"
        description="Tarbiyachi akkountini to'g'ridan-to'g'ri parol bilan yarating"
        onClose={() => {
          setAddModalOpen(false)
          setForm(initialForm)
        }}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {/* Only tarbiyachi accounts can be created here — see
              features/staff-accounts/server/service.ts for why this
              creation flow is admin-only. */}
          <div className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-extrabold uppercase tracking-wider ${ui.accentSoft} ${ui.accentBorder} border`}>
            <UserCog size={14} /> Tarbiyachi
          </div>

          <input
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            placeholder="F.I.Sh"
            className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all ${inputCls}`}
            required
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Email"
            className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all ${inputCls}`}
            required
          />
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="Telefon (ixtiyoriy)"
            className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all ${inputCls}`}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={1}
              max={floorCount ?? undefined}
              value={form.assignedFloor}
              onChange={(e) => setForm((f) => ({ ...f, assignedFloor: e.target.value }))}
              placeholder={floorCount ? `Qavat (1-${floorCount})` : 'Qavat'}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all ${inputCls}`}
              required
            />
            <select
              value={form.assignedGender}
              onChange={(e) => setForm((f) => ({ ...f, assignedGender: e.target.value as 'male' | 'female' }))}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all ${inputCls}`}
              required
            >
              <option value="">Jinsi</option>
              <option value="male">Erkak</option>
              <option value="female">Ayol</option>
            </select>
          </div>
          <p className={`text-[10px] ${textMuted}`}>
            Tarbiyachi faqat shu qavat va jinsdagi talabalarni ko&apos;radi.
          </p>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Parol"
            className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all ${inputCls}`}
            required
          />
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            placeholder="Parolni tasdiqlang"
            className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all ${inputCls}`}
            required
          />

          <button
            type="submit"
            disabled={creating}
            className={`w-full h-11 rounded-xl uppercase tracking-widest text-[10px] ${ui.accentSolid}`}
          >
            {creating ? 'Yaratilmoqda...' : "Xodim yaratish"}
          </button>
        </form>
      </ConfirmModal>
    </div>
  )
}
