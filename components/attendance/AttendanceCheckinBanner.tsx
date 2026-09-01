'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, ChevronRight } from 'lucide-react'
import { getAuthHeaders } from '@/lib/auth-session'

// Shown on the student dashboard only while a yo'qlama session is open for
// their building. Renders nothing otherwise.
export default function AttendanceCheckinBanner({ isLight }: { isLight: boolean }) {
  const [closesAt, setClosesAt] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const headers = await getAuthHeaders()
        const res = await fetch('/api/attendance/summary', { headers, cache: 'no-store' })
        const data = await res.json()
        if (alive && res.ok && data.hasOpen) setClosesAt(data.closesAt ?? null)
      } catch { /* silent — a missing dorm / config just hides the banner */ }
    })()
    return () => { alive = false }
  }, [])

  if (!closesAt) return null
  const time = new Date(closesAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })

  return (
    <Link
      href="/talaba/yoqlama"
      className={`flex items-center gap-3 rounded-2xl border p-4 transition ${
        isLight
          ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
          : 'border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/15'
      }`}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isLight ? 'bg-emerald-500 text-white' : 'bg-emerald-500/20 text-emerald-300'}`}>
        <MapPin size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-black ${isLight ? 'text-emerald-800' : 'text-emerald-200'}`}>Yo‘qlama boshlandi</p>
        <p className={`text-xs ${isLight ? 'text-emerald-700' : 'text-emerald-300/80'}`}>
          {time} gacha yotoqxonada ekanligingizni tasdiqlang
        </p>
      </div>
      <ChevronRight size={18} className={isLight ? 'text-emerald-600' : 'text-emerald-400'} />
    </Link>
  )
}
