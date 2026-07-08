'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { Student } from '@/lib/types'
import { useThemeStore } from '@/lib/stores/theme-store'
import { getAuthHeaders } from '@/lib/auth-session'

export default function TarbiyachiTalabalarPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const [students, setStudents] = useState<Student[]>([])
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<{ assigned_floor?: number | null; assigned_gender?: string | null }>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setLoadError(false)
      try {
        const response = await fetch('/api/staff/students', {
          headers: await getAuthHeaders()
        })
        const result = (await response.json()) as {
          ok: boolean
          students?: Student[]
          scope?: { assigned_floor?: number | null; assigned_gender?: string | null }
        }

        if (!response.ok || !result.ok) {
          throw new Error('load failed')
        }
        setStudents(result.students ?? [])
        setScope(result.scope ?? {})
      } catch (err) {
        console.error('Talabalarni yuklashda xato:', err)
        setLoadError(true)
      } finally {
        setLoading(false)
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

  const cardBorder = isLight ? 'border-slate-200' : 'border-white/10'
  const cardBg = isLight ? 'bg-white/70' : 'bg-white/5'
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className={`text-2xl font-black ${textStrong}`}>Talabalar ro&apos;yxati</h2>
          <p className={`mt-1 text-sm ${textMuted}`}>
            {scope.assigned_floor ? `${scope.assigned_floor}-qavat` : 'Barcha qavatlar'} | {scope.assigned_gender || 'barcha jinslar'}
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none transition-colors ${
              isLight
                ? 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
                : 'border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-indigo-500/50'
            }`}
            placeholder="Ism, fakultet yoki xona..."
          />
        </div>
      </div>

      {loading ? (
        <div className={`rounded-2xl border p-10 text-center text-sm ${cardBorder} ${cardBg} ${textMuted}`}>
          Yuklanmoqda...
        </div>
      ) : loadError ? (
        <div className={`rounded-2xl border p-6 text-center text-sm ${isLight ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-rose-500/20 bg-rose-500/5 text-rose-300'}`}>
          Talabalar ro&apos;yxatini yuklab bo&apos;lmadi. Sahifani qayta yuklang.
        </div>
      ) : (
        <div className={`overflow-hidden rounded-2xl border ${cardBorder}`}>
          <table className="w-full text-left text-sm">
            <thead className={`${cardBg} ${textMuted}`}>
              <tr>
                <th className="px-4 py-3">Talaba</th>
                <th className="px-4 py-3">Fakultet</th>
                <th className="px-4 py-3">Xona</th>
                <th className="px-4 py-3">Holat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.id} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                  <td className={`px-4 py-3 font-semibold ${textStrong}`}>{student.full_name}</td>
                  <td className={`px-4 py-3 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{student.faculty}</td>
                  <td className={`px-4 py-3 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{student.room_number || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs ${isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-300'}`}>{student.status}</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className={`px-4 py-8 text-center ${textMuted}`}>
                    {students.length === 0
                      ? scope.assigned_floor || scope.assigned_gender
                        ? `${scope.assigned_floor ? scope.assigned_floor + '-qavat' : 'Barcha qavatlar'} / ${scope.assigned_gender || 'barcha jinslar'} bo'yicha biriktirilgan talaba topilmadi. Agar bu noto'g'ri bo'lsa, adminga profilingizdagi qavat/jins sozlamasini tekshirishni so'rang.`
                        : "Sizga hali qavat yoki jins biriktirilmagan, shuning uchun barcha talabalar ko'rsatilmoqda — lekin ro'yxat bo'sh."
                      : "Qidiruvga mos talaba topilmadi."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
