'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Check, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { getAuthHeaders } from '@/lib/auth-session'

interface StaffAriza {
  id: string
  student_name: string
  text: string
  type: string
  level: 'info' | 'warning' | 'critical'
  status: string
  created_at: string | null
  response_date: string | null
}

const LEVEL_LABELS: Record<StaffAriza['level'], string> = {
  info: 'Info',
  warning: 'Ogohlantirish',
  critical: 'Muhim',
}

const LEVEL_COLORS = {
  info: { light: 'bg-blue-100 text-blue-700', dark: 'bg-blue-500/15 text-blue-300' },
  warning: { light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-500/15 text-amber-300' },
  critical: { light: 'bg-rose-100 text-rose-700', dark: 'bg-rose-500/15 text-rose-300' },
} as const

const STATUS_LABELS: Record<string, string> = {
  pending: 'Kutilmoqda',
  approved: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
}

const STATUS_COLORS: Record<string, { light: string; dark: string }> = {
  pending: { light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-500/15 text-amber-300' },
  approved: { light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-300' },
  rejected: { light: 'bg-rose-100 text-rose-700', dark: 'bg-rose-500/15 text-rose-300' },
}

export default function TarbiyachiArizalarPage() {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const [items, setItems] = useState<StaffAriza[]>([])
  const [scope, setScope] = useState<{ assigned_floor?: number | null; assigned_gender?: string | null }>({})
  const [level, setLevel] = useState<'all' | StaffAriza['level']>('all')
  const [status, setStatus] = useState<'all' | string>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const response = await fetch('/api/staff/arizalar', { headers: await getAuthHeaders() })
      const result = (await response.json()) as {
        ok: boolean
        requests?: StaffAriza[]
        scope?: { assigned_floor?: number | null; assigned_gender?: string | null }
        error?: string
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? 'Arizalarni yuklashda xato')
      }

      setItems(result.requests ?? [])
      setScope(result.scope ?? {})
    } catch (error) {
      console.error('Tarbiyachi arizalar yuklashda xato:', error)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleDecision = async (id: string, nextStatus: 'approved' | 'rejected') => {
    setActingId(id)
    try {
      const response = await fetch('/api/staff/arizalar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ id, status: nextStatus }),
      })
      const result = await response.json() as { ok: boolean; error?: string }
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? 'Holatni yangilashda xato')
      }

      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)))
      toast.success(nextStatus === 'approved' ? 'Ariza tasdiqlandi' : 'Ariza rad etildi')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Holatni yangilashda xato')
    } finally {
      setActingId(null)
    }
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return items.filter((item) => {
      const matchesLevel = level === 'all' || item.level === level
      const matchesStatus = status === 'all' || item.status === status
      const matchesQuery = !normalized ||
        item.student_name.toLowerCase().includes(normalized) ||
        item.text.toLowerCase().includes(normalized)
      return matchesLevel && matchesStatus && matchesQuery
    })
  }, [items, level, status, query])

  const cardBorder = isLight ? 'border-slate-200' : 'border-white/10'
  const cardBg = isLight ? 'bg-white/70' : 'bg-white/5'
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'
  const inputCls = isLight
    ? 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
    : 'border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-indigo-500/50'

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={`text-2xl font-black ${textStrong}`}>Arizalar nazorati</h2>
          <p className={`mt-1 text-sm ${textMuted}`}>
            {scope.assigned_floor ? `${scope.assigned_floor}-qavat` : 'Barcha qavatlar'} · {scope.assigned_gender || 'barcha jinslar'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Talaba yoki matn bo'yicha qidirish..."
              className={`rounded-xl border py-2 pl-8 pr-3 text-sm outline-none transition-colors ${inputCls}`}
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`rounded-xl border px-3 py-2 text-sm transition-colors ${inputCls}`}
          >
            <option value="all">Barcha holatlar</option>
            <option value="pending">Kutilmoqda</option>
            <option value="approved">Tasdiqlangan</option>
            <option value="rejected">Rad etilgan</option>
          </select>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as 'all' | StaffAriza['level'])}
            className={`rounded-xl border px-3 py-2 text-sm transition-colors ${inputCls}`}
          >
            <option value="all">Barcha darajalar</option>
            <option value="info">Info</option>
            <option value="warning">Ogohlantirish</option>
            <option value="critical">Muhim</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className={`flex items-center justify-center gap-2 rounded-2xl border p-10 text-sm ${cardBorder} ${cardBg} ${textMuted}`}>
          <Loader2 size={16} className="animate-spin" />
          Yuklanmoqda...
        </div>
      ) : loadError ? (
        <div className={`rounded-2xl border p-6 text-center text-sm ${isLight ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-rose-500/20 bg-rose-500/5 text-rose-300'}`}>
          Arizalarni yuklab bo&apos;lmadi.{' '}
          <button onClick={load} className="font-bold underline underline-offset-2">
            Qayta urinish
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.id} className={`rounded-2xl border p-4 ${cardBorder} ${cardBg}`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className={`font-bold ${textStrong}`}>{item.student_name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${isLight ? LEVEL_COLORS[item.level].light : LEVEL_COLORS[item.level].dark}`}>
                    {LEVEL_LABELS[item.level]}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    STATUS_COLORS[item.status] ? (isLight ? STATUS_COLORS[item.status].light : STATUS_COLORS[item.status].dark) : (isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-500/15 text-slate-300')
                  }`}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </span>
                </div>
                {item.created_at && (
                  <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{new Date(item.created_at).toLocaleDateString('uz-UZ')}</span>
                )}
              </div>
              <p className={`text-sm whitespace-pre-wrap ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{item.text}</p>

              {item.status === 'pending' && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleDecision(item.id, 'approved')}
                    disabled={actingId === item.id}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                  >
                    <Check size={12} /> Tasdiqlash
                  </button>
                  <button
                    onClick={() => handleDecision(item.id, 'rejected')}
                    disabled={actingId === item.id}
                    className="flex items-center gap-1 rounded-lg bg-rose-600 hover:bg-rose-700 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                  >
                    <X size={12} /> Rad etish
                  </button>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className={`rounded-2xl border p-8 text-center text-sm ${cardBorder} ${cardBg} ${textMuted}`}>
              Hozircha arizalar yo&apos;q.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
