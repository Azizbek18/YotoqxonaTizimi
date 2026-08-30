'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, Link2, Loader2, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { PERMIT_FACULTIES, permitFacultyLabel } from '@/lib/faculties'
import { dekanUI } from '@/lib/dekan-ui'
import { useThemeStore } from '@/lib/stores/theme-store'
import {
  createDeanInvite,
  fetchDeanInvites,
  revokeDeanInvite,
} from '@/features/staff-invites/client/api'
import type { CreatedStaffInvite, StaffInviteRow } from '@/features/staff-invites/types'

const registrationLink = (code: string) =>
  `${typeof window !== 'undefined' ? window.location.origin : ''}/register/dekan?code=${code}`

/**
 * Superadmin dean onboarding — replaces the SSH-only mint-dekan-invite.mjs.
 * `openFor` (a faculty code, or `''` for a blank form, or `null` = closed)
 * drives the create modal; the panel below always lists standing invites.
 * The parent owns `openFor`; use `onRequestOpen` to open it (e.g. from a
 * faculty card's "Dekan taklif qilish").
 */
export default function DeanInviteManager({
  openFor,
  coveredFaculties,
  onRequestOpen,
  onClose,
  onChanged,
}: {
  openFor: string | null
  coveredFaculties: Set<string>
  onRequestOpen: (faculty: string) => void
  onClose: () => void
  onChanged: () => void
}) {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  const [invites, setInvites] = useState<StaffInviteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<CreatedStaffInvite | null>(null)
  const [form, setForm] = useState({ faculty: '', email: '', expiryDays: 30 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setInvites(await fetchDeanInvites())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (openFor === null) return
    setForm({ faculty: openFor, email: '', expiryDays: 30 })
    setCreated(null)
  }, [openFor])

  const availableFaculties = useMemo(
    () => PERMIT_FACULTIES.filter((f) => !coveredFaculties.has(f.value)),
    [coveredFaculties],
  )
  const activeInvites = invites.filter((i) => i.active)

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Nusxa olindi')
    } catch {
      toast.error("Nusxa olib bo'lmadi")
    }
  }

  const submit = async () => {
    if (!form.faculty) return toast.error('Fakultetni tanlang')
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return toast.error("Email noto'g'ri")
    setBusy(true)
    try {
      const invite = await createDeanInvite({
        faculty: form.faculty,
        email: form.email.trim(),
        expiryDays: form.expiryDays,
      })
      setCreated(invite)
      toast.success('Taklif kodi yaratildi')
      await load()
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yaratib bo'lmadi")
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (id: string) => {
    try {
      await revokeDeanInvite(id)
      toast.success('Bekor qilindi')
      await load()
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bekor qilib bo'lmadi")
    }
  }

  return (
    <>
      <section className={`rounded-3xl border p-4 sm:p-5 ${ui.card}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${ui.accentTileSoft}`}>
              <ShieldCheck size={16} />
            </span>
            <div>
              <h3 className={`text-sm font-bold ${ui.strong}`}>Dekan taklif kodlari</h3>
              <p className={`text-[11px] ${ui.muted}`}>
                {activeInvites.length > 0 ? `${activeInvites.length} ta faol kod` : 'Faol kod yo‘q'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onRequestOpen('')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wider ${ui.accentSolid}`}
          >
            <Plus size={13} /> Yangi taklif
          </button>
        </div>

        {loading ? (
          <p className={`mt-4 text-xs ${ui.muted}`}>Yuklanmoqda...</p>
        ) : activeInvites.length === 0 ? null : (
          <ul className="mt-4 space-y-2">
            {activeInvites.map((invite) => (
              <li key={invite.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 ${ui.inset}`}>
                <span className={`text-xs font-bold ${ui.strong}`}>{permitFacultyLabel(invite.faculty) || 'Umumiy'}</span>
                <span className={`min-w-0 flex-1 truncate text-[11px] ${ui.muted}`}>{invite.email || '—'}</span>
                <span className={`text-[10px] ${ui.faint}`}>{new Date(invite.expiresAt).toLocaleDateString('uz-UZ')}gача</span>
                <button
                  type="button"
                  onClick={() => revoke(invite.id)}
                  className="shrink-0 rounded-md p-1.5 text-rose-500 transition-colors hover:bg-rose-500/10"
                  aria-label="Bekor qilish"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {openFor !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
          <div className={`relative w-full max-w-md rounded-3xl border p-5 sm:p-6 shadow-2xl ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b1120] border-white/10'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className={`text-lg font-black ${ui.strong}`}>Dekan taklif qilish</h2>
                <p className={`mt-1 text-xs ${ui.muted}`}>Fakultetga bog‘langan, bir martalik ro‘yxatdan o‘tish kodi.</p>
              </div>
              <button type="button" onClick={onClose} className={`rounded-lg p-1.5 ${ui.muted}`}>
                <X size={16} />
              </button>
            </div>

            {created ? (
              <div className="mt-4 space-y-3">
                <div className={`rounded-2xl border p-4 text-center ${isLight ? 'border-emerald-200 bg-emerald-50' : 'border-emerald-500/25 bg-emerald-500/10'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>
                    Kod — faqat hozir ko‘rinadi
                  </p>
                  <p className={`mt-1 select-all text-xl font-black tracking-widest ${ui.strong}`}>{created.code}</p>
                </div>
                <button type="button" onClick={() => copy(registrationLink(created.code))} className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold ${ui.accentSolid}`}>
                  <Link2 size={14} /> Ro‘yxatdan o‘tish havolasini nusxalash
                </button>
                <button type="button" onClick={() => copy(created.code)} className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold ${ui.btnGhost}`}>
                  <Copy size={14} /> Faqat kodni nusxalash
                </button>
                <p className={`text-center text-[11px] ${ui.muted}`}>
                  {permitFacultyLabel(created.faculty)} · {created.email} · {new Date(created.expiresAt).toLocaleDateString('uz-UZ')}gача
                </p>
                <button type="button" onClick={onClose} className={`w-full rounded-xl border py-2.5 text-xs font-bold ${ui.btnGhost}`}>Yopish</button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${ui.muted}`}>Fakultet</label>
                  <select
                    value={form.faculty}
                    onChange={(e) => setForm((f) => ({ ...f, faculty: e.target.value }))}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${ui.input} ${ui.ring}`}
                  >
                    <option value="">— tanlang —</option>
                    {availableFaculties.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                  {availableFaculties.length === 0 && (
                    <p className={`mt-1 text-[11px] ${ui.muted}`}>Barcha fakultetда faol dekan bor.</p>
                  )}
                </div>
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${ui.muted}`}>Dekan emaili</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="dekan@example.com"
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${ui.input} ${ui.ring}`}
                  />
                </div>
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${ui.muted}`}>Amal qilish (kun)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={form.expiryDays}
                    onChange={(e) => setForm((f) => ({ ...f, expiryDays: Math.max(1, Math.min(60, Number(e.target.value) || 30)) }))}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${ui.input} ${ui.ring}`}
                  />
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={submit}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold uppercase tracking-wider disabled:opacity-50 ${ui.accentSolid}`}
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Taklif kodini yaratish
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
