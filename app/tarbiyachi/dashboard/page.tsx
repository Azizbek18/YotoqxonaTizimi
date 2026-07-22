'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, BedDouble, Users } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'
import { getAuthHeaders } from '@/lib/auth-session'

type StatState = {
  students: number
  activeStudents: number
  warnings: number
}

export default function TarbiyachiDashboardPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const [stats, setStats] = useState<StatState>({ students: 0, activeStudents: 0, warnings: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const headers = await getAuthHeaders()
      const [studentsResponse, requestsResponse] = await Promise.all([
        fetch('/api/staff/students', { headers, cache: 'no-store' }),
        fetch('/api/staff/arizalar', { headers, cache: 'no-store' }),
      ])
      const [studentsPayload, requestsPayload] = await Promise.all([
        studentsResponse.json(),
        requestsResponse.json(),
      ])
      const studentRows = Array.isArray(studentsPayload.students) ? studentsPayload.students : []
      const requestRows = Array.isArray(requestsPayload.requests) ? requestsPayload.requests : []

      const students = studentRows.length
      const activeStudents = studentRows.filter((student: { status?: string }) => student.status === 'active').length

      setStats({
        students,
        activeStudents,
        warnings: requestRows.length,
      })
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-4">
      <h2 className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>Umumiy ko&apos;rsatkichlar</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Talabalar soni" value={loading ? '...' : stats.students} icon={<Users />} isLight={isLight} />
        <StatCard title="Faol talabalar" value={loading ? '...' : stats.activeStudents} icon={<BedDouble />} isLight={isLight} />
        <StatCard title="Jami arizalar" value={loading ? '...' : stats.warnings} icon={<AlertTriangle />} isLight={isLight} />
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, isLight }: { title: string; value: string | number; icon: React.ReactNode; isLight: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${isLight ? 'border-slate-200 bg-white/70' : 'border-white/10 bg-white/5'}`}>
      <div className={`mb-3 inline-flex rounded-xl border p-2 ${isLight ? 'border-slate-200 bg-slate-100 text-indigo-600' : 'border-white/10 bg-[#0f172a] text-indigo-300'}`}>{icon}</div>
      <p className={`text-xs uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{title}</p>
      <p className={`mt-1 text-3xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>{value}</p>
    </div>
  )
}
