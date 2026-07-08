'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, BedDouble, Users } from 'lucide-react'
import { useThemeStore } from '@/lib/stores/theme-store'

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
      const [studentsRes, warningsRes] = await Promise.all([
        supabase.from('users').select('id,status', { count: 'exact', head: false }).eq('role', 'talaba'),
        supabase.from('arizalar').select('id', { count: 'exact', head: true }),
      ])

      const students = studentsRes.count ?? 0
      const activeStudents = (studentsRes.data ?? []).filter((s) => s.status === 'active').length

      setStats({
        students,
        activeStudents,
        warnings: warningsRes.count ?? 0,
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
