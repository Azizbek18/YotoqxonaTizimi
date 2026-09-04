'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ClipboardCheck, AlertTriangle, ShieldAlert, RefreshCw, Users, UserCheck, UserX, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAuthHeaders } from '@/lib/auth-session'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI } from '@/lib/dekan-ui'
import { Skel } from '@/components/ui/skeletons'
import AttendanceBoard from '@/components/attendance/AttendanceBoard'
import type { AttendanceState, RosterView } from '@/features/attendance/types'

type Flag = { recordId: string; studentId: string; roomNumber: string; note: string | null; sessionDate: string }

export default function TarbiyachiYoqlamaPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<RosterView | null>(null)
  const [flags, setFlags] = useState<Flag[]>([])
  const [error, setError] = useState<string | null>(null)

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

  const s = view?.summary
  const stats = s
    ? [
        { label: 'Jami', value: s.total, icon: Users },
        { label: 'Hozir', value: s.present, icon: UserCheck },
        { label: 'Yo‘q', value: s.absent, icon: UserX },
        { label: 'Belgilanmagan', value: s.unmarked, icon: Clock },
      ]
    : []

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-6 sm:p-7"
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white">
              <ClipboardCheck size={22} />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Yo‘qlama</h1>
              <p className="mt-0.5 text-xs sm:text-sm text-indigo-100">Butun bino bo‘yicha kunlik nazorat</p>
            </div>
          </div>
          <button
            onClick={() => void bootstrap()}
            className="inline-flex items-center gap-2 rounded-xl bg-white/95 px-4 py-2.5 text-xs font-bold text-indigo-700 shadow-lg shadow-black/10 transition-transform hover:bg-white active:scale-95"
          >
            <RefreshCw size={14} /> Yangilash
          </button>
        </div>

        {s && (
          <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-100">
                  <stat.icon size={12} /> {stat.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : error ? (
        <div className={`flex items-start gap-3 rounded-2xl border p-5 text-sm ${
          isLight ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-rose-500/25 bg-rose-500/10 text-rose-200'
        }`}>
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">{error}</p>
            <button onClick={() => void bootstrap()} className={`mt-2 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${ui.dangerSoft}`}>
              Qayta urinish
            </button>
          </div>
        </div>
      ) : view ? (
        <AttendanceBoard view={view} onMark={mark} onClose={closeSession} busy={busy} />
      ) : (
        <div className={`rounded-2xl border p-10 text-center ${ui.card}`}>
          <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${ui.accentSoft}`}>
            <ClipboardCheck size={22} />
          </div>
          <p className={`text-sm font-medium ${ui.body}`}>Hozircha ochiq yo‘qlama yo‘q.</p>
          <p className={`mx-auto mt-1 max-w-sm text-xs ${ui.muted}`}>
            Kunlik yo‘qlama har kecha avtomatik ochiladi. Zarur bo‘lsa, hoziroq qo‘lda ochishingiz mumkin.
          </p>
          <button
            type="button" onClick={openSession} disabled={busy}
            className={`mt-4 rounded-xl px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 ${ui.accentSolid}`}
          >
            {busy ? 'Ochilyapti…' : 'Yo‘qlama ochish'}
          </button>
        </div>
      )}

      {flags.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border p-4 sm:p-5 ${ui.card}`}
        >
          <div className={`mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
            <AlertTriangle size={14} /> Sababsiz yo‘qlar — ko‘rib chiqing ({flags.length})
          </div>
          <div className="space-y-2">
            {flags.map((f) => (
              <div key={f.recordId} className={`flex flex-wrap items-center gap-2 rounded-xl border p-2.5 ${ui.inset}`}>
                <span className={`text-[13px] font-semibold ${ui.strong}`}>{f.roomNumber}-xona</span>
                <span className={`text-xs ${ui.muted}`}>{f.sessionDate}</span>
                <div className="ml-auto flex gap-2">
                  <button
                    type="button" onClick={() => resolveFlag(f.recordId, 'dismiss')}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${ui.btnGhost}`}
                  >
                    Sababli edi
                  </button>
                  <button
                    type="button" onClick={() => resolveFlag(f.recordId, 'warn')}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-500/90 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-rose-500"
                  >
                    <ShieldAlert size={12} /> Ogohlantirish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
