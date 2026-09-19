'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Boxes,
  Building2,
  ChevronDown,
  DoorClosed,
  Lock,
  UserPlus,
  UserMinus,
  X,
  Search,
  Users2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
  GraduationCap,
  Filter,
  ShieldCheck,
  RotateCcw,
  Loader2,
  Compass,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import { Skel } from '@/components/dekan/Skeletons'
import ConfirmModal from '@/components/ui/ConfirmModal'

// three.js is only pulled in when the building view is actually opened.
const BlockedBuilding3D = dynamic(() => import('@/components/dekan/BlockedBuilding3D'), {
  ssr: false,
  loading: () => <Skel className="h-[420px] w-full rounded-2xl" />,
})
import { dekanUI } from '@/lib/dekan-ui'
import { fetchBlockedRoomMap } from '@/features/dorms/client/api'
import { fetchAssignableStudents, assignStudentRoom } from '@/features/room-assignment/client/api'
import type { BlockedRoom, BlockedRoomMapDorm } from '@/features/dorms/types'
import type { FacultyStudentRow } from '@/features/room-assignment/types'

const genderLabel = (g: 'male' | 'female' | null) => (g === 'male' ? 'O‘g‘il bolalar' : g === 'female' ? 'Qizlar' : null)
const normGender = (g: string | null) => (g === 'male' || g === 'female' ? g : null)

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

type FilterStatus = 'all' | 'free' | 'full' | 'frozen'

export default function BlokXonalarPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  const [dorms, setDorms] = useState<BlockedRoomMapDorm[] | null>(null)
  const [roomless, setRoomless] = useState<FacultyStudentRow[]>([])
  const [dormId, setDormId] = useState<string>('')
  const [sectionKey, setSectionKey] = useState<string>('')
  const [picking, setPicking] = useState<BlockedRoom | null>(null)
  const [busy, setBusy] = useState(false)
  const [show3D, setShow3D] = useState(false)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')

  // Modal filters
  const [candidateSearch, setCandidateSearch] = useState('')
  const [candidateCourse, setCandidateCourse] = useState<number | 'all'>('all')

  // Remove student confirmation state
  const [confirmRemove, setConfirmRemove] = useState<{
    id: string
    name: string
    kind: 'user' | 'permit'
    roomNumber: string
  } | null>(null)
  const [removing, setRemoving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [{ dorms }, students] = await Promise.all([fetchBlockedRoomMap(), fetchAssignableStudents()])
      setDorms(dorms)
      setRoomless(students)
      setDormId((cur) => cur || dorms[0]?.dormId || '')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yuklab bo'lmadi")
      setDorms([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const dorm = useMemo(() => dorms?.find((d) => d.dormId === dormId) ?? dorms?.[0], [dorms, dormId])
  const section = useMemo(() => {
    if (!dorm) return undefined
    return dorm.sections.find((s) => `${s.block}-${s.floor}` === sectionKey) ?? dorm.sections[0]
  }, [dorm, sectionKey])

  // Placement Action
  const assign = async (student: FacultyStudentRow) => {
    if (!dorm || !section || !picking) return
    setBusy(true)
    try {
      await assignStudentRoom({
        studentId: student.id,
        roomNumber: picking.roomNumber,
        source: student.source,
        dormId: dorm.dormId,
        block: section.block,
        floor: section.floor,
      })
      toast.success(`${student.full_name} → ${section.block}${section.floor}-${picking.roomNumber} xonasiga joylashtirildi`)
      setPicking(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Joylashtirib bo'lmadi")
    } finally {
      setBusy(false)
    }
  }

  // Removal Action
  const handleRemoveStudent = async () => {
    if (!confirmRemove || !dorm || !section) return
    setRemoving(true)
    try {
      await assignStudentRoom({
        studentId: confirmRemove.id,
        roomNumber: null,
        source: confirmRemove.kind,
        dormId: dorm.dormId,
        block: section.block,
        floor: section.floor,
      })
      toast.success(`${confirmRemove.name} xonadan chiqarildi`)
      setConfirmRemove(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chiqarishda xatolik yuz berdi")
    } finally {
      setRemoving(false)
    }
  }

  // Overall Section Statistics
  const sectionStats = useMemo(() => {
    if (!section) return { filled: 0, total: 0, free: 0, pct: 0, roomsCount: 0 }
    const filled = section.rooms.reduce((n, r) => n + r.occupants.length, 0)
    const total = section.rooms.reduce((n, r) => n + (r.frozen ? 0 : r.capacity), 0)
    const free = Math.max(0, total - filled)
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0
    return { filled, total, free, pct, roomsCount: section.rooms.length }
  }, [section])

  // Filtered rooms in current section
  const filteredRooms = useMemo(() => {
    if (!section) return []
    return section.rooms.filter((r) => {
      const free = Math.max(0, r.capacity - r.occupants.length)
      const full = free === 0 && !r.frozen

      // Status filter
      if (statusFilter === 'free' && (free === 0 || r.frozen)) return false
      if (statusFilter === 'full' && !full) return false
      if (statusFilter === 'frozen' && !r.frozen) return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const roomCode = `${section.block}${section.floor}-${r.roomNumber}`.toLowerCase()
        const matchRoom = roomCode.includes(q) || r.roomNumber.toLowerCase().includes(q)
        const matchOccupant = r.occupants.some((o) => o.name.toLowerCase().includes(q))
        if (!matchRoom && !matchOccupant) return false
      }

      return true
    })
  }, [section, statusFilter, searchQuery])

  if (dorms === null) {
    return (
      <div className="space-y-4">
        <Skel className="h-28 w-full rounded-3xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Skel className="h-24 rounded-2xl" />
          <Skel className="h-24 rounded-2xl" />
          <Skel className="h-24 rounded-2xl" />
          <Skel className="h-24 rounded-2xl" />
        </div>
        <Skel className="h-72 w-full rounded-2xl" />
      </div>
    )
  }

  if (dorms.length === 0) {
    return (
      <div className="space-y-4">
        <div className="no-shelf rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-800 p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/15 border border-white/20">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">Blok xonalari</h1>
          <p className="mt-1 text-xs sm:text-sm text-indigo-100">
            A/B qanotli bino — seksiyangizdagi xonalar va joylashtirish
          </p>
        </div>
        <div className={`rounded-3xl border p-10 text-center ${ui.card}`}>
          <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${ui.accentTileSoft}`}>
            <Layers size={22} />
          </div>
          <h3 className={`text-base font-bold ${ui.strong}`}>Seksiya biriktirilmagan</h3>
          <p className={`mt-1 text-xs max-w-md mx-auto ${ui.muted}`}>
            Fakultetingizga blokli binoda hali seksiya ajratilmagan. Superadmin “Yotoqxonalar” bo‘limidan
            blok/qavat seksiyasini bersa, xonalar shu yerda avtomatik ko‘rinadi.
          </p>
        </div>
      </div>
    )
  }

  // The people who can take the room being filled — gender-compatible, roomless.
  const occupantGenders = new Set(
    picking?.occupants.map((o) => normGender(o.gender)).filter((g): g is 'male' | 'female' => g !== null) ?? [],
  )
  const roomHasGenderIssue = occupantGenders.size > 1
    || Boolean(picking?.occupants.some((o) => normGender(o.gender) === null))
  const roomGender = picking?.gender ?? section?.gender
    ?? (occupantGenders.size === 1 ? [...occupantGenders][0] : null)

  const candidates = roomHasGenderIssue
    ? []
    : roomless.filter((s) => {
        const gender = normGender(s.gender)
        const matchGender = gender !== null && (!roomGender || gender === roomGender)
        if (!matchGender) return false

        // Course filter in modal
        if (candidateCourse !== 'all' && s.course !== candidateCourse) return false

        // Search in modal
        if (candidateSearch.trim()) {
          const q = candidateSearch.toLowerCase().trim()
          const matchName = s.full_name.toLowerCase().includes(q)
          const matchDir = (s.direction || '').toLowerCase().includes(q)
          if (!matchName && !matchDir) return false
        }

        return true
      })

  return (
    <div className="space-y-5">
      {/* 1. Executive Multi-Layer Hero Banner */}
      <div className="no-shelf relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-800 p-5 sm:p-7 shadow-xl shadow-indigo-950/20 border border-white/20 text-white">
        <div className="pointer-events-none absolute -right-8 -bottom-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute right-1/3 top-0 h-40 w-40 rounded-full bg-violet-400/20 blur-xl" />

        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white border border-white/25">
                <Sparkles size={11} className="text-amber-300" /> Blokli bino
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-200 border border-emerald-400/30">
                <ShieldCheck size={11} /> Jonli sinxronizatsiya
              </span>
              {dorm && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-indigo-100 border border-white/15">
                  <Building2 size={11} /> {dorm.number}-yotoqxona
                </span>
              )}
            </div>

            <h1
              className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white drop-shadow-sm"
              style={{ color: '#ffffff' }}
            >
              Blok Xonalari va Joylashtirish
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100 max-w-2xl font-medium leading-relaxed">
              A/B qanotli yotoqxona — har bir seksiyada 9 tadan xona mavjud. Talabalarni qulay biriktiring va xonalar to‘liqligini nazorat qiling.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 3D Model Button */}
            <button
              type="button"
              onClick={() => {
                setShow3D((v) => {
                  const next = !v
                  if (next) {
                    setTimeout(() => {
                      document.getElementById('section-3d-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }, 150)
                  }
                  return next
                })
              }}
              className="no-shelf cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 px-3.5 py-2 text-xs font-bold text-white transition-all active:scale-95 shadow-xs"
            >
              <Boxes size={14} />
              <span>{show3D ? '3D Maketni yashirish' : '3D Maketni ko‘rish'}</span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => void load()}
              className="no-shelf cursor-pointer inline-flex items-center justify-center h-9 w-9 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white transition-all active:scale-95 shadow-xs"
              title="Ma’lumotlarni yangilash"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Multi-Dorm Switcher if faculty owns multiple buildings */}
        {dorms.length > 1 && (
          <div className="relative z-10 mt-5 pt-4 border-t border-white/15 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider mr-1">Binolar:</span>
            {dorms.map((d) => {
              const active = d.dormId === dorm?.dormId
              return (
                <button
                  key={d.dormId}
                  type="button"
                  onClick={() => {
                    setDormId(d.dormId)
                    setSectionKey('')
                  }}
                  className={`no-shelf cursor-pointer inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    active
                      ? 'bg-white text-indigo-900 shadow-md shadow-indigo-950/20'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
                  }`}
                >
                  <Building2 size={13} /> {d.number}-yotoqxona ({d.sections.length} seksiya)
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 2. 4 Sleek KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Card 1: Occupied Beds */}
        <div className={`no-shelf rounded-2xl border p-3.5 sm:p-4 shadow-2xs transition-all ${ui.card}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Band o‘rinlar</span>
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${ui.accentTileSoft}`}>
              <Users2 size={15} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-2xl font-black leading-none tabular-nums ${ui.strong}`}>
              {sectionStats.filled}
            </span>
            <span className={`text-xs font-semibold ${ui.faint}`}>/ {sectionStats.total} o‘rin</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-medium">
            <span className={ui.faint}>Seksiya to‘liqligi:</span>
            <span className={`font-bold tabular-nums ${ui.accentText}`}>{sectionStats.pct}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-500"
              style={{ width: `${Math.min(100, sectionStats.pct)}%` }}
            />
          </div>
        </div>

        {/* Card 2: Free Beds */}
        <div className={`no-shelf rounded-2xl border p-3.5 sm:p-4 shadow-2xs transition-all ${ui.card}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Bo‘sh joylar</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800">
              <DoorClosed size={15} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black leading-none tabular-nums text-emerald-600 dark:text-emerald-400">
              {sectionStats.free}
            </span>
            <span className={`text-xs font-semibold ${ui.faint}`}>ta bo‘sh</span>
          </div>
          <p className={`mt-2.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 truncate`}>
            <CheckCircle2 size={11} /> Joylashtirishga tayyor
          </p>
        </div>

        {/* Card 3: Roomless Waiting Students */}
        <div className={`no-shelf rounded-2xl border p-3.5 sm:p-4 shadow-2xs transition-all ${ui.card}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Kutayotganlar</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800">
              <GraduationCap size={15} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black leading-none tabular-nums text-amber-600 dark:text-amber-400">
              {roomless.length}
            </span>
            <span className={`text-xs font-semibold ${ui.faint}`}>talaba</span>
          </div>
          <p className={`mt-2.5 text-[10px] font-medium ${ui.faint} truncate`}>
            Xonaga biriktirilmagan
          </p>
        </div>

        {/* Card 4: Section info and Gender */}
        <div className={`no-shelf rounded-2xl border p-3.5 sm:p-4 shadow-2xs transition-all ${ui.card}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Seksiya Jinsi</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 ring-1 ring-sky-200 dark:ring-sky-800">
              <Compass size={15} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-lg sm:text-xl font-black leading-tight ${ui.strong}`}>
              {section ? `${section.block}${section.floor}` : '—'}
            </span>
            <span className={`text-[11px] font-bold ${ui.accentText}`}>
              ({sectionStats.roomsCount} xona)
            </span>
          </div>
          <p className={`mt-2.5 text-[10px] font-bold uppercase tracking-wide truncate ${
            section?.gender === 'female'
              ? 'text-pink-600 dark:text-pink-400'
              : section?.gender === 'male'
                ? 'text-sky-600 dark:text-sky-400'
                : ui.faint
          }`}>
            {section?.gender ? genderLabel(section.gender) : 'Jins chegaralanmagan'}
          </p>
        </div>
      </div>

      {/* 3. Section Selector Tabs (Sector Cards) */}
      <div className={`no-shelf rounded-2xl border p-4 shadow-2xs ${ui.card}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className={ui.accentText} />
            <h3 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
              Seksiyalar ({dorm?.sections.length || 0})
            </h3>
          </div>
          <span className={`text-[10px] font-medium ${ui.faint}`}>
            Har bir seksiya qanot (A/B) va qavatdan iborat
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {dorm?.sections.map((s) => {
            const key = `${s.block}-${s.floor}`
            const filled = s.rooms.reduce((n, r) => n + r.occupants.length, 0)
            const total = s.rooms.reduce((n, r) => n + (r.frozen ? 0 : r.capacity), 0)
            const pct = total > 0 ? Math.round((filled / total) * 100) : 0
            const active = key === `${section?.block}-${section?.floor}`

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSectionKey(key)}
                className={`no-shelf cursor-pointer text-left rounded-xl p-3 border transition-all active:scale-[0.98] ${
                  active
                    ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-indigo-500 shadow-md shadow-indigo-950/20'
                    : isLight
                      ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                      : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black tracking-tight">{s.block}{s.floor}</span>
                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                    active
                      ? 'bg-white/20 text-white'
                      : s.gender === 'female'
                        ? 'bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300'
                        : s.gender === 'male'
                          ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {s.gender === 'female' ? 'Qiz' : s.gender === 'male' ? 'O‘g‘il' : 'Aralash'}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between text-[10px] font-semibold tabular-nums">
                  <span className={active ? 'text-indigo-100' : ui.faint}>Bandlik:</span>
                  <span>{filled}/{total}</span>
                </div>

                <div className={`mt-1.5 h-1 w-full rounded-full overflow-hidden ${active ? 'bg-white/25' : 'bg-slate-200 dark:bg-slate-800'}`}>
                  <div
                    className={`h-full rounded-full ${active ? 'bg-white' : 'bg-indigo-600'}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 4. Toolbar: Search + Status Filters */}
      <div className={`no-shelf rounded-2xl border p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3 ${ui.card}`}>
        {/* Search */}
        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${ui.faint}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Xona yoki talaba qidirish..."
            className={`no-shelf w-full rounded-xl border py-2 pl-9 pr-8 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                : 'bg-slate-900/60 border-slate-800 text-slate-100 placeholder:text-slate-500'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`no-shelf absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md ${ui.faint} hover:text-slate-800 dark:hover:text-slate-200`}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[10px] font-bold uppercase tracking-wider mr-1 ${ui.muted}`}>
            <Filter size={12} className="inline mr-1" /> Filtr:
          </span>
          {[
            { id: 'all', label: 'Barchasi' },
            { id: 'free', label: 'Bo‘sh joy bor' },
            { id: 'full', label: 'To‘la' },
            { id: 'frozen', label: 'Muzlatilgan' },
          ].map((f) => {
            const active = statusFilter === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id as FilterStatus)}
                className={`no-shelf cursor-pointer px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 6. Architectural Room Grid (The Section Rooms) */}
      {section && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
              {section.block}{section.floor}-seksiya xonalari ({filteredRooms.length} ta)
            </span>
            <span className={`text-[11px] font-medium ${ui.faint}`}>
              Sig‘im: standart 4, 6 yoki 8 o‘rinli
            </span>
          </div>

          {filteredRooms.length === 0 ? (
            <div className={`no-shelf rounded-3xl border p-12 text-center ${ui.card}`}>
              <p className={`text-sm font-bold ${ui.strong}`}>Hech qanday xona topilmadi</p>
              <p className={`mt-1 text-xs ${ui.faint}`}>
                Qidiruv so‘zini yoki tanlangan holat filtrini o‘zgartirib ko‘ring
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRooms.map((r) => {
                const free = Math.max(0, r.capacity - r.occupants.length)
                const full = free === 0 && !r.frozen
                const isEmpty = r.occupants.length === 0
                const genders = new Set(
                  r.occupants.map((o) => normGender(o.gender)).filter((g): g is 'male' | 'female' => g !== null),
                )
                const genderIssue = genders.size > 1 || r.occupants.some((o) => normGender(o.gender) === null)

                return (
                  <div
                    key={r.roomNumber}
                    className={`no-shelf flex flex-col justify-between rounded-2xl border p-4 shadow-2xs transition-all hover:shadow-md ${
                      ui.card
                    } ${r.frozen ? 'opacity-70 bg-slate-50/60 dark:bg-slate-900/30' : ''}`}
                  >
                    <div>
                      {/* Card Top: Room Number + Capacity Badge + Status Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                            r.frozen
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                              : full
                                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                                : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                          }`}>
                            <DoorClosed size={16} />
                          </div>
                          <div>
                            <h3 className={`text-sm font-black tracking-tight ${ui.strong}`}>
                              {section.block}{section.floor}-{r.roomNumber}
                            </h3>
                            <span className={`text-[10px] font-bold ${ui.faint}`}>
                              {r.capacity} o‘rinli xona
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            r.frozen
                              ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              : full
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : isEmpty
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                          }`}
                        >
                          {r.frozen ? (
                            <>
                              <Lock size={10} /> Muzlatilgan
                            </>
                          ) : full ? (
                            'To‘la'
                          ) : isEmpty ? (
                            'Bo‘sh'
                          ) : (
                            `${free} ta bo‘sh`
                          )}
                        </span>
                      </div>

                      {/* Bed Pills Indicator */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[10px] font-bold mb-1.5 tabular-nums">
                          <span className={ui.muted}>Bandlik:</span>
                          <span className={ui.strong}>
                            {r.occupants.length} / {r.capacity} joy
                          </span>
                        </div>
                        <div className="grid grid-cols-6 sm:grid-cols-8 gap-1">
                          {Array.from({ length: r.capacity }).map((_, i) => {
                            const occ = r.occupants[i]
                            const isOccupied = Boolean(occ)
                            const isPermit = occ?.kind === 'permit'
                            return (
                              <div
                                key={i}
                                className={`h-2 rounded-full transition-all ${
                                  isOccupied
                                    ? isPermit
                                      ? 'bg-amber-400 dark:bg-amber-500'
                                      : 'bg-indigo-600 dark:bg-indigo-500'
                                    : isLight
                                      ? 'bg-slate-200'
                                      : 'bg-slate-800'
                                }`}
                                title={occ ? `${occ.name} (${occ.kind === 'permit' ? 'Ariza' : 'Talaba'})` : 'Bo‘sh o‘rin'}
                              />
                            )
                          })}
                        </div>
                      </div>

                      {/* Occupants List */}
                      <div className="mt-3.5 space-y-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider block ${ui.faint}`}>
                          Yashovchilar ({r.occupants.length}):
                        </span>

                        {r.occupants.length === 0 ? (
                          <div className={`py-4 text-center text-xs font-medium rounded-xl border border-dashed ${
                            isLight ? 'border-slate-200 text-slate-400' : 'border-slate-800 text-slate-500'
                          }`}>
                            Hozircha bo‘sh
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {r.occupants.map((o, idx) => (
                              <div
                                key={o.id || `${o.name}-${idx}`}
                                className={`flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs transition-all ${
                                  ui.inset
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-black ${
                                    o.gender === 'female'
                                      ? 'bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300'
                                      : 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                                  }`}>
                                    {getInitials(o.name)}
                                  </span>
                                  <div className="min-w-0">
                                    <p className={`font-bold truncate text-[11px] ${ui.strong}`} title={o.name}>
                                      {o.name}
                                    </p>
                                    <span className={`text-[9px] font-medium ${ui.faint}`}>
                                      {o.kind === 'permit' ? 'Yo‘llanma arizasi' : 'Talaba hisobi'}
                                    </span>
                                  </div>
                                </div>

                                {/* Removal Action Button */}
                                {o.id && (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmRemove({
                                      id: o.id!,
                                      name: o.name,
                                      kind: o.kind,
                                      roomNumber: r.roomNumber,
                                    })}
                                    className={`no-shelf cursor-pointer p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors`}
                                    title="Xonadan chiqarish"
                                  >
                                    <UserMinus size={13} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {genderIssue && (
                        <div className={`mt-2.5 p-2.5 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 ${ui.dangerSoft}`}>
                          <AlertTriangle size={13} className="shrink-0 text-red-600" />
                          <span>Jins ma’lumoti aralash — joylashtirish to‘xtatildi</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Button */}
                    <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      {r.frozen ? (
                        <div className="w-full py-2 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                          Xona muzlatilgan
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPicking(r)}
                          disabled={full || genderIssue}
                          className={`no-shelf cursor-pointer w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
                            full
                              ? isLight ? 'bg-slate-100 text-slate-400' : 'bg-slate-800 text-slate-500'
                              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xs shadow-blue-500/20'
                          }`}
                        >
                          <UserPlus size={13} />
                          <span>
                            {full
                              ? 'Xona to‘la'
                              : genderIssue
                                ? 'Tekshirish kerak'
                                : `Joylashtirish (${free} ta bo‘sh)`}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. Pastki 3D Bino va Seksiya Maketi */}
      {dorm && dorm.sections.length > 0 && section && (
        <div
          id="section-3d-card"
          className={`no-shelf overflow-hidden rounded-3xl border transition-all shadow-xs ${ui.card}`}
        >
          {/* Header button acts as accordion toggle */}
          <button
            type="button"
            onClick={() => setShow3D((v) => !v)}
            className={`no-shelf cursor-pointer w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 text-left transition-colors ${
              isLight ? 'hover:bg-slate-50/80' : 'hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all ${
                show3D
                  ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-md shadow-indigo-950/20'
                  : ui.accentTileSoft
              }`}>
                <Boxes size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm sm:text-base font-black tracking-tight ${ui.strong}`}>
                    3D Bino va Seksiya Ko‘rinishi
                  </h3>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    show3D
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                      : isLight
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-slate-800 text-slate-400'
                  }`}>
                    {show3D ? 'Faol Maket' : '3D Maket'}
                  </span>
                </div>
                <p className={`mt-0.5 text-xs font-medium ${ui.faint}`}>
                  {section.block}{section.floor}-seksiya · {dorm.number}-yotoqxona · Jonli 3D maket va interaktiv xonalar
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <span className={`text-xs font-bold ${show3D ? ui.accentText : ui.muted}`}>
                {show3D ? 'Maketni yashirish' : 'Maketni ko‘rish'}
              </span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-transform duration-200 ${
                show3D ? 'rotate-180 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-600' : `${ui.border} ${ui.faint}`
              }`}>
                <ChevronDown size={16} />
              </div>
            </div>
          </button>

          {/* 3D Canvas Area */}
          <AnimatePresence>
            {show3D && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="border-t border-slate-100 dark:border-slate-800 overflow-hidden"
              >
                <div className="p-3 sm:p-5">
                  <div className={`mb-3 flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium ${ui.inset}`}>
                    <span className={ui.muted}>
                      Sichqoncha yordamida binoni 360° aylantirishingiz va xonani bosib tezkor joylashtirishingiz mumkin.
                    </span>
                    <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Live 3D View
                    </span>
                  </div>

                  <BlockedBuilding3D
                    key={`${section.block}-${section.floor}`}
                    section={section}
                    isLight={isLight}
                    onPickRoom={(roomNumber) => {
                      const room = section.rooms.find((r) => r.roomNumber === roomNumber)
                      if (room && !room.frozen && room.occupants.length < room.capacity) setPicking(room)
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 7. Modern Student Placement Modal */}
      {picking && section && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm"
          onClick={() => !busy && setPicking(null)}
        >
          <div
            className={`no-shelf w-full max-w-lg rounded-3xl border shadow-2xl p-5 sm:p-6 transition-all ${
              isLight ? 'bg-white border-slate-200/90' : 'bg-slate-900 border-slate-800'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${ui.accentTileSoft}`}>
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className={`text-base font-black tracking-tight ${ui.strong}`}>
                    {section.block}{section.floor}-{picking.roomNumber} xonasiga joylashtirish
                  </h3>
                  <p className={`text-xs font-medium ${ui.faint}`}>
                    Bo‘sh joylar: <b className="text-emerald-600">{Math.max(0, picking.capacity - picking.occupants.length)} ta</b>
                    {roomGender ? ` · Faqat ${genderLabel(roomGender)} talabalar` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPicking(null)}
                disabled={busy}
                className={`no-shelf p-1.5 rounded-xl ${ui.btnGhost}`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Search & Course Filter */}
            <div className="mt-4 space-y-2.5">
              <div className="relative">
                <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${ui.faint}`} />
                <input
                  type="text"
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  placeholder="Ism yoki yo‘nalish bo‘yicha qidiruv..."
                  className={`no-shelf w-full rounded-xl border py-2 pl-9 pr-8 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                      : 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500'
                  }`}
                />
                {candidateSearch && (
                  <button
                    type="button"
                    onClick={() => setCandidateSearch('')}
                    className={`no-shelf absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md ${ui.faint}`}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Course filter pills */}
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { id: 'all', label: 'Barchasi' },
                  { id: 1, label: '1-kurs' },
                  { id: 2, label: '2-kurs' },
                  { id: 3, label: '3-kurs' },
                  { id: 4, label: '4-kurs' },
                ].map((c) => {
                  const active = candidateCourse === c.id
                  return (
                    <button
                      key={String(c.id)}
                      type="button"
                      onClick={() => setCandidateCourse(c.id as number | 'all')}
                      className={`no-shelf cursor-pointer px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        active
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : isLight
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {c.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Candidates List */}
            <div className="mt-3.5 max-h-[46vh] space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
              {candidates.length === 0 ? (
                <div className="py-10 text-center">
                  <p className={`text-xs font-semibold ${ui.faint}`}>Mos talaba topilmadi</p>
                  <p className={`mt-0.5 text-[11px] ${ui.faint}`}>
                    Qidiruv yoki kurs filtrini o‘zgartirib ko‘ring
                  </p>
                </div>
              ) : (
                candidates.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between gap-2.5 rounded-xl border p-2.5 transition-all ${
                      isLight
                        ? 'bg-slate-50/70 hover:bg-white border-slate-200'
                        : 'bg-slate-850 hover:bg-slate-800 border-slate-750'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                        normGender(s.gender) === 'female'
                          ? 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300'
                          : 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                      }`}>
                        {getInitials(s.full_name)}
                      </span>
                      <div className="min-w-0">
                        <p className={`font-bold text-xs truncate ${ui.strong}`}>{s.full_name}</p>
                        <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                          {Boolean(s.course && s.course > 0) && <span>{s.course}-kurs ·</span>}
                          <span className="truncate">{s.direction || 'Yo‘nalish ko‘rsatilmagan'}</span>
                          {s.source === 'permit' && (
                            <span className="shrink-0 text-amber-600 font-bold">· Yo‘llanma</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => assign(s)}
                      disabled={busy}
                      className={`no-shelf cursor-pointer shrink-0 px-3.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-white transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 ${
                        isLight
                          ? 'bg-blue-600 hover:bg-blue-700 shadow-xs shadow-blue-600/20'
                          : 'bg-blue-600 hover:bg-blue-500 shadow-xs shadow-blue-500/20'
                      }`}
                    >
                      {busy ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>...</span>
                        </>
                      ) : (
                        <span>Joylashtirish</span>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. Confirm Remove Student Modal */}
      <ConfirmModal
        isOpen={Boolean(confirmRemove)}
        title="Talabani xonadan chiqarish"
        description={confirmRemove ? `Rostdan ham ${confirmRemove.name} talabani ${section?.block}${section?.floor}-${confirmRemove.roomNumber} xonasidan chiqarmoqchimisiz?` : ''}
        onClose={() => setConfirmRemove(null)}
        onConfirm={handleRemoveStudent}
        confirmText="Ha, chiqarish"
        cancelText="Bekor qilish"
        confirmVariant="danger"
        isLoading={removing}
      />
    </div>
  )
}
