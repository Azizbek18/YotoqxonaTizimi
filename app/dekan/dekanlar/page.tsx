'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchSuperadminDekans } from '@/features/superadmin-dekans/client/api'
import DeanInviteManager from '@/components/dekan/DeanInviteManager'
import DekanLifecycleControls from '@/components/dekan/DekanLifecycleControls'
import { setSuperadminScope } from '@/lib/superadmin-scope'
import type {
  FacultyDekanOverview,
  SuperadminDekansPayload,
} from '@/features/superadmin-dekans/types'
import { dekanUI, statusChip } from '@/lib/dekan-ui'
import { useThemeStore } from '@/lib/stores/theme-store'

type Filter = 'all' | 'covered' | 'vacant' | 'attention'

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('uz-UZ')
}

export default function SuperadminDekansPage() {
  const isLight = useThemeStore((state) => state.theme === 'light')
  const ui = dekanUI(isLight)
  const [payload, setPayload] = useState<SuperadminDekansPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [inviteOpen, setInviteOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPayload(await fetchSuperadminDekans())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ma'lumotlarni yuklab bo'lmadi")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (payload?.faculties ?? []).filter((row) => {
      const matchesQuery = !query || [
        row.facultyLabel,
        row.faculty,
        row.dekan?.fullName,
        row.dekan?.email,
        row.dorm?.name,
        row.dorm?.number,
      ].some((value) => value?.toLowerCase().includes(query))

      if (!matchesQuery) return false
      if (filter === 'covered') return row.dekan?.status === 'active'
      if (filter === 'vacant') return row.dekan?.status !== 'active'
      if (filter === 'attention') return Boolean(row.dekan && row.dekan.status !== 'active')
      return true
    })
  }, [filter, payload, search])

  const summary = payload?.summary
  const coverage = summary && summary.totalFaculties > 0
    ? Math.round((summary.coveredFaculties / summary.totalFaculties) * 100)
    : 0
  const coveredSet = useMemo(
    () => new Set((payload?.faculties ?? []).filter((f) => f.dekan?.status === 'active').map((f) => f.faculty)),
    [payload],
  )
  // Faculties nobody is reviewing — pending applications with no active dean.
  const stranded = useMemo(
    () => (payload?.faculties ?? []).filter((f) => f.dekan?.status !== 'active' && f.stats.pendingPermits > 0),
    [payload],
  )
  const noBuilding = useMemo(
    () => (payload?.faculties ?? []).filter((f) => !f.dorm),
    [payload],
  )

  const filters: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'all', label: 'Barchasi', count: summary?.totalFaculties ?? 0 },
    { key: 'covered', label: 'Faol dekanli', count: summary?.coveredFaculties ?? 0 },
    { key: 'vacant', label: 'Faol dekansiz', count: summary?.vacantFaculties ?? 0 },
    { key: 'attention', label: "E'tibor talab", count: summary?.inactiveDekans ?? 0 },
  ]

  return (
    <div className="space-y-6">
      <section className={`relative overflow-hidden rounded-3xl border p-5 sm:p-7 ${ui.cardElevated}`}>
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className={`mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] ${ui.accentSoft}`}>
              <ShieldCheck size={14} /> Superadmin nazorati
            </div>
            <h1 className={`text-2xl font-black tracking-tight sm:text-4xl ${ui.strong}`}>
              Fakultet dekanlari
            </h1>
            <p className={`mt-3 max-w-xl text-sm leading-6 ${ui.body}`}>
              Barcha fakultetlarning dekanlari, talabalar oqimi va yotoqxona holati bitta global kuzatuv oynasida.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={`inline-flex w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold ${ui.btnGhost}`}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Yangilash
          </button>
        </div>

        <div className="relative mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Qamrab olingan fakultet"
            value={`${summary?.coveredFaculties ?? 0}/${summary?.totalFaculties ?? 0}`}
            caption={`${summary?.activeDekans ?? 0} ta faol dekan`}
            icon={UserRoundCheck}
            tone={(summary?.vacantFaculties ?? 0) > 0 ? 'warning' : 'success'}
            isLight={isLight}
          />
          <SummaryCard
            label="Binoli fakultet"
            value={`${summary?.facultiesWithBuilding ?? 0}/${summary?.totalFaculties ?? 0}`}
            caption="Yotoqxona biriktirilgan"
            icon={Building2}
            tone={(summary?.totalFaculties ?? 0) > (summary?.facultiesWithBuilding ?? 0) ? 'warning' : 'success'}
            isLight={isLight}
          />
          <SummaryCard
            label="Bo‘sh o‘rinlar"
            value={summary?.freeBeds ?? 0}
            caption={`${summary?.availableBeds ?? 0} ta o‘rindan · barcha bino`}
            icon={GraduationCap}
            tone={(summary?.freeBeds ?? 0) === 0 ? 'danger' : 'info'}
            isLight={isLight}
          />
          <SummaryCard
            label="Kutilayotgan yo‘llanmalar"
            value={summary?.pendingPermits ?? 0}
            caption={stranded.length > 0 ? `${stranded.length} ta fakultetда dekan yo‘q` : 'Dekan qarorini kutmoqda'}
            icon={Clock3}
            tone={stranded.length > 0 ? 'danger' : (summary?.pendingPermits ?? 0) > 0 ? 'warning' : 'neutral'}
            isLight={isLight}
          />
        </div>

        <div className={`relative mt-5 rounded-2xl border p-4 ${ui.inset}`}>
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className={`font-bold ${ui.strong}`}>
              Fakultetlar qamrovi · {summary?.totalStudents ?? 0} talaba
            </span>
            <span className={`font-black ${ui.accentText}`}>{coverage}%</span>
          </div>
          <div className={`mt-2 h-2.5 overflow-hidden rounded-full ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
              style={{ width: `${coverage}%` }}
            />
          </div>
        </div>
      </section>

      {stranded.length > 0 && (
        <section className={`rounded-2xl border p-4 ${isLight ? 'border-rose-200 bg-rose-50' : 'border-rose-500/25 bg-rose-500/10'}`}>
          <div className="flex items-start gap-3">
            <Clock3 className={isLight ? 'text-rose-600' : 'text-rose-400'} size={20} />
            <div className="min-w-0">
              <p className={`text-sm font-bold ${isLight ? 'text-rose-900' : 'text-rose-200'}`}>
                Dekansiz fakultetда kutilayotgan yo‘llanmalar bor
              </p>
              <p className={`mt-1 text-xs ${isLight ? 'text-rose-700' : 'text-rose-300'}`}>
                {stranded.map((f) => `${f.facultyLabel} (${f.stats.pendingPermits})`).join(' · ')} — dekan
                tayinlang yoki fakultetга kirib arizalarni ko‘rib chiqing.
              </p>
            </div>
          </div>
        </section>
      )}

      {noBuilding.length > 0 && (
        <section className={`rounded-2xl border p-4 ${isLight ? 'border-amber-200 bg-amber-50' : 'border-amber-500/25 bg-amber-500/10'}`}>
          <div className="flex items-start gap-3">
            <Building2 className={isLight ? 'text-amber-600' : 'text-amber-400'} size={20} />
            <div className="min-w-0">
              <p className={`text-sm font-bold ${isLight ? 'text-amber-900' : 'text-amber-200'}`}>
                Yotoqxona biriktirilmagan fakultet: {noBuilding.length} ta
              </p>
              <p className={`mt-1 text-xs ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
                {noBuilding.map((f) => f.facultyLabel).join(' · ')} — «Yotoqxonalar» bo‘limidan bino biriktiring.
              </p>
            </div>
          </div>
        </section>
      )}

      <DeanInviteManager
        openFor={inviteOpen}
        coveredFaculties={coveredSet}
        onRequestOpen={setInviteOpen}
        onClose={() => setInviteOpen(null)}
        onChanged={load}
      />

      {(payload?.unassignedDekans.length ?? 0) > 0 && (
        <section className={`rounded-2xl border p-4 ${isLight ? 'border-amber-200 bg-amber-50' : 'border-amber-500/25 bg-amber-500/10'}`}>
          <div className="flex items-start gap-3">
            <UserRoundX className={isLight ? 'text-amber-600' : 'text-amber-400'} size={20} />
            <div>
              <p className={`text-sm font-bold ${isLight ? 'text-amber-900' : 'text-amber-200'}`}>
                Fakulteti biriktirilmagan dekan mavjud
              </p>
              <p className={`mt-1 text-xs ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
                {payload?.unassignedDekans.map((dekan) => dekan.fullName).join(', ')}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className={`rounded-3xl border p-4 sm:p-5 ${ui.card}`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-sm">
            <Search className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${ui.faint}`} size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Fakultet, dekan yoki TTJ bo‘yicha izlash"
              className={`h-11 w-full rounded-xl border pl-10 pr-4 text-sm outline-none ${ui.input} ${ui.ring}`}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
            {filters.map((item) => (
              <button
                type="button"
                key={item.key}
                onClick={() => setFilter(item.key)}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-[11px] font-bold transition-colors ${
                  filter === item.key ? ui.accentSolid : ui.btnGhost
                }`}
              >
                {item.label} <span className="ml-1 opacity-70">{item.count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading && !payload ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className={`h-72 animate-pulse rounded-3xl border ${ui.inset}`} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={`rounded-3xl border p-12 text-center ${ui.card}`}>
          <Search className={`mx-auto ${ui.faint}`} size={32} />
          <p className={`mt-3 text-sm font-bold ${ui.strong}`}>Mos fakultet topilmadi</p>
          <p className={`mt-1 text-xs ${ui.muted}`}>Qidiruv yoki filtrni o‘zgartirib ko‘ring.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((row) => (
            <FacultyCard
              key={row.faculty}
              row={row}
              isLight={isLight}
              onInvite={setInviteOpen}
              coveredFaculties={coveredSet}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  caption,
  icon: Icon,
  tone,
  isLight,
}: {
  label: string
  value: number | string
  caption: string
  icon: typeof Users
  tone: Parameters<typeof statusChip>[0]
  isLight: boolean
}) {
  const ui = dekanUI(isLight)
  const status = statusChip(tone, isLight)
  return (
    <div className={`rounded-2xl border p-4 ${ui.inset}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-[10px] font-extrabold uppercase tracking-[0.14em] ${ui.muted}`}>{label}</p>
          <p className={`mt-1 text-3xl font-black ${ui.strong}`}>{value}</p>
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${status.chip}`}>
          <Icon size={20} />
        </span>
      </div>
      <p className={`mt-2 text-[11px] ${ui.muted}`}>{caption}</p>
    </div>
  )
}

function FacultyCard({
  row,
  isLight,
  onInvite,
  coveredFaculties,
  onChanged,
}: {
  row: FacultyDekanOverview
  isLight: boolean
  onInvite: (faculty: string) => void
  coveredFaculties: Set<string>
  onChanged: () => void
}) {
  const ui = dekanUI(isLight)
  const active = row.dekan?.status === 'active'
  const state = row.dekan ? statusChip(active ? 'success' : 'warning', isLight) : statusChip('neutral', isLight)

  return (
    <article className={`group flex h-full flex-col overflow-hidden rounded-3xl border ${ui.card} ${ui.hoverLift}`}>
      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`text-[10px] font-extrabold uppercase tracking-[0.18em] ${ui.accentText}`}>{row.faculty}</p>
            <h2 className={`mt-1 line-clamp-2 text-lg font-black leading-snug ${ui.strong}`}>{row.facultyLabel}</h2>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider ${state.chip}`}>
            {row.dekan ? (active ? 'Faol' : row.dekan.status ?? "Noma'lum") : 'Dekan yo‘q'}
          </span>
        </div>

        {row.dekan ? (
          <div className={`mt-5 flex min-h-52 flex-col rounded-2xl border p-4 ${ui.inset}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${active ? ui.accentTile : state.chip}`}>
                {initials(row.dekan.fullName)}
              </div>
              <div className="min-w-0">
                <p className={`truncate text-sm font-extrabold ${ui.strong}`}>{row.dekan.fullName}</p>
                <p className={`mt-0.5 text-[11px] ${ui.muted}`}>Fakultet dekani</p>
              </div>
            </div>
            <div className={`mt-3 space-y-2 border-t pt-3 text-[11px] ${ui.border} ${ui.body}`}>
              <a href={`mailto:${row.dekan.email}`} className="flex min-w-0 items-center gap-2 hover:underline">
                <Mail size={13} className="shrink-0" /> <span className="truncate">{row.dekan.email}</span>
              </a>
              {row.dekan.phoneNumber && (
                <a href={`tel:${row.dekan.phoneNumber}`} className="flex items-center gap-2 hover:underline">
                  <Phone size={13} /> {row.dekan.phoneNumber}
                </a>
              )}
              <p className="flex items-center gap-2"><CheckCircle2 size={13} /> Ro‘yxatdan o‘tgan: {formatDate(row.dekan.createdAt)}</p>
            </div>
            <div className="mt-auto">
              <DekanLifecycleControls
                dekan={row.dekan}
                currentFaculty={row.faculty}
                coveredFaculties={coveredFaculties}
                onChanged={onChanged}
              />
            </div>
          </div>
        ) : (
          <div className={`mt-5 flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed p-5 text-center ${ui.inset}`}>
            <UserRoundX size={26} className={ui.faint} />
            <p className={`mt-2 text-sm font-bold ${ui.strong}`}>Dekan tayinlanmagan</p>
            <button
              type="button"
              onClick={() => onInvite(row.faculty)}
              className={`mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${ui.accentSolid}`}
            >
              <UserRoundCheck size={12} /> Dekan taklif qilish
            </button>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Metric icon={GraduationCap} label="Talabalar" value={row.stats.students} isLight={isLight} />
          <Metric icon={MapPin} label="Bo‘sh o‘rin" value={row.stats.freeBeds} isLight={isLight} warn={row.stats.freeBeds === 0} />
          <Metric icon={Users} label="Tarbiyachi" value={row.stats.activeEducators} isLight={isLight} warn={row.stats.activeEducators === 0 && row.stats.placedStudents > 0} />
          <Metric icon={Clock3} label="Kutilmoqda" value={row.stats.pendingPermits} isLight={isLight} warn={row.stats.pendingPermits > 0} />
        </div>
      </div>

      <div className={`flex items-center gap-3 border-t px-5 py-3 ${ui.border} ${isLight ? 'bg-slate-50/70' : 'bg-slate-950/25'}`}>
        <Building2 size={15} className={`shrink-0 ${row.dorm ? ui.accentText : ui.faint}`} />
        {row.dorm ? (
          <p className={`min-w-0 flex-1 truncate text-xs font-semibold ${ui.body}`}>
            {row.dorm.number}-sonli TTJ{row.dorm.name ? ` · ${row.dorm.name}` : ''}
          </p>
        ) : (
          <p className={`flex-1 text-xs ${ui.faint}`}>Yotoqxona biriktirilmagan</p>
        )}
        <button
          type="button"
          onClick={() => {
            setSuperadminScope(row.faculty)
            window.location.href = '/dekan/dashboard'
          }}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${ui.accentSolid}`}
        >
          Kirish <ArrowRight size={12} />
        </button>
      </div>
    </article>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  isLight,
  warn = false,
}: {
  icon: typeof Users
  label: string
  value: number
  isLight: boolean
  warn?: boolean
}) {
  const ui = dekanUI(isLight)
  return (
    <div className={`rounded-xl border p-3 ${ui.inset}`}>
      <div className="flex items-center justify-between gap-2">
        <Icon size={14} className={warn ? (isLight ? 'text-amber-600' : 'text-amber-400') : ui.muted} />
        <span className={`text-base font-black ${warn ? (isLight ? 'text-amber-700' : 'text-amber-300') : ui.strong}`}>{value}</span>
      </div>
      <p className={`mt-1 text-[9px] font-bold uppercase tracking-wider ${ui.muted}`}>{label}</p>
    </div>
  )
}
