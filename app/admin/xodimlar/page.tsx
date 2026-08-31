'use client'

import { useEffect, useState } from 'react'
import { Mail, Phone, RotateCcw, UserCog, KeyRound, Copy, Trash2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Loader } from '@/components/ui/Loader'
import { useThemeStore } from '@/lib/stores/theme-store'
import { fetchStaffAccounts } from '@/features/staff-accounts/client/api'
import { fetchStaffInvites, createStaffInvite, revokeStaffInvite } from '@/features/staff-invites/client/api'
import type { StaffInviteRow } from '@/features/staff-invites/types'
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

const initialInviteForm = { email: '', label: '', expiryDays: '14' }

export default function AdminXodimlarPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const [staff, setStaff] = useState<StaffAccountRow[]>([])
  const [loading, setLoading] = useState(true)

  const [invites, setInvites] = useState<StaffInviteRow[]>([])
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState(initialInviteForm)
  const [newCode, setNewCode] = useState<string | null>(null)

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
    if (!/^\S+@\S+\.\S+$/.test(inviteForm.email.trim())) {
      toast.error("Email noto'g'ri")
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
      setInviteForm(initialInviteForm)
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
          <p className={`mt-2 text-sm ${textMuted}`}>
            Tarbiyachi emailini kiriting — u uchun bir martalik taklif kodi yaratiladi
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { setNewCode(null); setInviteForm(initialInviteForm); setInviteModalOpen(true) }}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-extrabold uppercase tracking-widest ${ui.accentSolid}`}
          >
            <Plus size={16} />
            Kod yaratish
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
              Kod aynan siz kiritgan emailga bog&apos;lanadi va bir martalik. Tarbiyachi
              <span className="font-mono"> /register/xodim</span> orqali F.I.Sh., telefon, jins va parolini
              o&apos;zi kiritadi — email va fakultet koddan olinadi.
            </p>
          </div>
          <button
            onClick={() => { setNewCode(null); setInviteForm(initialInviteForm); setInviteModalOpen(true) }}
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
                      {inv.active ? 'Faol' : inv.revokedAt ? 'Bekor qilingan' : inv.useCount > 0 ? 'Ishlatilgan' : 'Muddati tugagan'}
                    </span>
                    {inv.email && <span className={`truncate font-semibold ${textStrong}`}>{inv.email}</span>}
                    {inv.label && <span className={textMuted}>· {inv.label}</span>}
                  </div>
                  <p className={`mt-1 ${textMuted}`}>
                    Muddat: {new Date(inv.expiresAt).toLocaleDateString('uz-UZ')}
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
            <Loader size={88} />
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
        description="Kod bir marta ko'rsatiladi — nusxa oling va tarbiyachiga bering"
        onClose={() => { setInviteModalOpen(false); setNewCode(null); setInviteForm(initialInviteForm) }}
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
            <input
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Tarbiyachi emaili"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none ${inputCls}`}
              required
            />
            <input
              value={inviteForm.label}
              onChange={(e) => setInviteForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Izoh (ixtiyoriy, masalan: ismi)"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none ${inputCls}`}
            />
            <input
              type="number" min={1} max={60}
              value={inviteForm.expiryDays}
              onChange={(e) => setInviteForm((f) => ({ ...f, expiryDays: e.target.value }))}
              placeholder="Kun (muddat)"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none ${inputCls}`}
            />
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
    </div>
  )
}
