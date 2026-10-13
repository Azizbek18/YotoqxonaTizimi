'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ClipboardCheck, Loader2 } from 'lucide-react'
import { getSafeUser, getAuthHeaders } from '@/lib/auth-session'
import AttendanceBoard from '@/components/attendance/AttendanceBoard'
import LeavesPanel from '@/components/attendance/LeavesPanel'
import type { RosterView } from '@/features/attendance/types'
import LeaderBackdrop from '@/components/leader/LeaderBackdrop'
import { getLeaderTheme } from '@/components/leader/leader-theme'

export default function SardorYoqlamaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
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
      if (!(await getSafeUser())) { router.replace('/login'); return }
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
  }, [loadRoster, router])

  useEffect(() => { bootstrap() }, [bootstrap])

  // text-slate-200, not -100: the light-mode override in globals.css only
  // lists text-{slate,gray,…}-{200..700}, so an inherited -100 stayed pale —
  // moot now that this page is permanently dark (leader-theme shell), but
  // kept since AttendanceBoard itself may still be reached from a
  // light-mode-aware panel elsewhere.
  const t = getLeaderTheme('sardor')
  return (
    <div className="relative min-h-screen min-w-0 overflow-x-clip bg-[#070b13] text-slate-200">
      <LeaderBackdrop role="sardor" />
      <div className="relative z-10 mx-auto min-w-0 max-w-3xl px-3 py-4 min-[360px]:px-4 min-[360px]:py-6">
        <Link href="/sardor/dashboard" className="mb-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-400 backdrop-blur-xl transition-colors hover:bg-white/10 hover:text-white">
          <ArrowLeft size={14} /> Panel
        </Link>

        <div className="mb-5 flex min-w-0 items-center gap-3 min-[360px]:mb-6">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white min-[360px]:h-11 min-[360px]:w-11 min-[360px]:rounded-2xl ${t.gradient}`}>
            <ClipboardCheck size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black tracking-tight text-white min-[360px]:text-xl">Yo‘qlama</h1>
            <p className="text-[11px] leading-relaxed text-slate-400 min-[360px]:text-xs">Qavatingizda kim yo‘qlamada o‘zini tasdiqlagan, kim yo‘q — shuni ko‘rasiz</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500"><Loader2 className="animate-spin" /></div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5 text-sm text-rose-200">{error}</div>
        ) : view ? (
          <div className="space-y-4">
            <LeavesPanel isLight={false} />
            <AttendanceBoard view={view} onMark={async () => {}} busy={false} />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center backdrop-blur-xl min-[360px]:p-8">
            <p className="text-sm text-slate-300">Hozircha ochiq yo‘qlama yo‘q.</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">Yo‘qlamani tarbiyachi ochadi. U ochilgach, bu yerda qavatingizdagi holat ko‘rinadi.</p>
          </div>
        )}
      </div>
    </div>
  )
}
