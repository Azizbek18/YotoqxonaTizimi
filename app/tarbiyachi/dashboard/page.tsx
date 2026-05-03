'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, BedDouble, Users } from 'lucide-react'

type StatState = {
  students: number
  activeStudents: number
  warnings: number
}

export default function TarbiyachiDashboardPage() {
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
      <h2 className="text-2xl font-black">Umumiy ko&apos;rsatkichlar</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Talabalar soni" value={loading ? '...' : stats.students} icon={<Users />} />
        <StatCard title="Faol talabalar" value={loading ? '...' : stats.activeStudents} icon={<BedDouble />} />
        <StatCard title="Ariza va ogohlantirish" value={loading ? '...' : stats.warnings} icon={<AlertTriangle />} />
      </div>
    </div>
  )
}

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-3 inline-flex rounded-xl border border-white/10 bg-[#0f172a] p-2 text-indigo-300">{icon}</div>
      <p className="text-xs uppercase tracking-wider text-slate-400">{title}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </div>
  )
}
