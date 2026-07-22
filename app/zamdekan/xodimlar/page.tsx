'use client'

import { useEffect, useState } from 'react'
import { UserPlus, Mail, Phone, RotateCcw, Shield, UserCog } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useThemeStore } from '@/lib/stores/theme-store'
import { fetchStaffAccounts, createStaffAccount } from '@/features/staff-accounts/client/api'
import type { ManagedStaffRole, StaffAccountRow } from '@/features/staff-accounts/types'

const ROLE_LABELS: Record<ManagedStaffRole, string> = {
  admin: 'Admin',
  tarbiyachi: 'Tarbiyachi',
}

const ROLE_COLORS: Record<ManagedStaffRole, string> = {
  admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  tarbiyachi: 'bg-green-500/20 text-green-400 border-green-500/30',
}

const initialForm = {
  fullName: '',
  email: '',
  phone: '',
  role: 'tarbiyachi' as ManagedStaffRole,
  password: '',
  confirmPassword: '',
}

export default function ZamdekanXodimlarPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const [staff, setStaff] = useState<StaffAccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(initialForm)

  const cardSurface = isLight ? 'bg-white/80 border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/10'
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'
  const inputCls = isLight
    ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-purple-500/50'
    : 'bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-purple-500/50'

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

  useEffect(() => {
    void loadStaff()
  }, [])

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

    setCreating(true)
    try {
      await createStaffAccount(form)
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
          <h1 className={`flex items-center gap-3 text-2xl font-black tracking-tighter sm:text-3xl ${textStrong}`}>
            <div className="rounded-2xl bg-purple-500/10 p-2 text-purple-400 border border-purple-500/20">
              <UserCog size={26} />
            </div>
            Xodimlar
          </h1>
          <p className={`mt-2 text-sm ${textMuted}`}>Admin va tarbiyachi akkauntlarini shu yerdan qo&apos;shing</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-purple-500/20 active:scale-[0.98] transition-all"
          >
            <UserPlus size={16} />
            Xodim qo&apos;shish
          </button>
          <button
            onClick={loadStaff}
            disabled={loading}
            className={`inline-flex items-center justify-center p-3 rounded-xl border transition-all disabled:opacity-50 ${isLight ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
            title="Yangilash"
          >
            <RotateCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:max-w-md">
        {[
          { label: 'Adminlar', count: staff.filter((s) => s.role === 'admin').length, color: 'from-red-500 to-rose-600', icon: Shield },
          { label: 'Tarbiyachilar', count: staff.filter((s) => s.role === 'tarbiyachi').length, color: 'from-green-500 to-emerald-600', icon: UserCog },
        ].map((stat) => (
          <div key={stat.label} className={`relative overflow-hidden flex items-center gap-3 rounded-2xl border p-4 pt-5 ${cardSurface}`}>
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${stat.color}`} />
            <div className={`h-11 w-11 shrink-0 rounded-xl bg-gradient-to-tr ${stat.color} flex items-center justify-center text-white shadow-lg`}>
              <stat.icon size={19} strokeWidth={2.2} />
            </div>
            <div>
              <p className={`text-[9px] font-black uppercase tracking-wider ${textMuted}`}>{stat.label}</p>
              <p className={`text-lg font-black leading-none mt-0.5 ${textStrong}`}>{stat.count}</p>
            </div>
          </div>
        ))}
      </div>

      <div className={`rounded-2xl border p-2 sm:p-4 ${cardSurface}`}>
        {loading ? (
          <div className="flex items-center justify-center p-10">
            <div className={`animate-spin rounded-full h-7 w-7 border-t-2 ${isLight ? 'border-purple-600' : 'border-purple-400'}`} />
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500'}`}>
              <UserCog size={22} />
            </div>
            <p className={`text-sm font-bold ${textMuted}`}>Hozircha admin yoki tarbiyachi akkounti yo&apos;q.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {staff.map((row) => (
              <div
                key={row.id}
                className={`flex flex-col gap-3 rounded-xl border p-4 transition-all sm:flex-row sm:items-center sm:justify-between ${isLight ? 'border-slate-200 bg-slate-50/60 hover:border-slate-300' : 'border-white/5 bg-white/[0.02] hover:border-white/10'}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    row.role === 'admin' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
                  }`}>
                    {row.full_name.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`truncate text-sm font-bold ${textStrong}`}>{row.full_name}</p>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${ROLE_COLORS[row.role]}`}>
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
        isOpen={addModalOpen}
        title="Yangi xodim qo'shish"
        description="Admin yoki tarbiyachi akkountini to'g'ridan-to'g'ri parol bilan yarating"
        onClose={() => {
          setAddModalOpen(false)
          setForm(initialForm)
        }}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, role: 'tarbiyachi' }))}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${form.role === 'tarbiyachi' ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md shadow-green-500/25' : isLight ? 'border border-slate-200 text-slate-500' : 'border border-white/10 text-slate-400'}`}
            >
              <UserCog size={14} /> Tarbiyachi
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, role: 'admin' }))}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${form.role === 'admin' ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-md shadow-red-500/25' : isLight ? 'border border-slate-200 text-slate-500' : 'border border-white/10 text-slate-400'}`}
            >
              <Shield size={14} /> Admin
            </button>
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
            className="w-full h-11 rounded-xl bg-linear-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-purple-500/10 transition-all disabled:opacity-50 active:scale-95"
          >
            {creating ? 'Yaratilmoqda...' : "Xodim yaratish"}
          </button>
        </form>
      </ConfirmModal>
    </div>
  )
}
