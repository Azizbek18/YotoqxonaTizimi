'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Search, Loader2, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { dekanUI } from '@/lib/dekan-ui'
import { useThemeStore } from '@/lib/stores/theme-store'
import {
  PERMISSION_LABELS,
  permissionsForSubject,
  type PermissionKey,
  type PermissionMap,
  type PermissionSubject,
} from '@/features/permissions/types'

type Member = {
  id: string
  subject: PermissionSubject
  fullName: string
  detail: string
  permissions: PermissionMap
}

const SUBJECT_LABEL: Record<PermissionSubject, string> = {
  tarbiyachi: 'Tarbiyachi',
  sardor: 'Qavat sardori',
  raisi: 'Talaba kengashi raisi',
}

/**
 * Per-person rights, the way Telegram lets an owner tune each admin.
 *
 * Nothing here grants anything: every member starts with full access and the
 * dekan only ever takes rights away, so a switch that is ON is simply the
 * absence of a revocation. Turning one off closes that section for that
 * person outright — the menu entry disappears and the API answers 403.
 */
export default function MemberPermissionsCard({ delay = 0 }: { delay?: number }) {
  const isLight = useThemeStore((state) => state.theme === 'light')
  const ui = dekanUI(isLight)

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dekan/permissions', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Ro'yxatni yuklab bo'lmadi")
      setMembers(Array.isArray(data.members) ? data.members : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ro'yxatni yuklab bo'lmadi")
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) =>
      m.fullName.toLowerCase().includes(q) || m.detail.toLowerCase().includes(q))
  }, [members, query])

  const toggle = async (member: Member, key: PermissionKey) => {
    const wasAllowed = member.permissions[key] !== false
    const next: PermissionMap = { ...member.permissions }
    if (wasAllowed) next[key] = false
    else delete next[key]

    // Optimistic: the switch has to feel instant, and a failure restores it.
    setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, permissions: next } : m)))
    setSavingId(member.id)
    try {
      const res = await fetch('/api/dekan/permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, subject: member.subject, permissions: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Saqlab bo'lmadi")
      toast.success(
        wasAllowed
          ? `${PERMISSION_LABELS[key].title} — olib qo'yildi`
          : `${PERMISSION_LABELS[key].title} — qaytarildi`,
      )
    } catch (error) {
      setMembers((prev) => prev.map((m) => (m.id === member.id ? member : m)))
      toast.error(error instanceof Error ? error.message : "Saqlab bo'lmadi")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section
      className={`rounded-2xl border p-5 sm:p-6 ${ui.card}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`rounded-xl p-2.5 ${ui.accentTile}`}>
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3 className={`text-base font-bold ${ui.strong}`}>Ruxsatlar</h3>
            <p className={`mt-0.5 text-xs ${ui.muted}`}>
              Tarbiyachi va qavat sardorlarining huquqlarini istalgan vaqtda olib qo&apos;yish
              yoki qaytarish. Ruxsat olinganda bo&apos;lim ularga umuman ko&apos;rinmaydi.
            </p>
          </div>
        </div>

        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${ui.input}`}>
          <Search size={14} className={ui.muted} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ism bo'yicha qidirish…"
            className="w-40 bg-transparent text-sm outline-none sm:w-56"
          />
        </div>
      </div>

      {loading ? (
        <div className={`flex items-center justify-center gap-2 py-10 text-sm ${ui.muted}`}>
          <Loader2 size={16} className="animate-spin" /> Yuklanmoqda…
        </div>
      ) : filtered.length === 0 ? (
        <p className={`py-10 text-center text-sm ${ui.muted}`}>
          {members.length === 0
            ? "Fakultetda faol tarbiyachi yoki qavat sardori yo'q."
            : "Qidiruvga mos xodim topilmadi."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((member) => {
            const keys = permissionsForSubject(member.subject)
            const revoked = keys.filter((k) => member.permissions[k] === false).length
            return (
              <div key={`${member.subject}:${member.id}`} className={`rounded-xl border p-4 ${ui.inset}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-bold ${ui.strong}`}>{member.fullName}</p>
                    <p className={`truncate text-xs ${ui.muted}`}>
                      {SUBJECT_LABEL[member.subject]}
                      {member.detail ? ` · ${member.detail}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    revoked === 0
                      ? isLight ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                      : isLight ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                  }`}>
                    {revoked === 0 ? "To'liq huquq" : `${revoked} ta ruxsat olingan`}
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {keys.map((key) => {
                    const allowed = member.permissions[key] !== false
                    const busy = savingId === member.id
                    return (
                      <button
                        key={key}
                        type="button"
                        role="switch"
                        aria-checked={allowed}
                        disabled={busy}
                        onClick={() => void toggle(member, key)}
                        className={`no-shelf group flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70 ${
                          allowed
                            ? isLight
                              ? 'border-indigo-200 bg-indigo-50/40 hover:border-indigo-300 hover:bg-indigo-50/80'
                              : 'border-indigo-500/30 bg-indigo-500/[0.06] hover:border-indigo-400/50 hover:bg-indigo-500/10'
                            : isLight
                              ? 'border-slate-200 bg-slate-50/80 hover:border-slate-300'
                              : 'border-slate-700 bg-slate-900/30 hover:border-slate-600'
                        }`}
                        style={{ boxShadow: 'none' }}
                      >
                        {/* Tick painted via the SVG stroke attribute: the light-mode retrofit in
                            globals.css overrides text colours inside coloured surfaces. */}
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-200 ${
                            allowed
                              ? 'border-indigo-600 bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-600/30'
                              : isLight
                                ? 'border-slate-300 bg-white group-hover:border-indigo-400'
                                : 'border-slate-600 bg-slate-800 group-hover:border-indigo-400'
                          }`}
                        >
                          {busy ? (
                            <Loader2 size={13} strokeWidth={3} className="animate-spin" color={allowed ? '#ffffff' : '#6366f1'} />
                          ) : (
                            <Check
                              size={14}
                              strokeWidth={3.5}
                              color="#ffffff"
                              className={`transition-all duration-200 ${allowed ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className={`block text-xs font-bold ${allowed ? ui.strong : ui.muted}`}>
                              {PERMISSION_LABELS[key].title}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                allowed
                                  ? isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-300'
                                  : isLight ? 'bg-slate-200/80 text-slate-500' : 'bg-slate-700/60 text-slate-400'
                              }`}
                            >
                              {allowed ? 'Ruxsat' : 'Yopiq'}
                            </span>
                          </span>
                          <span className={`mt-1 block text-[11px] leading-snug ${ui.muted}`}>
                            {PERMISSION_LABELS[key].hint}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
