'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Monitor, Smartphone, Tablet, ShieldAlert, Loader2, LogOut, Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getAuthHeaders } from '@/lib/auth-session'

type DeviceSession = {
  id: string
  device: string
  browser: string
  os: string
  ip: string | null
  createdAt: string
  lastActiveAt: string
  current: boolean
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60_000)
  if (m < 1) return 'hozir'
  if (m < 60) return `${m} daqiqa oldin`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} soat oldin`
  const d = Math.round(h / 24)
  return `${d} kun oldin`
}

function Icon({ device }: { device: string }) {
  if (/iphone|telefon/i.test(device)) return <Smartphone size={18} />
  if (/ipad|planshet/i.test(device)) return <Tablet size={18} />
  return <Monitor size={18} />
}

export default function ActiveSessionsCard({
  isLight,
  onCompromised,
}: {
  isLight: boolean
  onCompromised?: () => void
}) {
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmOthers, setConfirmOthers] = useState(false)
  const [warned, setWarned] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/account/sessions', { headers: await getAuthHeaders(), cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setSessions(data.sessions ?? [])
      else setSessions([])
    } catch { setSessions([]) }
  }, [])

  useEffect(() => { load() }, [load])

  const revoke = async (id: string) => {
    setBusy(id)
    try {
      const res = await fetch('/api/account/sessions', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', sessionId: id }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Xatolik')
      setSessions((s) => (s ?? []).filter((x) => x.id !== id))
      toast.success('Qurilma chiqarildi')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik')
    } finally { setBusy(null) }
  }

  const revokeOthers = async () => {
    setBusy('others')
    try {
      const res = await fetch('/api/account/sessions', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke-others' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Xatolik')
      setConfirmOthers(false)
      setWarned(true)
      await load()
      toast.success(`${data.revoked} ta qurilma chiqarildi`)
      onCompromised?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik')
    } finally { setBusy(null) }
  }

  if (sessions === null) {
    return (
      <div className={`flex items-center gap-2 rounded-2xl border p-4 text-sm ${isLight ? 'border-slate-200 bg-white text-slate-500' : 'border-white/10 bg-white/5 text-slate-400'}`}>
        <Loader2 size={15} className="animate-spin" /> Ulangan qurilmalar yuklanmoqda…
      </div>
    )
  }

  const others = sessions.filter((s) => !s.current)
  const card = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'
  const muted = isLight ? 'text-slate-500' : 'text-slate-400'

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${card}`}>
      <div className="mb-3 flex items-center gap-2">
        <Monitor size={16} className={isLight ? 'text-slate-500' : 'text-slate-400'} />
        <h3 className={`text-sm font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>Ulangan qurilmalar</h3>
      </div>

      {warned && (
        <div className={`mb-3 flex items-start gap-2 rounded-xl border p-3 text-xs ${isLight ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-amber-500/25 bg-amber-500/10 text-amber-200'}`}>
          <ShieldAlert size={15} className="mt-0.5 shrink-0" />
          <span>Boshqa qurilmalar chiqarildi. Xavfsizlik uchun <b>parolingizni hoziroq o‘zgartiring</b>.</span>
        </div>
      )}

      <div className="space-y-2">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`flex items-center gap-3 rounded-xl border p-3 ${
              s.current
                ? (isLight ? 'border-emerald-200 bg-emerald-50/60' : 'border-emerald-500/20 bg-emerald-500/5')
                : (isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.03]')
            }`}
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-slate-300'}`}>
              <Icon device={s.device} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-[13px] font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {s.browser} · {s.os}
                {s.current && (
                  <span className={`ml-2 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase ${isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-300'}`}>
                    <Check size={9} /> Bu qurilma
                  </span>
                )}
              </p>
              <p className={`truncate text-[11px] ${muted}`}>
                {s.device}{s.ip ? ` · ${s.ip}` : ''} · {relative(s.lastActiveAt)}
              </p>
            </div>
            {!s.current && (
              <button
                type="button"
                onClick={() => revoke(s.id)}
                disabled={busy === s.id}
                className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide disabled:opacity-40 ${isLight ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'border-white/15 text-slate-300 hover:bg-white/10'}`}
              >
                {busy === s.id ? <Loader2 size={12} className="animate-spin" /> : 'Chiqarish'}
              </button>
            )}
          </div>
        ))}
      </div>

      {others.length > 0 && (
        <div className="mt-3">
          {confirmOthers ? (
            <div className={`rounded-xl border p-3 ${isLight ? 'border-rose-200 bg-rose-50' : 'border-rose-500/25 bg-rose-500/10'}`}>
              <p className={`text-xs ${isLight ? 'text-rose-800' : 'text-rose-200'}`}>
                Barcha boshqa qurilmalar tizimdan chiqariladi. Keyin parolingizni o‘zgartirish tavsiya etiladi.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={revokeOthers}
                  disabled={busy === 'others'}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {busy === 'others' ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
                  Ha, hammasini chiqar
                </button>
                <button
                  onClick={() => setConfirmOthers(false)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${isLight ? 'border-slate-300 text-slate-600' : 'border-white/15 text-slate-300'}`}
                >
                  Bekor
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmOthers(true)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-black uppercase tracking-wide ${isLight ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' : 'border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15'}`}
            >
              <ShieldAlert size={13} /> Bu men emasman — boshqa qurilmalardan chiqish
            </button>
          )}
        </div>
      )}
    </div>
  )
}
