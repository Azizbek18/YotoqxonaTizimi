'use client'

import { useCallback, useEffect, useState } from 'react'
import { ClipboardCheck, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAuthHeaders } from '@/lib/auth-session'
import { useThemeStore } from '@/lib/stores/theme-store'
import AttendanceBoard from '@/components/attendance/AttendanceBoard'
import type { AttendanceState, RosterView } from '@/features/attendance/types'

type Flag = { recordId: string; studentId: string; roomNumber: string; note: string | null; sessionDate: string }

export default function TarbiyachiYoqlamaPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<RosterView | null>(null)
  const [flags, setFlags] = useState<Flag[]>([])
  const [error, setError] = useState<string | null>(null)

  const card = isLight ? 'border-slate-200 bg-white/80' : 'border-white/10 bg-white/5'

  const loadRoster = useCallback(async (sessionId: string) => {
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/attendance/roster?sessionId=${sessionId}`, { headers, cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Ro‘yxatni yuklab bo‘lmadi')
    setView(data as RosterView)
  }, [])

  const loadFlags = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/attendance/flags', { headers, cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setFlags(data.flags ?? [])
    } catch { /* non-critical */ }
  }, [])

  const bootstrap = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/attendance/session', { headers, cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Yo‘qlama holatini yuklab bo‘lmadi')
      const open = (data.sessions ?? [])[0]
      if (open) { await loadRoster(open.id); await loadFlags() }
      else setView(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik')
    } finally {
      setLoading(false)
    }
  }, [loadRoster, loadFlags])

  useEffect(() => { bootstrap() }, [bootstrap])

  const openSession = async () => {
    setBusy(true)
    try {
      const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' }
      const res = await fetch('/api/attendance/session', { method: 'POST', headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Yo‘qlamani ochib bo‘lmadi')
      setView(data as RosterView)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik')
    } finally { setBusy(false) }
  }

  const mark = async (studentId: string, state: AttendanceState) => {
    if (!view) return
    const prev = view
    setView({
      ...view,
      rooms: view.rooms.map((room) => ({
        ...room, residents: room.residents.map((r) => (r.id === studentId ? { ...r, state } : r)),
      })),
    })
    try {
      const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' }
      const res = await fetch('/api/attendance/mark', {
        method: 'PATCH', headers, body: JSON.stringify({ sessionId: view.session.id, studentId, state }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Belgilanmadi')
      await loadRoster(view.session.id)
    } catch (err) {
      setView(prev)
      toast.error(err instanceof Error ? err.message : 'Belgilanmadi')
    }
  }

  const closeSession = async () => {
    if (!view) return
    setBusy(true)
    try {
      const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' }
      const res = await fetch('/api/attendance/close', {
        method: 'POST', headers, body: JSON.stringify({ sessionId: view.session.id }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Yopilmadi')
      toast.success('Yo‘qlama yakunlandi')
      await bootstrap()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yopilmadi')
    } finally { setBusy(false) }
  }

  const resolveFlag = async (recordId: string, action: 'warn' | 'dismiss') => {
    try {
      const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' }
      const res = await fetch('/api/attendance/flags', {
        method: 'POST', headers, body: JSON.stringify({ recordId, action }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Xatolik')
      setFlags((f) => f.filter((x) => x.recordId !== recordId))
      toast.success(action === 'warn' ? 'Ogohlantirish berildi' : 'Bekor qilindi')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik')
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isLight ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/15 text-indigo-300'}`}>
          <ClipboardCheck size={20} />
        </div>
        <div>
          <h1 className={`text-xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>Yo‘qlama</h1>
          <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Butun bino bo‘yicha</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-slate-500"><Loader2 className="animate-spin" /></div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5 text-sm text-rose-200">{error}</div>
      ) : view ? (
        <AttendanceBoard view={view} onMark={mark} onClose={closeSession} busy={busy} />
      ) : (
        <div className={`rounded-2xl border p-8 text-center ${card}`}>
          <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Hozircha ochiq yo‘qlama yo‘q.</p>
          <button
            type="button" onClick={openSession} disabled={busy}
            className="mt-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? 'Ochilyapti…' : 'Yo‘qlama ochish'}
          </button>
        </div>
      )}

      {flags.length > 0 && (
        <div className={`rounded-2xl border p-4 sm:p-5 ${card}`}>
          <div className={`mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
            <AlertTriangle size={14} /> Sababsiz yo‘qlar — ko‘rib chiqing ({flags.length})
          </div>
          <div className="space-y-2">
            {flags.map((f) => (
              <div key={f.recordId} className={`flex flex-wrap items-center gap-2 rounded-xl border p-2.5 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5'}`}>
                <span className={`text-[13px] font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{f.roomNumber}-xona</span>
                <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{f.sessionDate}</span>
                <div className="ml-auto flex gap-2">
                  <button
                    type="button" onClick={() => resolveFlag(f.recordId, 'dismiss')}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold uppercase ${isLight ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'border-white/10 text-slate-300 hover:bg-white/5'}`}
                  >
                    Sababli edi
                  </button>
                  <button
                    type="button" onClick={() => resolveFlag(f.recordId, 'warn')}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-500/90 px-2.5 py-1.5 text-[11px] font-bold uppercase text-white hover:bg-rose-500"
                  >
                    <ShieldAlert size={12} /> Ogohlantirish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
