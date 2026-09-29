'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  Clock,
  Copy,
  Download,
  Eye,
  GraduationCap,
  Home,
  IdCard,
  Info,
  LayoutGrid,
  List,
  Mail,
  Phone,
  PhoneCall,
  RefreshCw,
  Search,
  Send,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { apiRequest } from '@/lib/api-client'
import { Skel } from '@/components/dekan/Skeletons'
import { useThemeStore } from '@/lib/stores/theme-store'
import { dekanUI, statusChip } from '@/lib/dekan-ui'
import { directionLabel } from '@/lib/directions'
import { permitFacultyLabel } from '@/lib/faculties'
import { genderAccent, genderLabel, normalizeGender } from '@/lib/gender'

type KvTalaba = {
  id: string
  full_name: string
  email: string
  phone_number: string | null
  gender: string | null
  faculty?: string | null
  direction: string | null
  course: number | null
  group: string | null
  hemis_student_id: string | null
  status: string
  off_campus_verified_by?: string | null
  off_campus_verified_at?: string | null
  created_at: string
}

type SortOption = 'newest' | 'name-asc' | 'course-asc' | 'group-asc'
type ViewMode = 'cards' | 'table'

const DAY = 86_400_000

function initials(name: string) {
  return name.trim().split(/\s+/).map((part) => part[0] ?? '').slice(0, 2).join('').toUpperCase() || 'KT'
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('uz-UZ')
}

function formatFullDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('uz-UZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function timeAgo(value: string) {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return ''
  const days = Math.floor((Date.now() - time) / DAY)
  if (days <= 0) return 'bugun'
  if (days === 1) return 'kecha'
  if (days < 30) return `${days} kun oldin`
  const months = Math.floor(days / 30)
  return months < 12 ? `${months} oy oldin` : `${Math.floor(months / 12)} yil oldin`
}

function telegramLink(phone: string | null | undefined): string | null {
  if (!phone) return null
  const cleaned = phone.replace(/[^\d]/g, '')
  return cleaned.length >= 9 ? `https://t.me/+${cleaned}` : null
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/[^\d]/g, '')
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+998 (${digits.slice(3, 5)}) ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10, 12)}`
  }
  return phone
}

export default function KvTalabalarPage() {
  const isLight = useThemeStore((s) => s.theme) === 'light'
  const ui = dekanUI(isLight)

  const [students, setStudents] = useState<KvTalaba[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  // Filters & display state
  const [search, setSearch] = useState('')
  const [course, setCourse] = useState<number | 'all'>('all')
  const [gender, setGender] = useState<'all' | 'female' | 'male'>('all')
  const [direction, setDirection] = useState<'all' | string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  // Selected student for detail modal
  const [selectedStudent, setSelectedStudent] = useState<KvTalaba | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const data = await apiRequest<{ ok: true; pending: KvTalaba[]; active: KvTalaba[] }>('/api/dekan/kv-talabalar')
      setStudents([...data.pending, ...data.active].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ))
    } catch {
      setLoadFailed(true)
      toast.error("Ro'yxatni yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const copy = (text: string, label: string, key?: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => {
        toast.success(`${label} nusxalandi`)
        if (key) {
          setCopiedKey(key)
          setTimeout(() => setCopiedKey(null), 1800)
        }
      },
      () => toast.error("Nusxalab bo'lmadi"),
    )
  }

  // Unique lists for filters
  const courses = useMemo(
    () => [...new Set(students.map((s) => s.course).filter((c): c is number => typeof c === 'number'))].sort(),
    [students],
  )

  const directions = useMemo(() => {
    const set = new Set<string>()
    students.forEach((s) => {
      if (s.direction) set.add(s.direction)
    })
    return [...set].sort()
  }, [students])

  // Filtered & Sorted student list
  const list = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = students.filter((student) => {
      if (course !== 'all' && student.course !== course) return false
      if (gender !== 'all' && normalizeGender(student.gender) !== gender) return false
      if (direction !== 'all' && student.direction !== direction) return false
      if (!query) return true
      return [
        student.full_name,
        student.email,
        student.phone_number,
        student.hemis_student_id,
        student.group,
        directionLabel(student.direction),
      ].some((value) => (value ?? '').toLowerCase().includes(query))
    })

    return filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortBy === 'name-asc') {
        return a.full_name.localeCompare(b.full_name)
      }
      if (sortBy === 'course-asc') {
        return (a.course ?? 0) - (b.course ?? 0)
      }
      if (sortBy === 'group-asc') {
        return (a.group ?? '').localeCompare(b.group ?? '')
      }
      return 0
    })
  }, [students, search, course, gender, direction, sortBy])

  const filtering = search.trim() !== '' || course !== 'all' || gender !== 'all' || direction !== 'all'

  const resetFilters = () => {
    setSearch('')
    setCourse('all')
    setGender('all')
    setDirection('all')
    setSortBy('newest')
  }

  // Export to CSV for rectorate / youth affairs reporting
  const handleExportCSV = () => {
    if (list.length === 0) {
      toast.error("Eksport qilish uchun talabalar yo'q")
      return
    }
    // A field starting with = + - @ would run as a formula in Excel — prefix it.
    const cell = (value: unknown) => {
      const text = String(value ?? '')
      const safe = /^[=@]/.test(text) ? `'${text}` : text
      return `"${safe.replace(/"/g, '""')}"`
    }
    const headers = ['№', 'F.I.SH.', 'HEMIS ID', 'Jinsi', 'Kurs', 'Guruh', "Yo'nalish", 'Telefon', 'Email', "Ro'yxatdan o'tgan sana"]
    const rows = list.map((s, idx) => [
      idx + 1,
      cell(s.full_name),
      cell(s.hemis_student_id),
      cell(genderLabel(s.gender)),
      cell(s.course ? `${s.course}-kurs` : ''),
      cell(s.group),
      cell(directionLabel(s.direction)),
      cell(s.phone_number),
      cell(s.email),
      cell(formatDate(s.created_at)),
    ])
    const csv = '\uFEFF' + [headers.map(cell).join(','), ...rows.map((r) => r.join(','))].join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `kv_talabalar_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success(`${list.length} ta talaba CSV faylga yuklab olindi`)
  }

  // Copy structured list to clipboard
  const handleCopyList = () => {
    if (list.length === 0) return
    const text = list
      .map((s, idx) => `${idx + 1}. ${s.full_name} | HEMIS: ${s.hemis_student_id || '—'} | Kurs: ${s.course || '—'} | Guruh: ${s.group || '—'} | Tel: ${s.phone_number || '—'}`)
      .join('\n')
    void navigator.clipboard?.writeText(text).then(
      () => toast.success(`${list.length} ta talaba ro'yxati nusxalandi`),
      () => toast.error("Nusxalab bo'lmadi"),
    )
  }

  // Academic Statistics Calculation
  const femaleCount = students.filter((s) => normalizeGender(s.gender) === 'female').length
  const maleCount = students.filter((s) => normalizeGender(s.gender) === 'male').length
  const withHemisCount = students.filter((s) => Boolean(s.hemis_student_id)).length
  const withPhoneCount = students.filter((s) => Boolean(s.phone_number)).length

  // Course Breakdown
  const courseCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    students.forEach((s) => {
      if (s.course) counts[s.course] = (counts[s.course] ?? 0) + 1
    })
    return counts
  }, [students])
  // Always show 1–4; add any higher course actually present (5, 6…).
  const breakdownCourses = [...new Set([1, 2, 3, 4, ...courses])].sort((a, b) => a - b)

  const info = statusChip('info', isLight)
  const good = statusChip('success', isLight)

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Academic Hero & Institutional Command Bar */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-800 p-6 sm:p-8 text-white shadow-xl shadow-indigo-900/15">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(255,255,255,0.18),transparent_50%)]" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-white/5 blur-2xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur-md">
                <GraduationCap size={13} className="text-indigo-200" /> OTM Talabalar Monitoringi
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-[11px] font-bold text-indigo-200 backdrop-blur-md border border-indigo-400/30">
                <Home size={12} /> Kvartira & Ijara Sektori
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl text-white">
              KV-Talabalar Nazorati
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-indigo-100 sm:text-sm">
              Universitet yotoqxonasidan tashqarida — ijarada yoki shaxsiy kvartirada istiqomat qiluvchi talabalarning
              yashash joyi, akademik holati va aloqa ma&apos;lumotlari monitoringi. Ular yotoqxona o&apos;rinlariga da&apos;vogar emas.
            </p>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/95 px-3.5 py-2.5 text-xs font-bold text-indigo-700 shadow-lg shadow-black/10 transition-all hover:bg-white hover:scale-[1.02] active:scale-95 disabled:opacity-60"
              title="Ro'yxatni yangilash"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Yangilash</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={students.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-3.5 py-2.5 text-xs font-bold text-white border border-white/20 backdrop-blur-md transition-all hover:bg-white/25 active:scale-95 disabled:opacity-50"
              title="CSV (Excel) formatida yuklab olish"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <button
              type="button"
              onClick={handleCopyList}
              disabled={list.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-3.5 py-2.5 text-xs font-bold text-white border border-white/20 backdrop-blur-md transition-all hover:bg-white/25 active:scale-95 disabled:opacity-50"
              title="Filtrlangan ro'yxatni nusxalash"
            >
              <Copy size={14} />
              <span className="hidden sm:inline">Nusxalash</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Executive Academic Analytics Dashboard */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Students */}
        <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${ui.card}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>Jami KV-Talabalar</span>
              {loading ? (
                <Skel className="mt-2.5 h-8 w-16" />
              ) : (
                <div className="mt-1 flex items-baseline gap-2">
                  <p className={`text-3xl font-black tracking-tight ${ui.strong}`}>{students.length}</p>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">faol hisob</span>
                </div>
              )}
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25">
              <Users size={20} strokeWidth={2.2} />
            </div>
          </div>
          <p className={`mt-3 text-[11px] font-medium leading-relaxed ${ui.faint}`}>
            Fakultet bo&apos;yicha ijarada turuvchi talabalar ro&apos;yxati
          </p>
        </div>

        {/* Girls count */}
        <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${ui.card}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>Talaba qizlar</span>
              {loading ? (
                <Skel className="mt-2.5 h-8 w-16" />
              ) : (
                <div className="mt-1 flex items-baseline gap-2">
                  <p className={`text-3xl font-black tracking-tight ${ui.strong}`}>{femaleCount}</p>
                  <span className="text-[11px] font-semibold text-indigo-500">
                    {students.length ? Math.round((femaleCount / students.length) * 100) : 0}% ulush
                  </span>
                </div>
              )}
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25">
              <UserRound size={20} strokeWidth={2.2} />
            </div>
          </div>
          <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${students.length ? (femaleCount / students.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Boys count */}
        <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${ui.card}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>Talaba o&apos;g&apos;illar</span>
              {loading ? (
                <Skel className="mt-2.5 h-8 w-16" />
              ) : (
                <div className="mt-1 flex items-baseline gap-2">
                  <p className={`text-3xl font-black tracking-tight ${ui.strong}`}>{maleCount}</p>
                  <span className="text-[11px] font-semibold text-indigo-500">
                    {students.length ? Math.round((maleCount / students.length) * 100) : 0}% ulush
                  </span>
                </div>
              )}
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25">
              <UserRound size={20} strokeWidth={2.2} />
            </div>
          </div>
          <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${students.length ? (maleCount / students.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* HEMIS & Contact completeness */}
        <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${ui.card}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>Aloqa & HEMIS Bazasi</span>
              {loading ? (
                <Skel className="mt-2.5 h-8 w-16" />
              ) : (
                <div className="mt-1 flex items-baseline gap-2">
                  <p className={`text-3xl font-black tracking-tight ${ui.strong}`}>{withHemisCount}</p>
                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    {students.length ? Math.round((withHemisCount / students.length) * 100) : 0}% biriktirilgan
                  </span>
                </div>
              )}
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25">
              <IdCard size={20} strokeWidth={2.2} />
            </div>
          </div>
          <p className={`mt-3 text-[11px] font-medium leading-relaxed ${ui.faint}`}>
            {withPhoneCount} ta talabada telefon raqami mavjud
          </p>
        </div>
      </div>

      {/* Course Breakdown Bar (Interactive Quick-Filter) */}
      <div className={`p-4 rounded-2xl border ${ui.card}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2">
            <GraduationCap size={16} className="text-indigo-600 dark:text-indigo-400" />
            <span className={`text-xs font-bold ${ui.strong}`}>Kurslar bo&apos;yicha taqsimot</span>
          </div>
          <span className={`text-[11px] ${ui.muted}`}>Tezkor filtr uchun kursni tanlang</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {breakdownCourses.map((c) => {
            const count = courseCounts[c] || 0
            const isSelected = course === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCourse(isSelected ? 'all' : c)}
                className={`no-shelf flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? isLight
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-sm ring-2 ring-indigo-200'
                      : 'bg-indigo-500/20 border-indigo-500/50 text-white shadow-sm ring-2 ring-indigo-500/30'
                    : isLight
                      ? 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100 text-slate-700'
                      : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <div className="min-w-0">
                  <span className="text-[11px] font-bold block">{c}-kurs talabalari</span>
                  <span className={`text-[10px] ${ui.muted}`}>
                    {students.length ? Math.round((count / students.length) * 100) : 0}% ulush
                  </span>
                </div>
                <span className="text-base font-black px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 shadow-xs border border-slate-200/60 dark:border-slate-700">
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Multi-Dimensional Search & Filter Controller */}
      <div className={`p-4 sm:p-5 rounded-2xl border space-y-3.5 ${ui.card}`}>
        {/* Row 1: Search, View Mode, Sorting */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${ui.faint}`} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ism, HEMIS ID, telefon, guruh yoki yo'nalish..."
              className={`w-full rounded-xl border py-2.5 pl-10 pr-9 text-xs font-medium outline-none transition-all ${ui.input} ${ui.ring}`}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Qidiruvni tozalash"
                className={`no-shelf absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 ${ui.faint} hover:text-slate-700 dark:hover:text-slate-200`}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Right controls: View Toggle & Sort */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* View Mode Switch */}
            <div className={`flex items-center p-1 rounded-xl border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`no-shelf flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : `${ui.muted} hover:text-slate-900 dark:hover:text-white`
                }`}
                title="Kartalar ko'rinishi"
              >
                <LayoutGrid size={13} />
                <span className="hidden sm:inline">Kartalar</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`no-shelf flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : `${ui.muted} hover:text-slate-900 dark:hover:text-white`
                }`}
                title="Jadval ko'rinishi"
              >
                <List size={13} />
                <span className="hidden sm:inline">Jadval</span>
              </button>
            </div>

            {/* Sort selector */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Tartiblash usuli"
                className={`rounded-xl border py-2 pl-3 pr-8 text-xs font-bold cursor-pointer outline-none ${ui.input} ${ui.ring}`}
              >
                <option value="newest">Yangi qo&apos;shilganlar</option>
                <option value="name-asc">Alifbo bo&apos;yicha (A-Z)</option>
                <option value="course-asc">Kurs bo&apos;yicha (1→4)</option>
                <option value="group-asc">Guruh bo&apos;yicha</option>
              </select>
            </div>
          </div>
        </div>

        {/* Row 2: Secondary Quick Filter Chips (Course, Gender, Direction) */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          {/* Gender filter */}
          <div className="flex items-center gap-1">
            <span className={`text-[11px] font-bold mr-1 ${ui.muted}`}>Jinsi:</span>
            {(['all', 'female', 'male'] as const).map((g) => {
              const active = gender === g
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`no-shelf rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-colors ${
                    active
                      ? isLight
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200'
                      : `${ui.inset} ${ui.muted} hover:text-slate-800 dark:hover:text-slate-200`
                  }`}
                >
                  {g === 'all' ? 'Barchasi' : g === 'female' ? 'Qizlar' : "O'g'illar"}
                </button>
              )
            })}
          </div>

          {/* Direction selector if directions exist */}
          {directions.length > 0 && (
            <div className="flex items-center gap-1 ml-auto">
              <span className={`text-[11px] font-bold mr-1 hidden sm:inline ${ui.muted}`}>Yo&apos;nalish:</span>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                aria-label="Ta'lim yo'nalishi bo'yicha filter"
                className={`max-w-[200px] truncate rounded-lg border py-1 px-2.5 text-[11px] font-semibold outline-none ${ui.input} ${ui.ring}`}
              >
                <option value="all">Barcha yo&apos;nalishlar</option>
                {directions.map((d) => (
                  <option key={d} value={d}>
                    {directionLabel(d)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Results summary and reset button */}
          {filtering && (
            <button
              type="button"
              onClick={resetFilters}
              className={`no-shelf ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-indigo-500 hover:text-indigo-600 transition-colors`}
            >
              <X size={12} /> Filtrlarni tozalash
            </button>
          )}
        </div>

        {/* Results counter badge */}
        <div className="flex items-center justify-between text-xs pt-1">
          <p className={ui.muted}>
            Ko&apos;rsatilmoqda: <span className={`font-black ${ui.strong}`}>{list.length}</span> ta talaba
            {filtering && ` (jami ${students.length} tadan saralandi)`}
          </p>
          <span className={`text-[11px] ${ui.faint}`}>
            {viewMode === 'cards' ? "Kartalar rejimi" : "Jadval rejimi"}
          </span>
        </div>
      </div>

      {/* 4. Student List Content: Loading, Error, Empty, Cards or Table */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`rounded-2xl border p-5 space-y-4 ${ui.card}`}>
              <div className="flex items-center gap-3">
                <Skel className="h-12 w-12 rounded-2xl shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <Skel className="h-4 w-3/4" />
                  <Skel className="h-3 w-1/2" />
                </div>
              </div>
              <Skel className="h-14 w-full rounded-xl" />
              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Skel className="h-8 flex-1 rounded-xl" />
                <Skel className="h-8 w-8 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : loadFailed ? (
        <div className={`flex flex-col items-center rounded-3xl border px-6 py-14 text-center ${ui.card}`}>
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${statusChip('danger', isLight).chip}`}>
            <X size={26} />
          </div>
          <h3 className={`mt-4 text-base font-bold ${ui.strong}`}>Ro&apos;yxat yuklanmadi</h3>
          <p className={`mt-1 max-w-sm text-xs ${ui.muted}`}>
            Server bilan bog&apos;lanishda xatolik yuz berdi. Internetni tekshirib, qayta urinib ko&apos;ring.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className={`mt-5 rounded-xl px-5 py-2.5 text-xs font-bold ${ui.accentSolid}`}
          >
            Qayta urinish
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className={`flex flex-col items-center rounded-3xl border px-6 py-16 text-center ${ui.card}`}>
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${ui.accentTileSoft}`}>
            {filtering ? <Search size={28} /> : <Home size={28} />}
          </div>
          <h3 className={`mt-4 text-base font-bold ${ui.strong}`}>
            {filtering ? "Qidiruv bo'yicha hech qanday talaba topilmadi" : "Hozircha KV-talabalar ro'yxatdan o'tmagan"}
          </h3>
          <p className={`mt-1.5 max-w-md text-xs leading-relaxed ${ui.muted}`}>
            {filtering
              ? "Qidiruv so'zini yoki o'rnatilgan kurs/jins filtrlarini o'zgartirib ko'ring."
              : "Talabalar tizimga kirib, yotoqxona o'rniga «Kvartirada turish» bandini tanlab ro'yxatdan o'tishganda, ushbu sahifada avtomatik aks etadi."}
          </p>
          {filtering && (
            <button
              type="button"
              onClick={resetFilters}
              className={`mt-5 rounded-xl px-5 py-2.5 text-xs font-bold ${ui.btnGhost}`}
            >
              Barcha filtrlarni tozalash
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* 4A: Professional Educational Student Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {list.map((student) => {
            const accent = genderAccent(student.gender)
            const tg = telegramLink(student.phone_number)
            return (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`no-shelf group relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border transition-all duration-200 hover:-translate-y-1 p-4 sm:p-5 ${
                  ui.card
                } ${isLight ? 'hover:shadow-xl hover:border-indigo-300' : 'hover:shadow-2xl hover:border-indigo-500/40'}`}
              >
                {/* Ambient Soft Glow */}
                <div className={`pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full blur-[40px] opacity-40 group-hover:opacity-100 transition-opacity ${
                  isLight ? 'bg-indigo-200/50' : 'bg-indigo-600/15'
                }`} />

                <div>
                  {/* Top section: Avatar + Identity + Status */}
                  <div className="relative z-10 flex items-start gap-3.5 min-w-0">
                    {/* Squircle Avatar with gender ring */}
                    <div className="relative shrink-0">
                      <div className={`flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-2xl text-sm font-black shadow-sm ring-1.5 transition-transform group-hover:scale-105 ${
                        isLight
                          ? 'ring-slate-200 bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 text-white'
                          : 'ring-white/10 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-white'
                      }`}>
                        {initials(student.full_name)}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ${
                          isLight ? 'ring-white' : 'ring-slate-900'
                        } ${accent.dot}`}
                        title={genderLabel(student.gender)}
                      />
                    </div>

                    {/* Name & Academic Status */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <h3
                          className={`font-black text-sm sm:text-base tracking-tight leading-snug truncate transition-colors ${
                            ui.strong
                          } group-hover:text-indigo-600 dark:group-hover:text-indigo-400`}
                          title={student.full_name}
                        >
                          {student.full_name}
                        </h3>
                      </div>

                      {/* Status Badges Row */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${good.chip}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${good.dot}`} />
                          Kvartirada turadi
                        </span>

                        {student.gender && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            normalizeGender(student.gender) === 'female'
                              ? isLight ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-500/10 text-indigo-300'
                              : isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {genderLabel(student.gender)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle Section: Educational Badges Grid */}
                  <div className="relative z-10 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5 text-xs">
                    {student.course && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        isLight ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                      }`}>
                        <GraduationCap size={11} className="shrink-0" />
                        {student.course}-kurs
                      </span>
                    )}

                    {student.group && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                        isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800/80 text-slate-300 border-slate-700'
                      }`}>
                        {student.group}
                      </span>
                    )}

                    {student.direction && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-medium border truncate max-w-[190px] ${
                          isLight ? 'bg-slate-100/70 text-slate-600 border-slate-200' : 'bg-slate-800/40 text-slate-400 border-slate-700/60'
                        }`}
                        title={directionLabel(student.direction)}
                      >
                        {directionLabel(student.direction)}
                      </span>
                    )}

                    {student.hemis_student_id && (
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                        isLight ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-slate-800/60 text-slate-300 border-slate-700'
                      }`}>
                        <IdCard size={11} className="text-slate-400" />
                        <span className="tabular-nums">HEMIS: {student.hemis_student_id}</span>
                        <button
                          type="button"
                          onClick={() => copy(student.hemis_student_id!, 'HEMIS ID', `hemis-${student.id}`)}
                          className="no-shelf ml-0.5 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="HEMIS ID nusxalash"
                        >
                          {copiedKey === `hemis-${student.id}` ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Contact Info Preview */}
                  <div className="relative z-10 mt-3 space-y-1.5 text-xs">
                    {student.phone_number ? (
                      <div className={`flex items-center justify-between text-[11px] ${ui.body}`}>
                        <div className="flex items-center gap-1.5 truncate">
                          <Phone size={11} className={`shrink-0 ${ui.faint}`} />
                          <a href={`tel:${student.phone_number}`} className="truncate hover:underline font-semibold">
                            {student.phone_number}
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => copy(student.phone_number!, 'Telefon raqam', `phone-${student.id}`)}
                          className={`no-shelf shrink-0 p-1 text-slate-400 hover:text-indigo-600 transition-colors`}
                          title="Telefonni nusxalash"
                        >
                          {copiedKey === `phone-${student.id}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                        </button>
                      </div>
                    ) : (
                      <p className={`text-[11px] italic ${ui.faint}`}>Telefon raqam kiritilmagan</p>
                    )}

                    <div className={`flex items-center justify-between text-[11px] ${ui.body}`}>
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail size={11} className={`shrink-0 ${ui.faint}`} />
                        <a href={`mailto:${student.email}`} className="truncate hover:underline">
                          {student.email}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => copy(student.email, 'Email', `mail-${student.id}`)}
                        className={`no-shelf shrink-0 p-1 text-slate-400 hover:text-indigo-600 transition-colors`}
                        title="Emailni nusxalash"
                      >
                        {copiedKey === `mail-${student.id}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                      </button>
                    </div>

                    <div className={`flex items-center gap-1 text-[10px] ${ui.faint} pt-0.5`}>
                      <Clock size={10} />
                      <span>Ro&apos;yxatdan o&apos;tgan: {formatDate(student.created_at)} ({timeAgo(student.created_at)})</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Strip: Every button is actionable and valuable */}
                <div className="relative z-10 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {/* Call button */}
                    {student.phone_number ? (
                      <a
                        href={`tel:${student.phone_number.replace(/[^\d+]/g, '')}`}
                        className={`no-shelf inline-flex items-center justify-center gap-1.5 rounded-xl h-8.5 px-3 text-xs font-bold transition-all active:scale-95 shadow-xs ${
                          isLight
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300'
                            : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 hover:border-indigo-500/40'
                        }`}
                        title={`Qo'ng'iroq qilish: ${student.phone_number}`}
                      >
                        <PhoneCall size={12} className="shrink-0" />
                        <span className="hidden sm:inline">Qo&apos;ng&apos;iroq</span>
                      </a>
                    ) : (
                      <span className={`text-[11px] italic px-1 ${ui.faint}`}>Tel yo&apos;q</span>
                    )}

                    {/* Telegram button if phone exists */}
                    {tg && (
                      <a
                        href={tg}
                        target="_blank"
                        rel="noreferrer"
                        className={`no-shelf inline-flex items-center justify-center h-8.5 w-8.5 rounded-xl border transition-all active:scale-95 ${
                          isLight
                            ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300'
                            : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20 hover:bg-indigo-500/20'
                        }`}
                        title="Telegram orqali bog'lanish"
                      >
                        <Send size={12} />
                      </a>
                    )}

                    {/* Email button */}
                    <a
                      href={`mailto:${student.email}`}
                      className={`no-shelf inline-flex items-center justify-center h-8.5 w-8.5 rounded-xl border transition-all active:scale-95 ${
                        isLight
                          ? 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                      title={`Email: ${student.email}`}
                    >
                      <Mail size={12} />
                    </a>
                  </div>

                  {/* Detail modal trigger */}
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(student)}
                    className={`no-shelf inline-flex items-center justify-center gap-1 rounded-xl h-8.5 px-3 text-xs font-bold transition-all active:scale-95 ${
                      isLight
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                        : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25'
                    }`}
                    title="To'liq talaba dosyesini ko'rish"
                  >
                    <Eye size={12} />
                    <span>Batafsil</span>
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      ) : (
        /* 4B: Professional Educational Table Registry View */
        <div className={`overflow-hidden rounded-2xl border transition-all ${ui.card} ${isLight ? 'shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-slate-100' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`border-b text-[10px] font-black uppercase tracking-wider select-none ${
                  isLight ? 'bg-slate-50/90 border-slate-200 text-slate-600' : 'bg-slate-800/80 border-slate-700/80 text-slate-300'
                }`}>
                  <th className="py-3 px-3.5 w-12 text-center">№</th>
                  <th className="py-3 px-3.5 min-w-[220px]">Talaba (F.I.SH.)</th>
                  <th className="py-3 px-3.5 w-36 whitespace-nowrap">HEMIS ID</th>
                  <th className="py-3 px-3.5 w-36 whitespace-nowrap">Kurs & Guruh</th>
                  <th className="py-3 px-3.5 min-w-[150px]">Ta&apos;lim Yo&apos;nalishi</th>
                  <th className="py-3 px-3.5 min-w-[170px] whitespace-nowrap">Aloqa</th>
                  <th className="py-3 px-3.5 w-28 whitespace-nowrap">Sana</th>
                  <th className="py-3 px-3.5 w-28 text-right whitespace-nowrap">Amallar</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-slate-800/60'}`}>
                {list.map((student, idx) => {
                  const accent = genderAccent(student.gender)
                  const tg = telegramLink(student.phone_number)
                  return (
                    <tr
                      key={student.id}
                      className={`group transition-all duration-150 ${
                        isLight
                          ? 'hover:bg-indigo-50/50 even:bg-slate-50/35'
                          : 'hover:bg-indigo-950/25 even:bg-slate-900/20'
                      }`}
                    >
                      {/* 1. № */}
                      <td className="py-2.5 px-3.5 text-center">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 group-hover:bg-indigo-100/60 dark:group-hover:bg-indigo-900/40 transition-colors">
                          {idx + 1}
                        </span>
                      </td>

                      {/* 2. Talaba F.I.SH. & Avatar */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-xl text-xs font-black shadow-2xs ${
                            isLight
                              ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/60'
                              : 'bg-indigo-950/70 text-indigo-300 ring-1 ring-indigo-800/60'
                          }`}>
                            {initials(student.full_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => setSelectedStudent(student)}
                              className={`no-shelf font-extrabold text-xs hover:text-indigo-600 dark:hover:text-indigo-400 text-left truncate block tracking-tight ${ui.strong} transition-colors`}
                              title={student.full_name}
                            >
                              {student.full_name}
                            </button>
                            <span className={`text-[10px] inline-flex items-center gap-1 font-semibold ${accent.text}`}>
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${accent.dot}`} />
                              <span>{genderLabel(student.gender)}</span>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. HEMIS ID */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        {student.hemis_student_id ? (
                          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-mono font-bold tracking-tight shadow-2xs ${
                            isLight
                              ? 'bg-slate-50 border-slate-200/80 text-slate-700'
                              : 'bg-slate-800/60 border-slate-700/80 text-slate-300'
                          }`}>
                            <IdCard size={11} className="text-indigo-500 shrink-0" />
                            <span className="tabular-nums">{student.hemis_student_id}</span>
                            <button
                              type="button"
                              onClick={() => copy(student.hemis_student_id!, 'HEMIS ID', `hemis-${student.id}`)}
                              className="no-shelf ml-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-0.5 transition-colors"
                              title="HEMIS ID nusxalash"
                            >
                              {copiedKey === `hemis-${student.id}` ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                            </button>
                          </div>
                        ) : (
                          <span className={`text-[11px] italic ${ui.faint}`}>—</span>
                        )}
                      </td>

                      {/* 4. Kurs & Guruh */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          {student.course ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-extrabold text-[10px] border shadow-2xs whitespace-nowrap ${
                              isLight
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
                                : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                            }`}>
                              <GraduationCap size={10} className="shrink-0" />
                              <span>{student.course}-kurs</span>
                            </span>
                          ) : null}

                          {student.group ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[10px] border shadow-2xs whitespace-nowrap ${
                              isLight
                                ? 'bg-slate-100 text-slate-700 border-slate-200'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}>
                              <span>{student.group}</span>
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* 5. Ta'lim Yo'nalishi */}
                      <td className="py-2.5 px-3.5 max-w-[170px] truncate" title={directionLabel(student.direction)}>
                        <span className={`text-xs font-semibold block truncate ${ui.body}`}>
                          {directionLabel(student.direction) || '—'}
                        </span>
                      </td>

                      {/* 6. Aloqa: Telefon & Email */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="space-y-0.5 min-w-[160px]">
                          {student.phone_number ? (
                            <div className="flex items-center gap-1.5">
                              <a
                                href={`tel:${student.phone_number.replace(/[^\d+]/g, '')}`}
                                className="inline-flex items-center gap-1 font-bold text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline tracking-tight"
                                title={`Qo'ng'iroq: ${student.phone_number}`}
                              >
                                <PhoneCall size={10} className="shrink-0 text-indigo-500" />
                                <span>{formatPhone(student.phone_number)}</span>
                              </a>
                            </div>
                          ) : (
                            <span className={`text-[10px] italic ${ui.faint}`}>Tel kiritilmagan</span>
                          )}
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <Mail size={10} className="shrink-0" />
                            <a href={`mailto:${student.email}`} className="truncate max-w-[150px] hover:underline" title={student.email}>
                              {student.email}
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* 7. Sana */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span className={`text-xs font-bold block tabular-nums ${ui.strong}`}>
                          {formatDate(student.created_at)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                          <Clock size={9} />
                          <span>{timeAgo(student.created_at)}</span>
                        </span>
                      </td>

                      {/* 8. Amallar */}
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          {student.phone_number && (
                            <a
                              href={`tel:${student.phone_number.replace(/[^\d+]/g, '')}`}
                              className="no-shelf h-7.5 w-7.5 rounded-lg inline-flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 transition-colors shadow-2xs active:scale-95"
                              title="Qo'ng'iroq qilish"
                            >
                              <PhoneCall size={12} />
                            </a>
                          )}
                          {tg && (
                            <a
                              href={tg}
                              target="_blank"
                              rel="noreferrer"
                              className="no-shelf h-7.5 w-7.5 rounded-lg inline-flex items-center justify-center text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 transition-colors shadow-2xs active:scale-95"
                              title="Telegram orqali bog'lanish"
                            >
                              <Send size={12} />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedStudent(student)}
                            className="no-shelf h-7.5 px-2 rounded-lg inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 transition-colors shadow-2xs active:scale-95 text-[11px] font-bold"
                            title="Batafsil ko'rish"
                          >
                            <Eye size={12} />
                            <span>Batafsil</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Educational Regulation Notice Banner */}
      <div className={`flex items-start gap-3 rounded-2xl border p-4.5 text-xs leading-relaxed ${info.chip}`}>
        <Info size={18} className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <div className="space-y-1">
          <p className="font-bold text-indigo-900 dark:text-indigo-200">
            Kvartirada turuvchi talabalar maqomi to&apos;g&apos;risida eslatma:
          </p>
          <p className="text-indigo-800/80 dark:text-indigo-300/80">
            Ushbu talabalar mustaqil kvartira yoki ijarada istiqomat qiladi. Ular xonalar ro&apos;yxatida, yotoqxona bandligida
            va yotoqxona talabalari hisobida ko&apos;rinmaydi, xonaga joylashtirilmaydi.
          </p>
        </div>
      </div>

      {/* 6. Comprehensive Student Dossier Modal via createPortal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedStudent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStudent(null)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className={`relative w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden my-auto ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                }`}
              >
                {/* Modal Top Banner with Academic Pattern */}
                <div className="relative bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-700 p-5 sm:p-6 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white font-black text-lg shadow-inner backdrop-blur-md">
                        {initials(selectedStudent.full_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg sm:text-xl font-black tracking-tight truncate text-white">
                            {selectedStudent.full_name}
                          </h2>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-200 border border-emerald-400/40">
                            <Home size={10} /> Kvartirada turadi
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white">
                            {genderLabel(selectedStudent.gender)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedStudent(null)}
                      className="no-shelf rounded-full p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                      aria-label="Yopish"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Modal Body: Structured Academic Dossier */}
                <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                  {/* Academic Identity Details */}
                  <div className="space-y-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>
                      Akademik & Ta&apos;lim Ma&apos;lumotlari
                    </span>
                    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3.5 rounded-2xl border ${
                      isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-800/40 border-slate-700/70'
                    }`}>
                      <div>
                        <span className={`text-[10px] block ${ui.faint}`}>Ta&apos;lim Yo&apos;nalishi</span>
                        <span className={`text-xs font-bold block ${ui.strong}`}>
                          {directionLabel(selectedStudent.direction) || 'Kiritilmagan'}
                        </span>
                      </div>

                      <div>
                        <span className={`text-[10px] block ${ui.faint}`}>Kurs & Akademik Guruh</span>
                        <span className={`text-xs font-bold block ${ui.strong}`}>
                          {selectedStudent.course ? `${selectedStudent.course}-kurs` : '—'} · Guruh: {selectedStudent.group || '—'}
                        </span>
                      </div>

                      <div>
                        <span className={`text-[10px] block ${ui.faint}`}>HEMIS Talaba ID</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">
                            {selectedStudent.hemis_student_id || 'Mavjud emas'}
                          </span>
                          {selectedStudent.hemis_student_id && (
                            <button
                              type="button"
                              onClick={() => copy(selectedStudent.hemis_student_id!, 'HEMIS ID')}
                              className="no-shelf text-slate-400 hover:text-indigo-600"
                              title="Nusxalash"
                            >
                              <Copy size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className={`text-[10px] block ${ui.faint}`}>Fakultet</span>
                        <span className={`text-xs font-bold block ${ui.strong}`}>
                          {selectedStudent.faculty ? permitFacultyLabel(selectedStudent.faculty) : 'Fakultet ko‘rsatilmagan'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Housing & Living Category */}
                  <div className="space-y-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>
                      Turar-joy Toifasi
                    </span>
                    <div className={`p-3.5 rounded-2xl border ${
                      isLight ? 'bg-indigo-50/60 border-indigo-200' : 'bg-indigo-950/20 border-indigo-800/50'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Home size={15} className="text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                          Shaxsiy Kvartira / Ijara Uyi
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed">
                        Talaba umumiy yotoqxonada istiqomat qilmaydi. Mustaqil ijarada yashash toifasida ro&apos;yxatga olingan.
                      </p>
                    </div>
                  </div>

                  {/* Direct Contact Dossier */}
                  <div className="space-y-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>
                      Aloqa Bog&apos;lanish Vositalari
                    </span>
                    <div className="space-y-2">
                      {/* Phone item */}
                      <div className={`flex items-center justify-between p-3 rounded-xl border ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700'
                      }`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            <Phone size={14} />
                          </div>
                          <div className="min-w-0">
                            <span className={`text-[10px] block ${ui.faint}`}>Telefon raqami</span>
                            {selectedStudent.phone_number ? (
                              <a href={`tel:${selectedStudent.phone_number}`} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                                {selectedStudent.phone_number}
                              </a>
                            ) : (
                              <span className={`text-xs italic ${ui.faint}`}>Kiritilmagan</span>
                            )}
                          </div>
                        </div>
                        {selectedStudent.phone_number && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => copy(selectedStudent.phone_number!, 'Telefon raqam')}
                              className="no-shelf p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Nusxalash"
                            >
                              <Copy size={13} />
                            </button>
                            <a
                              href={`tel:${selectedStudent.phone_number.replace(/[^\d+]/g, '')}`}
                              className="no-shelf p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                              title="Qo'ng'iroq"
                            >
                              <PhoneCall size={14} />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Email item */}
                      <div className={`flex items-center justify-between p-3 rounded-xl border ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700'
                      }`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            <Mail size={14} />
                          </div>
                          <div className="min-w-0">
                            <span className={`text-[10px] block ${ui.faint}`}>Elektron pochta</span>
                            <a href={`mailto:${selectedStudent.email}`} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline truncate block">
                              {selectedStudent.email}
                            </a>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => copy(selectedStudent.email, 'Email')}
                          className="no-shelf p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Nusxalash"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* System Registration Logs */}
                  <div className={`p-3 rounded-xl border text-[11px] space-y-1 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/30 border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={ui.faint}>Ro&apos;yxatdan o&apos;tgan vaqti:</span>
                      <span className={`font-semibold ${ui.strong}`}>{formatFullDate(selectedStudent.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={ui.faint}>Foydalanuvchi holati:</span>
                      <span className={`font-semibold uppercase tracking-wider text-[10px] ${
                        selectedStudent.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {selectedStudent.status === 'active' ? 'Faol' : 'Tasdiq kutmoqda'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className={`p-4 sm:p-5 border-t flex flex-wrap items-center justify-between gap-2.5 ${
                  isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-800/50 border-slate-800'
                }`}>
                  <div className="flex items-center gap-2">
                    {selectedStudent.phone_number && (
                      <a
                        href={`tel:${selectedStudent.phone_number.replace(/[^\d+]/g, '')}`}
                        className="no-shelf inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 text-xs font-bold transition-transform active:scale-95 shadow-sm"
                      >
                        <PhoneCall size={13} />
                        <span>Qo&apos;ng&apos;iroq qilish</span>
                      </a>
                    )}

                    {telegramLink(selectedStudent.phone_number) && (
                      <a
                        href={telegramLink(selectedStudent.phone_number)!}
                        target="_blank"
                        rel="noreferrer"
                        className="no-shelf inline-flex items-center gap-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white px-3.5 py-2 text-xs font-bold transition-transform active:scale-95 shadow-sm"
                      >
                        <Send size={13} />
                        <span>Telegram</span>
                      </a>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    className={`no-shelf rounded-xl px-4 py-2 text-xs font-bold ${ui.btnGhost}`}
                  >
                    Yopish
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
