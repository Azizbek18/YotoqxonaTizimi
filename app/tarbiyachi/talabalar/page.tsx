'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { Student } from '@/lib/types'
import { supabase } from '@/lib/supabase'

export default function TarbiyachiTalabalarPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<{ assigned_floor?: number | null; assigned_gender?: string | null }>({})

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const authHeader: Record<string, string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}

      const response = await fetch('/api/staff/students', {
        headers: authHeader
      })
      const result = (await response.json()) as {
        ok: boolean
        students?: Student[]
        scope?: { assigned_floor?: number | null; assigned_gender?: string | null }
      }

      if (response.ok && result.ok) {
        setStudents(result.students ?? [])
        setScope(result.scope ?? {})
      }
    }

    load()
  }, [])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return students

    return students.filter(
      (student) =>
        student.full_name?.toLowerCase().includes(normalized) ||
        student.faculty?.toLowerCase().includes(normalized) ||
        student.room_number?.toLowerCase().includes(normalized),
    )
  }, [students, query])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Talabalar ro&apos;yxati</h2>
          <p className="mt-1 text-sm text-slate-400">
            {scope.assigned_floor ? `${scope.assigned_floor}-qavat` : 'Barcha qavatlar'} | {scope.assigned_gender || 'barcha jinslar'}
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm outline-none"
            placeholder="Ism, fakultet yoki xona..."
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-4 py-3">Talaba</th>
              <th className="px-4 py-3">Fakultet</th>
              <th className="px-4 py-3">Xona</th>
              <th className="px-4 py-3">Holat</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((student) => (
              <tr key={student.id} className="border-t border-white/5">
                <td className="px-4 py-3 font-semibold">{student.full_name}</td>
                <td className="px-4 py-3">{student.faculty}</td>
                <td className="px-4 py-3">{student.room_number || '-'}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300">{student.status}</span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  Talabalar topilmadi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
