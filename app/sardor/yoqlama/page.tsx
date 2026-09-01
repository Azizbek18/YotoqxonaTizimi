'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ClipboardCheck, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getSafeUser, getAuthHeaders } from '@/lib/auth-session'
import AttendanceBoard from '@/components/attendance/AttendanceBoard'
import type { AttendanceState, RosterView } from '@/features/attendance/types'

export default function SardorYoqlamaPage() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<RosterView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadRoster = useCallback(async (sessionId: string) => {
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/attendance/roster?sessionId=${sessionId}`, { headers, cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Ro‘yxatni yuklab bo‘lmadi')
    setView(data as RosterView)
  }, [])

  const bootstrap = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!(await getSafeUser())) { window.location.href = '/login'; return }
      const headers = await getAuthHeaders()
      const res = await fetch('/api/attendance/session', { headers, cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Yo‘qlama holatini yuklab bo‘lmadi')
      const open = (data.sessions ?? [])[0]
      if (open) await loadRoster(open.id)
      else setView(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik')
    } finally {
      setLoading(false)
    }
  }, [loadRoster])

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
    } finally {
      setBusy(false)
    }
  }

  const mark = async (studentId: string, state: AttendanceState) => {
    if (!view) return
    const prev = view
    setView({
      ...view,
      rooms: view.rooms.map((room) => ({
        ...room,
        residents: room.residents.map((r) => (r.id === studentId ? { ...r, state } : r)),
      })),
    })
    try {
      const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' }
      const res = await fetch('/api/attendance/mark', {
        method: 'PATCH', headers,
        body: JSON.stringify({ sessionId: view.session.id, studentId, state }),
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
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/sardor/dashboard" className="mb-5 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-400 hover:bg-white/5">
          <ArrowLeft size={14} /> Panel
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
            <ClipboardCheck size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">Yo‘qlama</h1>
            <p className="text-xs text-slate-400">O‘z qavatingizdagi talabalarni belgilang</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500"><Loader2 className="animate-spin" /></div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5 text-sm text-rose-200">{error}</div>
        ) : view ? (
          <AttendanceBoard view={view} onMark={mark} onClose={closeSession} busy={busy} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-sm text-slate-300">Hozircha ochiq yo‘qlama yo‘q.</p>
            <button
              type="button"
              onClick={openSession}
              disabled={busy}
              className="mt-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? 'Ochilyapti…' : 'Yo‘qlama ochish'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
