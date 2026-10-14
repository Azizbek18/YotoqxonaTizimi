'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ClipboardCheck, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { getSafeUser, getAuthHeaders } from '@/lib/auth-session'
import AttendanceBoard from '@/components/attendance/AttendanceBoard'
import LeavesPanel from '@/components/attendance/LeavesPanel'
import type { RosterView } from '@/features/attendance/types'
import LeaderBackdrop from '@/components/leader/LeaderBackdrop'
import { getLeaderTheme } from '@/components/leader/leader-theme'

export default function SardorYoqlamaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [view, setView] = useState<RosterView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadRoster = useCallback(async (sessionId: string) => {
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/attendance/roster?sessionId=${sessionId}`, { headers, cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Ro‘yxatni yuklab bo‘lmadi')
    setView(data as RosterView)
  }, [])

  const bootstrap = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      if (!(await getSafeUser())) {
        router.replace('/login')
        return
      }
      const headers = await getAuthHeaders()
      const res = await fetch('/api/attendance/session', { headers, cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Yo‘qlama holatini yuklab bo‘lmadi')
      const open = (data.sessions ?? [])[0]
      if (open) await loadRoster(open.id)
      else setView(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loadRoster, router])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  const t = getLeaderTheme('sardor')
  const isOpen = view?.session?.status === 'open'

  return (
    <div className="relative min-h-screen min-w-0 overflow-x-clip bg-[#070b13] text-slate-200">
      <LeaderBackdrop role="sardor" />

      <div className="relative z-10 mx-auto min-w-0 max-w-3xl space-y-4 px-2.5 py-4 min-[360px]:space-y-5 min-[360px]:px-4 min-[360px]:py-6">
        {/* Navigation Bar */}
        <div className="flex min-w-0 items-center justify-between gap-2">
          <Link
            href="/sardor/dashboard"
            data-student-button="plain"
            className="no-shelf inline-flex h-8 min-[360px]:h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 min-[360px]:px-3 text-xs font-black uppercase tracking-wider text-slate-400 backdrop-blur-xl transition hover:bg-white/10 hover:text-white active:scale-95"
          >
            <ArrowLeft size={13} className="shrink-0" />
            <span>Panel</span>
          </Link>

          <div className="flex items-center gap-1.5 min-[360px]:gap-2">
            {/* Live Indicator */}
            {isOpen && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Jonli
              </span>
            )}

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => bootstrap(true)}
              disabled={refreshing || loading}
              data-student-button="plain"
              className="no-shelf inline-flex h-8 min-[360px]:h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 min-[360px]:px-3 text-xs font-bold text-slate-300 backdrop-blur-xl transition hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-50"
              title="Yangilash"
            >
              <RefreshCw size={12} className={`shrink-0 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
              <span className="hidden min-[340px]:inline">Yangilash</span>
            </button>
          </div>
        </div>

        {/* Page Title & Medallion */}
        <div className="no-shelf relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-3 min-[340px]:p-3.5 min-[360px]:p-4 backdrop-blur-xl">
          <div className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-[50px] ${t.auroraA}`} />

          <div className="relative flex min-w-0 items-center gap-2.5 min-[360px]:gap-3.5">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white min-[360px]:h-11 min-[360px]:w-11 min-[360px]:rounded-2xl ${t.gradient} shadow-lg shadow-purple-900/30`}
            >
              <ClipboardCheck size={20} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="text-base font-black tracking-tight text-white min-[360px]:text-lg sm:text-xl">
                  Yo‘qlama Nazorati
                </h1>
                <span className="rounded-md border border-purple-500/30 bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-purple-300">
                  Sardor
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400 min-[360px]:text-xs">
                Qavatingizdagi talabalarning real vaqt yo‘qlama holati
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="space-y-4">
            <div className="no-shelf animate-pulse rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-purple-400" />
              <p className="mt-2 text-xs font-semibold text-slate-400">Yo‘qlama ma‘lumotlari yuklanmoqda...</p>
            </div>
          </div>
        ) : error ? (
          <div className="no-shelf rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-center backdrop-blur-xl min-[360px]:p-5">
            <AlertCircle size={24} className="mx-auto text-rose-400" />
            <h3 className="mt-2 text-sm font-bold text-rose-200">Xatolik yuz berdi</h3>
            <p className="mt-1 text-xs text-rose-300/80">{error}</p>
            <button
              type="button"
              onClick={() => bootstrap(false)}
              data-student-button="plain"
              className="no-shelf mt-3.5 inline-flex items-center gap-1.5 rounded-xl bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-500/30"
            >
              <RefreshCw size={12} /> Qayta urinish
            </button>
          </div>
        ) : view ? (
          <div className="space-y-4 min-w-0">
            <LeavesPanel isLight={false} showEmptyState={false} />
            <AttendanceBoard view={view} onMark={async () => {}} busy={false} />
          </div>
        ) : (
          <div className="space-y-4 min-w-0">
            <LeavesPanel isLight={false} showEmptyState={false} />

            <div className="no-shelf relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center backdrop-blur-xl min-[360px]:p-8">
              <div className={`pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-[60px] ${t.auroraA}`} />

              <div className="relative mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10 text-purple-400 shadow-inner">
                <ClipboardCheck size={24} />
              </div>

              <h2 className="relative text-sm font-bold text-white min-[360px]:text-base">
                Hozircha ochiq yo‘qlama yo‘q
              </h2>

              <p className="relative mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">
                Yo‘qlama dekanat belgilagan vaqtda avtomatik ochiladi. Shunda bu yerda qavatingizdagi talabalarning real vaqt
                tasdiqlash holati aks etadi.
              </p>

              <button
                type="button"
                onClick={() => bootstrap(true)}
                disabled={refreshing}
                data-student-button="plain"
                className="no-shelf relative mt-4 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={13} className={refreshing ? 'animate-spin text-purple-400' : ''} />
                <span>Qaytadan tekshirish</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
