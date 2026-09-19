'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Plus,
  ChevronDown,
  Save,
  Phone,
  UserCheck,
  KeyRound,
  Stethoscope,
  ShieldCheck,
  Layers,
  RotateCcw,
  DoorClosed,
  CheckCircle2,
  AlertCircle,
  X,
  Users,
  SlidersHorizontal,
  Search,
  PhoneCall,
  Loader2,
  Sparkles,
  Grid3x3,
  Check,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useThemeStore } from '@/lib/stores/theme-store'
import CustomSelect from '@/components/ui/CustomSelect'
import { Skel } from '@/components/dekan/Skeletons'
import { dekanUI } from '@/lib/dekan-ui'
import { PERMIT_FACULTIES, permitFacultyLabel } from '@/lib/faculties'
import {
  fetchAllDorms,
  createDorm,
  saveDormSettings,
  reassignDormFloor,
} from '@/features/dorms/client/api'
import BlockedSectionGrid from '@/components/dekan/BlockedSectionGrid'
import RoomGrantGrid from '@/components/dekan/RoomGrantGrid'
import type { SuperadminDorm } from '@/features/dorms/types'

export default function SuperadminDormsPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  const [dorms, setDorms] = useState<SuperadminDorm[] | null>(null)
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({})
  const [openGrants, setOpenGrants] = useState<Record<string, boolean>>({})
  const [draft, setDraft] = useState<Record<string, Partial<SuperadminDorm>>>({})
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Creation modal state
  const [creating, setCreating] = useState(false)
  const [newDorm, setNewDorm] = useState({
    number: '',
    name: '',
    floorCount: 5,
    blocked: false,
    blockCount: 2,
  })

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | 'simple' | 'blocked'>('all')

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const { dorms: loaded } = await fetchAllDorms()
      setDorms(loaded)
      // If only one dorm, open it by default
      if (loaded.length === 1) {
        setOpenIds((prev) => ({ ...prev, [loaded[0].id]: true }))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yuklab bo'lmadi")
      setDorms([])
    } finally {
      if (isRefresh) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Draft changes helper
  const patch = (id: string, key: keyof SuperadminDorm, value: string | number) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], [key]: value } }))

  // Revert draft changes for a specific dorm
  const revertChanges = (dormId: string) => {
    setDraft((d) => {
      const next = { ...d }
      delete next[dormId]
      return next
    })
    toast('O‘zgarishlar bekor qilindi', { icon: '↩️' })
  }

  // Save changes
  const saveOne = async (dorm: SuperadminDorm) => {
    const changes = draft[dorm.id]
    if (!changes || Object.keys(changes).length === 0) return
    setBusy(true)
    try {
      await saveDormSettings(dorm.id, changes)
      toast.success('Bino sozlamalari muvaffaqiyatli saqlandi')
      setDraft((d) => {
        const next = { ...d }
        delete next[dorm.id]
        return next
      })
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Saqlab bo'lmadi")
    } finally {
      setBusy(false)
    }
  }

  // Floor faculty reassignment
  const reassign = async (dormId: string, floor: number, faculty: string | null) => {
    setBusy(true)
    try {
      await reassignDormFloor(dormId, floor, faculty)
      toast.success(`${floor}-qavat taqsimoti yangilandi`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bajarib bo'lmadi")
    } finally {
      setBusy(false)
    }
  }

  // Create new dorm
  const submitNew = async () => {
    if (!newDorm.number.trim()) {
      toast.error('Bino raqamini kiriting')
      return
    }
    setBusy(true)
    try {
      await createDorm({
        number: newDorm.number.trim(),
        name: newDorm.name.trim(),
        floorCount: newDorm.floorCount,
        layoutKind: newDorm.blocked ? 'blocked' : 'simple',
        blockCount: newDorm.blocked ? newDorm.blockCount : undefined,
      })
      toast.success('Yangi yotoqxona muvaffaqiyatli yaratildi')
      setCreating(false)
      setNewDorm({ number: '', name: '', floorCount: 5, blocked: false, blockCount: 2 })
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yaratib bo'lmadi")
    } finally {
      setBusy(false)
    }
  }

  // Calculate Overall KPI Statistics
  const stats = useMemo(() => {
    if (!dorms) return { totalDorms: 0, totalFloors: 0, totalResidents: 0, distinctFaculties: 0 }
    const totalDorms = dorms.length
    const totalFloors = dorms.reduce((acc, d) => acc + (d.floorCount || 0), 0)
    const totalResidents = dorms.reduce((acc, d) => acc + (d.residentCount || 0), 0)
    const facultySet = new Set<string>()
    dorms.forEach((d) => {
      d.faculties?.forEach((f) => facultySet.add(f))
      d.floors?.forEach((fl) => {
        if (fl.faculty) facultySet.add(fl.faculty)
      })
    })
    return {
      totalDorms,
      totalFloors,
      totalResidents,
      distinctFaculties: facultySet.size,
    }
  }, [dorms])

  // Filtered dorms
  const filteredDorms = useMemo(() => {
    if (!dorms) return []
    return dorms.filter((d) => {
      if (kindFilter === 'simple' && d.layoutKind !== 'simple') return false
      if (kindFilter === 'blocked' && d.layoutKind !== 'blocked') return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchNum = d.number.toLowerCase().includes(q)
        const matchName = d.name.toLowerCase().includes(q)
        const matchTtj = (d.ttjName || '').toLowerCase().includes(q)
        const matchFac = d.faculties.some((f) =>
          f.toLowerCase().includes(q) || (permitFacultyLabel(f) || '').toLowerCase().includes(q),
        )
        if (!matchNum && !matchName && !matchTtj && !matchFac) return false
      }
      return true
    })
  }, [dorms, kindFilter, searchQuery])

  // Faculty options for dropdowns
  const facultyOptions = useMemo(
    () => [
      { value: '', label: '— Bo‘sh (biriktirilmagan) —' },
      ...PERMIT_FACULTIES.map((pf) => ({ value: pf.value, label: pf.label })),
    ],
    [],
  )

  if (dorms === null) {
    return (
      <div className="space-y-4">
        <Skel className="h-32 w-full rounded-3xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Skel className="h-24 rounded-2xl" />
          <Skel className="h-24 rounded-2xl" />
          <Skel className="h-24 rounded-2xl" />
          <Skel className="h-24 rounded-2xl" />
        </div>
        <Skel className="h-64 w-full rounded-2xl" />
        <Skel className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 1. Executive Hero Banner */}
      <div className="no-shelf relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-800 p-5 sm:p-7 text-white shadow-xl shadow-indigo-950/15 border border-white/20">
        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white border border-white/25 shadow-xs">
                <Sparkles size={12} className="text-amber-300" />
                Superadmin Paneli
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-900/40 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold text-indigo-100 border border-white/10">
                Markaziy Infratuzilma
              </span>
            </div>

            <h1 className="mt-2.5 text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white drop-shadow-sm">
              Yotoqxonalar Boshqaruvi
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-indigo-100/90 max-w-2xl leading-relaxed">
              Universitet talabalar turar joyi binolari, qavatlar bo‘yicha fakultetlar taqsimoti va mas’ul xodimlar kontaktlari
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-2">
            {/* Create New Dorm Button */}
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="no-shelf cursor-pointer inline-flex items-center gap-2 rounded-xl bg-white hover:bg-slate-100 text-indigo-900 px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-950/25 transition-all active:scale-95"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Yangi bino qo‘shish</span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="no-shelf cursor-pointer inline-flex items-center justify-center h-10 w-10 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white transition-all active:scale-95 shadow-xs disabled:opacity-50"
              title="Ma’lumotlarni yangilash"
            >
              <RotateCcw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. 4 Sleek KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Card 1: Total Dorms */}
        <div className={`no-shelf rounded-2xl border p-3.5 sm:p-4 shadow-2xs transition-all ${ui.card}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Jami Binolar</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-200 dark:ring-indigo-800">
              <Building2 size={15} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-black leading-tight ${ui.strong}`}>
              {stats.totalDorms}
            </span>
            <span className={`text-xs font-semibold ${ui.faint}`}>ta bino</span>
          </div>
          <p className={`mt-2.5 text-[10px] font-medium ${ui.faint} truncate`}>
            Faol talabalar turar joylari
          </p>
        </div>

        {/* Card 2: Total Residents */}
        <div className={`no-shelf rounded-2xl border p-3.5 sm:p-4 shadow-2xs transition-all ${ui.card}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Yashovchilar</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800">
              <Users size={15} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-black leading-tight text-emerald-600 dark:text-emerald-400`}>
              {stats.totalResidents}
            </span>
            <span className={`text-xs font-semibold ${ui.faint}`}>talaba</span>
          </div>
          <p className={`mt-2.5 text-[10px] font-medium ${ui.faint} truncate`}>
            Binolarga joylashtirilgan
          </p>
        </div>

        {/* Card 3: Total Floors */}
        <div className={`no-shelf rounded-2xl border p-3.5 sm:p-4 shadow-2xs transition-all ${ui.card}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Qavatlar Fondi</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800">
              <Layers size={15} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-black leading-tight ${ui.strong}`}>
              {stats.totalFloors}
            </span>
            <span className={`text-xs font-semibold ${ui.faint}`}>qavat</span>
          </div>
          <p className={`mt-2.5 text-[10px] font-medium ${ui.faint} truncate`}>
            Barcha binolar bo‘yicha
          </p>
        </div>

        {/* Card 4: Distinct Faculties */}
        <div className={`no-shelf rounded-2xl border p-3.5 sm:p-4 shadow-2xs transition-all ${ui.card}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${ui.muted}`}>Fakultetlar</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 ring-1 ring-purple-200 dark:ring-purple-800">
              <Sparkles size={15} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-black leading-tight text-purple-600 dark:text-purple-400`}>
              {stats.distinctFaculties}
            </span>
            <span className={`text-xs font-semibold ${ui.faint}`}>fakultet</span>
          </div>
          <p className={`mt-2.5 text-[10px] font-medium ${ui.faint} truncate`}>
            Binolarga biriktirilgan
          </p>
        </div>
      </div>

      {/* 3. Search & Layout Kind Filter Toolbar */}
      <div className={`no-shelf rounded-2xl border p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3 ${ui.card}`}>
        {/* Search Input */}
        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${ui.faint}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Bino raqami, nomi yoki fakultet..."
            className={`no-shelf w-full rounded-xl border py-2 pl-9 pr-8 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
              isLight
                ? 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400'
                : 'border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`no-shelf absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md ${ui.btnGhost}`}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Layout Kind Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[10px] font-bold uppercase tracking-wider mr-1 hidden sm:inline-block ${ui.muted}`}>
            Bino turi:
          </span>
          {(
            [
              { id: 'all', label: 'Barchasi' },
              { id: 'simple', label: 'Oddiy bino' },
              { id: 'blocked', label: 'Blokli (A/B qanot)' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setKindFilter(t.id)}
              className={`no-shelf cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                kindFilter === t.id
                  ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30'
                  : isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Dorm List Cards */}
      {filteredDorms.length === 0 ? (
        <div className={`rounded-3xl border p-10 text-center ${ui.card}`}>
          <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${ui.accentTileSoft}`}>
            <Building2 size={24} />
          </div>
          <h3 className={`text-base font-bold ${ui.strong}`}>Yotoqxona topilmadi</h3>
          <p className={`mt-1 text-xs max-w-md mx-auto ${ui.muted}`}>
            {searchQuery || kindFilter !== 'all'
              ? 'Qidiruv mezonlariga mos keluvchi bino mavjud emas. Filtrlarni tozalab ko‘ring.'
              : 'Hozircha hech qanday talabalar turar joyi yaratilmagan. Yuqoridagi "Yangi bino qo‘shish" tugmasini bosing.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDorms.map((dorm, idx) => {
            const d = { ...dorm, ...draft[dorm.id] }
            const isOpen = openIds[dorm.id] ?? (filteredDorms.length === 1 && idx === 0)
            const dirty = Object.keys(draft[dorm.id] ?? {}).length > 0
            const grantsOpen = Boolean(openGrants[dorm.id])

            return (
              <div
                key={dorm.id}
                className={`no-shelf rounded-3xl border transition-all overflow-hidden shadow-xs ${ui.card} ${
                  dirty ? 'ring-2 ring-amber-400/60 dark:ring-amber-500/40' : ''
                }`}
              >
                {/* Dorm Card Header (Accordion toggle) */}
                <div
                  onClick={() => setOpenIds((prev) => ({ ...prev, [dorm.id]: !isOpen }))}
                  className={`cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 transition-colors select-none ${
                    isLight ? 'hover:bg-slate-50/70' : 'hover:bg-slate-850/60'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    {/* Icon Tile */}
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white font-black text-sm shadow-md transition-all ${
                        dorm.layoutKind === 'blocked'
                          ? 'bg-gradient-to-br from-purple-600 to-indigo-700 shadow-purple-950/20'
                          : 'bg-gradient-to-br from-indigo-600 to-blue-600 shadow-indigo-950/20'
                      }`}
                    >
                      <Building2 size={22} />
                    </div>

                    {/* Title and Metadata */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={`text-base sm:text-lg font-black tracking-tight ${ui.strong}`}>
                          {dorm.number}-yotoqxona
                          {dorm.name ? ` · ${dorm.name}` : ''}
                        </h3>

                        {/* Layout kind badge */}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                            dorm.layoutKind === 'blocked'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                              : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                          }`}
                        >
                          {dorm.layoutKind === 'blocked' ? (
                            <>
                              <Grid3x3 size={10} /> Blokli (A/B qanot)
                            </>
                          ) : (
                            'Oddiy bino'
                          )}
                        </span>

                        {/* Unsaved changes badge */}
                        {dirty && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 animate-pulse">
                            <AlertCircle size={10} /> Saqlanmagan
                          </span>
                        )}
                      </div>

                      {/* Subtitle with stats and faculties */}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {dorm.residentCount} ta talaba
                        </span>
                        <span className={ui.faint}>•</span>
                        <span className={ui.muted}>{dorm.floorCount} qavat</span>
                        <span className={ui.faint}>•</span>
                        <span className={`truncate max-w-xs sm:max-w-md ${ui.faint}`}>
                          {dorm.faculties.length > 0
                            ? dorm.faculties.map((f) => permitFacultyLabel(f) || f).join(', ')
                            : 'Fakultet biriktirilmagan'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Header Right Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className={`text-xs font-bold ${isOpen ? ui.accentText : ui.muted}`}>
                      {isOpen ? 'Sozlamalarni yig‘ish' : 'Sozlamalarni ko‘rish'}
                    </span>
                    <button
                      type="button"
                      className={`no-shelf flex h-8 w-8 items-center justify-center rounded-xl border transition-transform duration-200 ${
                        isOpen
                          ? 'rotate-180 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-600'
                          : `${ui.border} ${ui.faint}`
                      }`}
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                </div>

                {/* Dorm Details (When open) */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="border-t border-slate-100 dark:border-slate-800/80"
                    >
                      <div className="p-4 sm:p-6 space-y-6">
                        {/* Section A: Floor Partition */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${ui.accentTileSoft}`}>
                                <Layers size={14} />
                              </span>
                              <div>
                                <h4 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
                                  Qavatlar Taqsimoti
                                </h4>
                                <p className={`text-[10px] font-medium ${ui.faint}`}>
                                  Har bir qavat uchun mas’ul fakultetni belgilash
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Blocked vs Simple Floor Partition */}
                          {d.layoutKind === 'blocked' ? (
                            <div className={`p-4 rounded-2xl border ${ui.inset}`}>
                              <BlockedSectionGrid dormId={dorm.id} />
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {d.floors.map((f) => (
                                  <div
                                    key={f.floor}
                                    className={`flex items-center gap-2.5 rounded-xl border p-2.5 transition-all ${
                                      ui.inset
                                    }`}
                                  >
                                    {/* Floor Badge */}
                                    <span className="shrink-0 flex items-center justify-center h-8 w-16 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-black ring-1 ring-indigo-200 dark:ring-indigo-800">
                                      {f.floor}-qavat
                                    </span>

                                    {/* Select Faculty */}
                                    <div className="flex-1 min-w-0">
                                      <CustomSelect
                                        value={f.faculty ?? ''}
                                        disabled={busy}
                                        onChange={(v) => reassign(dorm.id, f.floor, v || null)}
                                        className={`w-full rounded-lg border px-3 py-1.5 text-xs font-medium ${ui.input}`}
                                        options={facultyOptions}
                                      />
                                    </div>

                                    {/* Pending Indicator if any */}
                                    {f.pendingFaculty && (
                                      <span className="shrink-0 rounded-md bg-amber-100 dark:bg-amber-950/60 px-2 py-1 text-[9px] font-bold text-amber-800 dark:text-amber-300">
                                        {permitFacultyLabel(f.pendingFaculty)} kutmoqda
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Room Exceptions Accordion */}
                              <div className={`overflow-hidden rounded-2xl border ${ui.border}`}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenGrants((prev) => ({ ...prev, [dorm.id]: !grantsOpen }))
                                  }
                                  className={`no-shelf cursor-pointer w-full flex items-center justify-between p-3 text-left transition-colors ${
                                    isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/40'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <DoorClosed size={14} className={ui.accentText} />
                                    <span className={`text-xs font-bold ${ui.strong}`}>
                                      Xona darajasidagi istisnolar
                                    </span>
                                    <span className={`text-[10px] ${ui.faint}`}>
                                      (Bir qavatda bir necha fakultet talabalari uchun)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-[10px] font-bold ${grantsOpen ? ui.accentText : ui.muted}`}>
                                      {grantsOpen ? 'Yashirish' : 'Ochish'}
                                    </span>
                                    <ChevronDown
                                      size={14}
                                      className={`transition-transform duration-200 ${
                                        grantsOpen ? 'rotate-180 text-indigo-600' : ui.faint
                                      }`}
                                    />
                                  </div>
                                </button>

                                <AnimatePresence>
                                  {grantsOpen && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="border-t border-slate-100 dark:border-slate-800 p-3.5"
                                    >
                                      <RoomGrantGrid dormId={dorm.id} />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Section B: Building Specs Parameters */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${ui.accentTileSoft}`}>
                              <SlidersHorizontal size={14} />
                            </span>
                            <div>
                              <h4 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
                                Bino Parametrlari
                              </h4>
                              <p className={`text-[10px] font-medium ${ui.faint}`}>
                                Qavatlar va xonalar sig‘imi sozlamalari
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* TTJ Official Name */}
                            <label className="block">
                              <span className={`block mb-1.5 text-[11px] font-bold ${ui.muted}`}>
                                TTJ rasmiy nomi
                              </span>
                              <input
                                type="text"
                                value={String(d.ttjName ?? '')}
                                onChange={(e) => patch(dorm.id, 'ttjName', e.target.value)}
                                placeholder="Masalan: 12-sonli TTJ"
                                className={`no-shelf w-full rounded-xl border px-3 py-2 text-xs font-medium ${ui.input}`}
                              />
                            </label>

                            {/* Floor Count */}
                            <label className="block">
                              <span className={`block mb-1.5 text-[11px] font-bold ${ui.muted}`}>
                                Qavatlar soni
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={d.floorCount}
                                onChange={(e) =>
                                  patch(dorm.id, 'floorCount', Math.max(1, Number(e.target.value) || 1))
                                }
                                className={`no-shelf w-full rounded-xl border px-3 py-2 text-xs font-medium ${ui.input}`}
                              />
                            </label>

                            {/* Default Room Capacity */}
                            <label className="block">
                              <span className={`block mb-1.5 text-[11px] font-bold ${ui.muted}`}>
                                Standart xona sig‘imi (o‘rin)
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={d.defaultRoomCapacity}
                                onChange={(e) =>
                                  patch(dorm.id, 'defaultRoomCapacity', Math.max(1, Number(e.target.value) || 1))
                                }
                                className={`no-shelf w-full rounded-xl border px-3 py-2 text-xs font-medium ${ui.input}`}
                              />
                            </label>
                          </div>
                        </div>

                        {/* Section C: Staff & Emergency Contacts (4 Specialized Mini-Cards) */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${ui.accentTileSoft}`}>
                              <Phone size={14} />
                            </span>
                            <div>
                              <h4 className={`text-xs font-black uppercase tracking-wider ${ui.strong}`}>
                                Mas’ul Xodimlar va Favqulodda Aloqa
                              </h4>
                              <p className={`text-[10px] font-medium ${ui.faint}`}>
                                Talabalar va tizim foydalanuvchilari uchun rasmiy kontaktlar
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Contact 1: Tarbiyachi-pedagog */}
                            <div className={`rounded-2xl border p-3.5 space-y-2.5 ${ui.inset}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                                    <UserCheck size={14} />
                                  </div>
                                  <span className={`text-xs font-bold ${ui.strong}`}>
                                    Tarbiyachi-pedagog
                                  </span>
                                </div>
                                {d.tarbiyachiPhone && (
                                  <a
                                    href={`tel:${String(d.tarbiyachiPhone).replace(/[^\d+]/g, '')}`}
                                    className="no-shelf inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
                                    title="Qo‘ng‘iroq qilish"
                                  >
                                    <PhoneCall size={10} /> Qo‘ng‘iroq
                                  </a>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <span className={`block text-[10px] font-semibold mb-1 ${ui.faint}`}>
                                    F.I.Sh
                                  </span>
                                  <input
                                    type="text"
                                    value={String(d.tarbiyachiName ?? '')}
                                    onChange={(e) => patch(dorm.id, 'tarbiyachiName', e.target.value)}
                                    placeholder="Masalan: Begmatova Nasiba"
                                    className={`no-shelf w-full rounded-xl border px-3 py-1.5 text-xs ${ui.input}`}
                                  />
                                </div>
                                <div>
                                  <span className={`block text-[10px] font-semibold mb-1 ${ui.faint}`}>
                                    Telefon raqami
                                  </span>
                                  <input
                                    type="text"
                                    value={String(d.tarbiyachiPhone ?? '')}
                                    onChange={(e) => patch(dorm.id, 'tarbiyachiPhone', e.target.value)}
                                    placeholder="+998 90 123 45 67"
                                    className={`no-shelf w-full rounded-xl border px-3 py-1.5 text-xs ${ui.input}`}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Contact 2: Komendant */}
                            <div className={`rounded-2xl border p-3.5 space-y-2.5 ${ui.inset}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                                    <KeyRound size={14} />
                                  </div>
                                  <span className={`text-xs font-bold ${ui.strong}`}>
                                    Komendant (Bino mudiri)
                                  </span>
                                </div>
                                {d.komendantPhone && (
                                  <a
                                    href={`tel:${String(d.komendantPhone).replace(/[^\d+]/g, '')}`}
                                    className="no-shelf inline-flex items-center gap-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors"
                                    title="Qo‘ng‘iroq qilish"
                                  >
                                    <PhoneCall size={10} /> Qo‘ng‘iroq
                                  </a>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <span className={`block text-[10px] font-semibold mb-1 ${ui.faint}`}>
                                    F.I.Sh
                                  </span>
                                  <input
                                    type="text"
                                    value={String(d.komendantName ?? '')}
                                    onChange={(e) => patch(dorm.id, 'komendantName', e.target.value)}
                                    placeholder="Masalan: Ilxom aka"
                                    className={`no-shelf w-full rounded-xl border px-3 py-1.5 text-xs ${ui.input}`}
                                  />
                                </div>
                                <div>
                                  <span className={`block text-[10px] font-semibold mb-1 ${ui.faint}`}>
                                    Telefon raqami
                                  </span>
                                  <input
                                    type="text"
                                    value={String(d.komendantPhone ?? '')}
                                    onChange={(e) => patch(dorm.id, 'komendantPhone', e.target.value)}
                                    placeholder="+998 93 551 70 04"
                                    className={`no-shelf w-full rounded-xl border px-3 py-1.5 text-xs ${ui.input}`}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Contact 3: Shifokor */}
                            <div className={`rounded-2xl border p-3.5 space-y-2.5 ${ui.inset}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                                    <Stethoscope size={14} />
                                  </div>
                                  <span className={`text-xs font-bold ${ui.strong}`}>
                                    Shifokor (Tibbiy punkt)
                                  </span>
                                </div>
                                {d.doctorPhone && (
                                  <a
                                    href={`tel:${String(d.doctorPhone).replace(/[^\d+]/g, '')}`}
                                    className="no-shelf inline-flex items-center gap-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
                                    title="Qo‘ng‘iroq qilish"
                                  >
                                    <PhoneCall size={10} /> Qo‘ng‘iroq
                                  </a>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <span className={`block text-[10px] font-semibold mb-1 ${ui.faint}`}>
                                    F.I.Sh
                                  </span>
                                  <input
                                    type="text"
                                    value={String(d.doctorName ?? '')}
                                    onChange={(e) => patch(dorm.id, 'doctorName', e.target.value)}
                                    placeholder="Masalan: Sultonova Ra’no"
                                    className={`no-shelf w-full rounded-xl border px-3 py-1.5 text-xs ${ui.input}`}
                                  />
                                </div>
                                <div>
                                  <span className={`block text-[10px] font-semibold mb-1 ${ui.faint}`}>
                                    Telefon raqami
                                  </span>
                                  <input
                                    type="text"
                                    value={String(d.doctorPhone ?? '')}
                                    onChange={(e) => patch(dorm.id, 'doctorPhone', e.target.value)}
                                    placeholder="+998 94 444 55 66"
                                    className={`no-shelf w-full rounded-xl border px-3 py-1.5 text-xs ${ui.input}`}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Contact 4: Xavfsizlik xizmati */}
                            <div className={`rounded-2xl border p-3.5 space-y-2.5 ${ui.inset}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400">
                                    <ShieldCheck size={14} />
                                  </div>
                                  <span className={`text-xs font-bold ${ui.strong}`}>
                                    Xavfsizlik Xizmati (Qorovulxona)
                                  </span>
                                </div>
                                {d.securityPhone && (
                                  <a
                                    href={`tel:${String(d.securityPhone).replace(/[^\d+]/g, '')}`}
                                    className="no-shelf inline-flex items-center gap-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-100 transition-colors"
                                    title="Qo‘ng‘iroq qilish"
                                  >
                                    <PhoneCall size={10} /> Qo‘ng‘iroq
                                  </a>
                                )}
                              </div>

                              <div>
                                <span className={`block text-[10px] font-semibold mb-1 ${ui.faint}`}>
                                  Favqulodda navbatchi telefon raqami
                                </span>
                                <input
                                  type="text"
                                  value={String(d.securityPhone ?? '')}
                                  onChange={(e) => patch(dorm.id, 'securityPhone', e.target.value)}
                                  placeholder="+998 71 200 00 00"
                                  className={`no-shelf w-full rounded-xl border px-3 py-1.5 text-xs ${ui.input}`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Section D: Action Footer Bar */}
                        <div className={`rounded-2xl border p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 ${
                          dirty
                            ? 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/60'
                            : ui.inset
                        }`}>
                          <div className="flex items-center gap-2 text-xs font-medium">
                            {dirty ? (
                              <>
                                <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                <span className="text-amber-800 dark:text-amber-300 font-bold">
                                  Bino parametrlarida saqlanmagan o‘zgarishlar mavjud
                                </span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className={ui.muted}>
                                  Barcha sozlamalar va kontaktlar saqlangan
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            {dirty && (
                              <button
                                type="button"
                                onClick={() => revertChanges(dorm.id)}
                                disabled={busy}
                                className={`no-shelf cursor-pointer rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${ui.btnGhost}`}
                              >
                                Bekor qilish
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => void saveOne(dorm)}
                              disabled={busy || !dirty}
                              className={`no-shelf cursor-pointer inline-flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-black uppercase tracking-wider text-white shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                                dirty
                                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25'
                                  : 'bg-slate-400'
                              }`}
                            >
                              {busy ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" />
                                  <span>Saqlanmoqda...</span>
                                </>
                              ) : (
                                <>
                                  <Save size={14} />
                                  <span>Saqlash</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}

      {/* 5. Modern New Dorm Creation Modal */}
      <AnimatePresence>
        {creating && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => !busy && setCreating(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`no-shelf w-full max-w-lg rounded-3xl border shadow-2xl p-5 sm:p-6 transition-all ${
                isLight ? 'bg-white border-slate-200/90' : 'bg-slate-900 border-slate-800'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${ui.accentTileSoft}`}>
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h3 className={`text-base font-black tracking-tight ${ui.strong}`}>
                      Yangi Yotoqxona Qo‘shish
                    </h3>
                    <p className={`text-xs font-medium ${ui.faint}`}>
                      Yangi bino korpusi parametrlarini kiriting
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  disabled={busy}
                  className={`no-shelf p-1.5 rounded-xl ${ui.btnGhost}`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Form */}
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Building Number */}
                  <label className="block">
                    <span className={`block mb-1 text-xs font-bold ${ui.muted}`}>
                      Bino raqami <span className="text-red-500">*</span>
                    </span>
                    <input
                      type="text"
                      value={newDorm.number}
                      onChange={(e) => setNewDorm((n) => ({ ...n, number: e.target.value }))}
                      placeholder="Masalan: 12 yoki 6"
                      className={`no-shelf w-full rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${ui.input}`}
                    />
                  </label>

                  {/* Building Name */}
                  <label className="block">
                    <span className={`block mb-1 text-xs font-bold ${ui.muted}`}>
                      Bino nomi (ixtiyoriy)
                    </span>
                    <input
                      type="text"
                      value={newDorm.name}
                      onChange={(e) => setNewDorm((n) => ({ ...n, name: e.target.value }))}
                      placeholder="Masalan: Asosiy bino"
                      className={`no-shelf w-full rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${ui.input}`}
                    />
                  </label>
                </div>

                {/* Floor Count */}
                <label className="block">
                  <span className={`block mb-1 text-xs font-bold ${ui.muted}`}>
                    Qavatlar soni
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={newDorm.floorCount}
                    onChange={(e) =>
                      setNewDorm((n) => ({
                        ...n,
                        floorCount: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                    className={`no-shelf w-full rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${ui.input}`}
                  />
                </label>

                {/* Architecture Type Selector */}
                <div>
                  <span className={`block mb-2 text-xs font-bold ${ui.muted}`}>
                    Bino arxitektura turi
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Option 1: Simple Dorm */}
                    <button
                      type="button"
                      onClick={() => setNewDorm((n) => ({ ...n, blocked: false }))}
                      className={`no-shelf cursor-pointer text-left rounded-2xl p-3 border transition-all ${
                        !newDorm.blocked
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20'
                          : `${ui.border} ${ui.card}`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          <Building2 size={14} /> Oddiy bino
                        </span>
                        {!newDorm.blocked && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                      </div>
                      <p className={`text-[10px] leading-tight ${ui.muted}`}>
                        Standart qavatlar. Qavatlar to‘liq fakultetga biriktiriladi.
                      </p>
                    </button>

                    {/* Option 2: Blocked Dorm (A/B Wings) */}
                    <button
                      type="button"
                      onClick={() => setNewDorm((n) => ({ ...n, blocked: true }))}
                      className={`no-shelf cursor-pointer text-left rounded-2xl p-3 border transition-all ${
                        newDorm.blocked
                          ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20'
                          : `${ui.border} ${ui.card}`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          <Grid3x3 size={14} /> Blokli bino (A/B)
                        </span>
                        {newDorm.blocked && <Check size={14} className="text-purple-600 dark:text-purple-400" />}
                      </div>
                      <p className={`text-[10px] leading-tight ${ui.muted}`}>
                        Har qavatda A va B bloklar (9 tadan xona, 54 o‘rin).
                      </p>
                    </button>
                  </div>
                </div>

                {/* Block count if blocked */}
                {newDorm.blocked && (
                  <label className="block p-3 rounded-2xl bg-purple-50/40 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60">
                    <span className="block mb-1 text-xs font-bold text-purple-900 dark:text-purple-200">
                      Bloklar soni (har qavatda)
                    </span>
                    <input
                      type="number"
                      min={2}
                      max={8}
                      value={newDorm.blockCount}
                      onChange={(e) =>
                        setNewDorm((n) => ({
                          ...n,
                          blockCount: Math.min(8, Math.max(2, Number(e.target.value) || 2)),
                        }))
                      }
                      className={`no-shelf w-full rounded-xl border px-3 py-2 text-xs font-semibold ${ui.input}`}
                    />
                    <span className="mt-1.5 block text-[10px] text-purple-700 dark:text-purple-300">
                      Standart: 2 ta blok (A va B qanotlari)
                    </span>
                  </label>
                )}
              </div>

              {/* Modal Footer */}
              <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  disabled={busy}
                  className={`no-shelf cursor-pointer rounded-xl px-4 py-2.5 text-xs font-bold ${ui.btnGhost}`}
                >
                  Bekor qilish
                </button>

                <button
                  type="button"
                  onClick={() => void submitNew()}
                  disabled={busy || !newDorm.number.trim()}
                  className="no-shelf cursor-pointer inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {busy ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Yaratilmoqda...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} strokeWidth={2.5} />
                      <span>Yaratish</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
