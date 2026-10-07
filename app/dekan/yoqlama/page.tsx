'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock,
  DoorOpen,
  FileSpreadsheet,
  Loader2,
  MapPin,
  Phone,
  Play,
  RefreshCw,
  Search,
  Send,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getAuthHeaders } from '@/lib/auth-session'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useVisiblePoll } from '@/lib/hooks/useVisiblePoll'
import { dekanUI, statusChip, type DekanStatusTone } from '@/lib/dekan-ui'
import { Skel } from '@/components/ui/skeletons'
import DayByDayAttendance from '@/components/dekan/DayByDayAttendance'
import type {
  DekanDormCard,
  DekanOverview,
  DekanRosterResident,
  DekanRosterView,
  DekanSessionInfo,
} from '@/features/attendance/types'

type RollState = DekanRosterResident['state']
type StateFilter = 'all' | RollState

const POLL_MS = 20_000
const DURATIONS = [30, 60, 90, 120] as const

const STATE_META: Record<RollState, { label: string; tone: DekanStatusTone; dot: string }> = {
  present: { label: 'Borman', tone: 'success', dot: 'bg-emerald-400' },
  absent: { label: 'Yo‘q', tone: 'danger', dot: 'bg-rose-400' },
  unmarked: { label: 'Bosmagan', tone: 'warning', dot: 'bg-amber-400' },
}

/* ───────────────────────────── helpers ───────────────────────────── */

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** `YYYY-MM-DDTHH:mm` in the browser's local time, for <input type="datetime-local">. */
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtDuration(min: number) {
  if (min < 60) return `${min} daq`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} soat ${m} daq` : `${h} soat`
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** mm:ss (or h:mm:ss) left until `iso`; null once past. */
function useCountdown(iso: string | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!iso) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [iso])
  if (!iso) return null
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return null
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = { ...(await getAuthHeaders()), ...(init?.body ? { 'Content-Type': 'application/json' } : {}) }
  const res = await fetch(url, { ...init, headers, cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Xatolik yuz berdi')
  return data as T
}

/* ───────────────────────────── page ───────────────────────────── */

export default function DekanYoqlamaPage() {
  const isLight = useThemeStore((s) => s.theme === 'light')
  const ui = dekanUI(isLight)

  const [overview, setOverview] = useState<DekanOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dormId, setDormId] = useState<string | null>(null)
  // null = follow the dorm's active session; otherwise a specific (past) one.
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [roster, setRoster] = useState<DekanRosterView | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const dorm: DekanDormCard | null = useMemo(
    () => overview?.dorms.find((d) => d.id === dormId) ?? null,
    [overview, dormId],
  )
  const viewId = pinnedId ?? dorm?.active?.id ?? null

  const loadOverview = useCallback(async () => {
    const data = await api<DekanOverview>('/api/dekan/yoqlama')
    setOverview(data)
    setDormId((cur) => (cur && data.dorms.some((d) => d.id === cur) ? cur : data.dorms[0]?.id ?? null))
  }, [])

  const loadRoster = useCallback(async (id: string) => {
    setRoster(await api<DekanRosterView>(`/api/dekan/yoqlama?sessionId=${id}`))
  }, [])

  const refresh = useCallback(async () => {
    try {
      setError(null)
      await loadOverview()
      if (viewId) await loadRoster(viewId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik')
    } finally {
      setLoading(false)
    }
  }, [loadOverview, loadRoster, viewId])

  useEffect(() => { void refresh() }, [refresh])

  // Drop a stale roster when the dorm / session changes or nothing is shown.
  useEffect(() => {
    if (!viewId || (roster && roster.session.id !== viewId)) setRoster(null)
  }, [viewId, roster])

  const live = roster
    ? roster.session.status === 'open' || roster.session.status === 'scheduled'
    : Boolean(overview?.dorms.some((d) => d.active))
  useVisiblePoll(
    async () => {
      try {
        if (viewId) await loadRoster(viewId)
        else await loadOverview()
      } catch { /* the next tick retries */ }
    },
    POLL_MS,
    { enabled: live, restartKey: viewId, runOnMount: false },
  )

  const endSession = async (session: DekanSessionInfo) => {
    setBusy(true)
    try {
      await api('/api/dekan/yoqlama', { method: 'PATCH', body: JSON.stringify({ sessionId: session.id }) })
      toast.success(session.status === 'scheduled' ? 'Yo‘qlama bekor qilindi' : 'Yo‘qlama yakunlandi')
      setPinnedId(session.status === 'scheduled' ? null : session.id)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik')
    } finally {
      setBusy(false)
    }
  }

  const onCreated = async (session: DekanSessionInfo) => {
    setPinnedId(null)
    setRoster(null)
    await loadOverview()
    await loadRoster(session.id).catch(() => {})
  }

  const activeCount = overview?.dorms.filter((d) => d.active).length ?? 0

  return (
    <div className="space-y-6 pb-16">
      <Hero
        roster={roster}
        dormLabel={dorm?.label ?? null}
        activeCount={activeCount}
        onRefresh={() => void refresh()}
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skel key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : error ? (
        <div className={`flex items-start gap-3 rounded-2xl border p-5 text-sm ${isLight ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-rose-500/25 bg-rose-500/10 text-rose-200'}`}>
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{error}</p>
            <button type="button" onClick={() => void refresh()} className={`no-shelf mt-2 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${ui.dangerSoft}`}>
              Qayta urinish
            </button>
          </div>
        </div>
      ) : !overview || overview.dorms.length === 0 ? (
        <div className={`no-shelf rounded-3xl border p-10 text-center ${ui.card}`}>
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${ui.accentSoft}`}>
            <Building2 size={26} />
          </div>
          <h2 className={`text-lg font-bold ${ui.strong}`}>Yotoqxonada talabangiz topilmadi</h2>
          <p className={`mx-auto mt-1.5 max-w-md text-sm ${ui.muted}`}>
            Yo‘qlama faqat xonaga joylashtirilgan faol talabalar uchun ochiladi.
          </p>
        </div>
      ) : (
        <>
          <DormTabs
            dorms={overview.dorms}
            value={dormId}
            isLight={isLight}
            onChange={(id) => { setDormId(id); setPinnedId(null); setRoster(null) }}
          />

          {dorm && !viewId && (
            <StartPanel key={dorm.id} dorm={dorm} ui={ui} isLight={isLight} onCreated={onCreated} />
          )}

          {viewId && roster && roster.session.id === viewId && (
            <Board
              key={roster.session.id}
              view={roster}
              isLight={isLight}
              ui={ui}
              busy={busy}
              onEnd={() => void endSession(roster.session)}
              onBack={pinnedId ? () => { setPinnedId(null); setRoster(null) } : null}
            />
          )}
          {viewId && !(roster && roster.session.id === viewId) && (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <Skel key={i} className="h-28 rounded-2xl" />)}
            </div>
          )}

          {dorm && (
            <DayByDayAttendance
              key={dorm.id}
              dormId={dorm.id}
              dormLabel={dorm.label}
              isLight={isLight}
              onOpenSession={(id) => {
                setPinnedId(id)
                setRoster(null)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          )}

          <History
            sessions={overview.recent.filter((s) => !dorm || s.dormId === dorm.id)}
            activeId={viewId}
            isLight={isLight}
            ui={ui}
            onOpen={(id) => { setPinnedId(id); setRoster(null) }}
          />
        </>
      )}
    </div>
  )
}

/* ───────────────────────────── hero ───────────────────────────── */

function Hero({
  roster, dormLabel, activeCount, onRefresh,
}: {
  roster: DekanRosterView | null
  dormLabel: string | null
  activeCount: number
  onRefresh: () => void
}) {
  const open = roster?.session.status === 'open'
  const countdown = useCountdown(open ? roster!.session.closesAt : null)
  const s = roster && roster.session.status !== 'scheduled' ? roster.session.summary : null
  const answered = s ? s.present + s.absent : 0
  const pct = s && s.total ? Math.round((answered / s.total) * 100) : 0

  return (
    <div className="no-shelf relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-5 text-white shadow-xl shadow-indigo-950/20 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-60 w-60 rounded-full bg-violet-400/10 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/20 text-white shadow-inner backdrop-blur-md">
            <ClipboardCheck size={24} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black tracking-tight sm:text-2xl" style={{ color: '#ffffff' }}>Yo‘qlama</h1>
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-md"
                style={{ color: '#ffffff' }}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${activeCount > 0 || open ? 'animate-pulse bg-emerald-400' : 'bg-slate-300'}`} />
                {roster ? `${roster.session.dormLabel}` : dormLabel ?? 'Dekan nazorati'}
              </span>
            </div>
            <p className="mt-0.5 text-xs font-medium sm:text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Vaqtni o‘zingiz belgilaysiz — talabalar tasdiqlaydi, kim bor-yo‘qligini shu yerda ko‘rasiz
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {open && countdown && (
            <span className="no-shelf inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/15 px-3.5 py-2 text-xs font-bold tabular-nums backdrop-blur-md sm:text-sm" style={{ color: '#ffffff' }}>
              <Clock size={15} className="text-white/80" />
              {countdown}
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            title="Yangilash"
            className="no-shelf inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white backdrop-blur-md transition-all hover:bg-white/25 active:scale-95"
            style={{ color: '#ffffff' }}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {s && (
        <div className="relative mt-6 flex flex-wrap items-center gap-4 sm:gap-6">
          <Ring pct={pct} answered={answered} total={s.total} />
          <div className="grid min-w-[240px] flex-1 grid-cols-2 gap-2.5 sm:grid-cols-4">
            {([
              ['Borman', s.present, 'bg-emerald-400'],
              ['Yo‘q', s.absent, 'bg-rose-400'],
              ['Bosmagan', s.unmarked, 'bg-amber-400'],
              ['Jami', s.total, 'bg-slate-300'],
            ] as const).map(([label, val, dot]) => (
              <div key={label} className="no-shelf rounded-2xl border border-white/20 bg-white/15 p-3 backdrop-blur-md transition-all hover:bg-white/20 sm:p-3.5">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  <span className={`h-2 w-2 rounded-full ${dot}`} />{label}
                </p>
                <p className="mt-1 text-2xl font-black tabular-nums tracking-tight sm:text-3xl" style={{ color: '#ffffff' }}>{val}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Ring({ pct, answered, total }: { pct: number; answered: number; total: number }) {
  const r = 32
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0 text-white">
      <svg width="92" height="92" viewBox="0 0 92 92" className="-rotate-90">
        <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="7" />
        <circle
          cx="46" cy="46" r={r} fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-black leading-none tabular-nums" style={{ color: '#ffffff' }}>
          {answered}<span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>/{total}</span>
        </span>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.9)' }}>{pct}%</span>
      </div>
    </div>
  )
}

/* ───────────────────────────── dorm tabs ───────────────────────────── */

function DormTabs({
  dorms, value, isLight, onChange,
}: {
  dorms: DekanDormCard[]
  value: string | null
  isLight: boolean
  onChange: (id: string) => void
}) {
  if (dorms.length < 2) return null
  return (
    <div
      role="group"
      aria-label="Yotoqxona tanlash"
      className={`no-shelf flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border p-1.5 ${isLight ? 'border-slate-200/80 bg-slate-100/90' : 'border-slate-800/90 bg-slate-950/70'}`}
    >
      {dorms.map((d) => {
        const active = d.id === value
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onChange(d.id)}
            className={`no-shelf inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98] sm:text-sm ${
              active
                ? isLight
                  ? 'border-slate-200/80 bg-white font-bold text-indigo-600 shadow-xs'
                  : 'border-indigo-500/30 bg-indigo-600 font-bold text-white'
                : isLight
                  ? 'border-transparent text-slate-600 hover:bg-white/60 hover:text-slate-900'
                  : 'border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
            }`}
          >
            <Building2 size={14} />
            <span>{d.label}</span>
            {d.active && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}
          </button>
        )
      })}
    </div>
  )
}

/* ───────────────────────────── start panel ───────────────────────────── */

function StartPanel({
  dorm, ui, isLight, onCreated,
}: {
  dorm: DekanDormCard
  ui: ReturnType<typeof dekanUI>
  isLight: boolean
  onCreated: (s: DekanSessionInfo) => Promise<void>
}) {
  const [mode, setMode] = useState<'now' | 'later'>('now')
  // Times the dekan has not typed stay RELATIVE ("now + 30 min", "start + 1 h")
  // and are resolved when shown / submitted, so a form left open for an hour
  // never offers an end time that has already passed.
  const [customStart, setCustomStart] = useState<string | null>(null)
  const [customEnd, setCustomEnd] = useState<string | null>(null)
  const [duration, setDuration] = useState<number>(60)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const startInput = customStart ?? toLocalInput(new Date(nowMs + 30 * 60_000))
  const baseMs = mode === 'later' ? new Date(startInput).getTime() : nowMs
  const endInput = customEnd ?? toLocalInput(new Date(baseMs + duration * 60_000))
  const pickDuration = (min: number) => { setDuration(min); setCustomEnd(null) }

  const submit = async () => {
    // Resolve at click time, not at render time.
    const startsAt = mode === 'later' ? new Date(startInput) : null
    const closesAt = customEnd
      ? new Date(customEnd)
      : new Date((startsAt ? startsAt.getTime() : Date.now()) + duration * 60_000)
    if (Number.isNaN(closesAt.getTime()) || (startsAt && Number.isNaN(startsAt.getTime()))) {
      toast.error('Vaqtni to‘g‘ri kiriting')
      return
    }
    setBusy(true)
    try {
      const { session } = await api<{ session: DekanSessionInfo }>('/api/dekan/yoqlama', {
        method: 'POST',
        body: JSON.stringify({
          dormId: dorm.id,
          startsAt: startsAt ? startsAt.toISOString() : null,
          closesAt: closesAt.toISOString(),
        }),
      })
      toast.success(session.status === 'open' ? 'Yo‘qlama boshlandi — talabalarga xabar ketdi' : 'Yo‘qlama rejalashtirildi')
      await onCreated(session)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik')
    } finally {
      setBusy(false)
    }
  }

  const field = `no-shelf w-full rounded-xl border px-3 py-2.5 text-sm font-medium ${ui.input} ${ui.ring}`

  return (
    <section className={`no-shelf rounded-3xl border p-5 sm:p-7 ${ui.card}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${ui.accentTileSoft}`}>
          <Play size={20} />
        </div>
        <div className="min-w-0">
          <h2 className={`text-base font-black ${ui.strong}`}>Yangi yo‘qlama — {dorm.label}</h2>
          <p className={`text-xs ${ui.muted}`}>
            Faqat shu yotoqxonadagi fakultetingiz talabalari ({dorm.residentCount} ta) ishtirok etadi
          </p>
        </div>
      </div>

      {!dorm.hasGeo && (
        <div className={`mt-4 flex items-start gap-2.5 rounded-xl border p-3 text-xs font-medium ${isLight ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-amber-500/25 bg-amber-500/10 text-amber-200'}`}>
          <MapPin size={15} className="mt-0.5 shrink-0" />
          <span>Bu yotoqxona joylashuvi belgilanmagan. Sozlamalar bo‘limida bino koordinatasini kiriting — aks holda talabalar tasdiqlay olmaydi.</span>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        {([
          ['now', 'Hozir boshlash', Play],
          ['later', 'Vaqtni belgilash', CalendarClock],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`no-shelf flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold transition-all active:scale-[0.98] ${
              mode === key ? `${ui.accentBorder} ${ui.accentSoft}` : `${ui.border} ${ui.muted} ${ui.inset}`
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {mode === 'later' && (
          <label className="block">
            <span className={`mb-1 block text-[11px] font-bold uppercase tracking-wider ${ui.muted}`}>Boshlanish vaqti</span>
            <input type="datetime-local" value={startInput} onChange={(e) => setCustomStart(e.target.value)} className={field} />
          </label>
        )}
        <label className={`block ${mode === 'now' ? 'sm:col-span-2' : ''}`}>
          <span className={`mb-1 block text-[11px] font-bold uppercase tracking-wider ${ui.muted}`}>Tugash vaqti</span>
          <input type="datetime-local" value={endInput} onChange={(e) => setCustomEnd(e.target.value)} className={field} />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`text-xs font-semibold ${ui.muted}`}>Davomiyligi:</span>
        {DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => pickDuration(m)}
            aria-pressed={!customEnd && duration === m}
            className={`no-shelf rounded-lg px-2.5 py-1 text-xs font-bold ${ui.accentSoft} ${!customEnd && duration === m ? `ring-2 ring-inset ${isLight ? 'ring-indigo-400' : 'ring-indigo-500/60'}` : ''}`}
          >
            {fmtDuration(m)}
          </button>
        ))}
      </div>

      <div className={`mt-5 flex items-start gap-2.5 rounded-xl border p-3 text-xs ${ui.inset} ${ui.body}`}>
        <Send size={15} className={`mt-0.5 shrink-0 ${ui.accentText}`} />
        <span>
          Boshlangach, tasdiqlamagan talabalarga <b>har 5 daqiqada</b> Telegram orqali eslatma boradi.
          Tugagach «Bosmagan» talabalar ro‘yxatini Excelga yuklab olasiz.
        </span>
      </div>

      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy || !dorm.hasGeo || dorm.residentCount === 0}
        className={`no-shelf mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold tracking-wide sm:w-auto ${ui.accentSolid}`}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
        {busy ? 'Yuborilmoqda…' : mode === 'now' ? 'Yo‘qlamani boshlash' : 'Rejalashtirish'}
      </button>
    </section>
  )
}

/* ───────────────────────────── board ───────────────────────────── */

function Board({
  view, isLight, ui, busy, onEnd, onBack,
}: {
  view: DekanRosterView
  isLight: boolean
  ui: ReturnType<typeof dekanUI>
  busy: boolean
  onEnd: () => void
  onBack: (() => void) | null
}) {
  const { session } = view
  const [filter, setFilter] = useState<StateFilter>('all')
  const [floor, setFloor] = useState<number | 'all'>('all')
  const [query, setQuery] = useState('')
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [exporting, setExporting] = useState(false)
  const isOpen = session.status === 'open'
  const isScheduled = session.status === 'scheduled'

  const floors = useMemo(
    () => [...new Set(view.residents.map((r) => r.floor ?? 0))].sort((a, b) => a - b),
    [view.residents],
  )

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return view.residents.filter((r) => {
      if (filter !== 'all' && r.state !== filter) return false
      if (floor !== 'all' && (r.floor ?? 0) !== floor) return false
      if (q && !r.fullName.toLowerCase().includes(q) && !r.roomNumber.toLowerCase().includes(q)) return false
      return true
    })
  }, [view.residents, filter, floor, query])

  const byFloor = useMemo(() => {
    const map = new Map<number, Map<string, DekanRosterResident[]>>()
    for (const r of shown) {
      const f = r.floor ?? 0
      if (!map.has(f)) map.set(f, new Map())
      const rooms = map.get(f)!
      if (!rooms.has(r.roomNumber)) rooms.set(r.roomNumber, [])
      rooms.get(r.roomNumber)!.push(r)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [shown])

  const exportXlsx = async (onlyUnmarked: boolean) => {
    const rows = view.residents.filter((r) => (onlyUnmarked ? r.state === 'unmarked' : true))
    if (rows.length === 0) { toast('Yuklab olinadigan talaba yo‘q'); return }
    setExporting(true)
    try {
      const { downloadXlsx } = await import('@/lib/spreadsheet-export')
      const date = new Date(session.startsAt)
      const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`
      await downloadXlsx({
        filename: `yoqlama-${onlyUnmarked ? 'bosmaganlar' : 'toliq'}-${session.dormLabel.replace(/\s+/g, '')}-${stamp}.xlsx`,
        sheetName: onlyUnmarked ? 'Bosmaganlar' : 'Yoqlama',
        headers: ['№', 'F.I.Sh', 'Xona', 'Qavat', 'Telefon', 'Holat', 'Masofa (m)', 'Belgilangan vaqt'],
        rows: rows.map((r, i) => [
          i + 1,
          r.fullName,
          r.roomNumber,
          r.floor ?? '',
          r.phone ?? '',
          STATE_META[r.state].label,
          r.selfDistanceM ?? '',
          r.markedAt ? fmtDateTime(r.markedAt) : '',
        ]),
      })
    } catch {
      toast.error('Excel faylini yaratib bo‘lmadi')
    } finally {
      setExporting(false)
    }
  }

  const statusTone: DekanStatusTone = isOpen ? 'success' : isScheduled ? 'info' : 'neutral'
  const statusText = isOpen
    ? 'Davom etmoqda'
    : isScheduled
      ? `Boshlanadi: ${fmtDateTime(session.startsAt)}`
      : session.status === 'auto_closed' ? 'Vaqti tugadi' : 'Yakunlangan'
  const chip = statusChip(statusTone, isLight)

  return (
    <div className="space-y-5">
      {/* session header */}
      <div className={`no-shelf flex flex-wrap items-center gap-3 rounded-2xl border p-3.5 sm:p-4 ${ui.card}`}>
        {onBack && (
          <button type="button" onClick={onBack} className={`no-shelf rounded-lg px-2.5 py-1.5 text-xs font-bold ${ui.btnGhost}`}>
            ← Orqaga
          </button>
        )}
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${chip.chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${chip.dot} ${isOpen ? 'animate-pulse' : ''}`} />
          {statusText}
        </span>
        <span className={`text-xs font-medium ${ui.muted}`}>
          {fmtDateTime(session.startsAt)} — {fmtTime(session.closesAt)}
          {session.reminderCount > 0 && ` · ${session.reminderCount} marta eslatma`}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!isScheduled && (
            <>
              <button
                type="button"
                disabled={exporting}
                onClick={() => void exportXlsx(true)}
                className={`no-shelf inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${ui.accentSolid}`}
              >
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                Bosmaganlar (Excel)
              </button>
              <button
                type="button"
                disabled={exporting}
                onClick={() => void exportXlsx(false)}
                className={`no-shelf inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${ui.btnGhost}`}
              >
                <FileSpreadsheet size={14} /> To‘liq ro‘yxat
              </button>
            </>
          )}
          {(isOpen || isScheduled) && (
            confirmEnd ? (
              <span className="inline-flex items-center gap-1.5">
                <button type="button" disabled={busy} onClick={onEnd} className={`no-shelf rounded-xl px-3 py-2 text-xs font-bold ${ui.btnDanger}`}>
                  {busy ? <Loader2 size={14} className="animate-spin" /> : isScheduled ? 'Ha, bekor qilish' : 'Ha, yakunlash'}
                </button>
                <button type="button" onClick={() => setConfirmEnd(false)} className={`no-shelf rounded-xl px-3 py-2 text-xs font-bold ${ui.btnGhost}`}>
                  Yo‘q
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmEnd(true)} className={`no-shelf rounded-xl px-3 py-2 text-xs font-bold ${ui.dangerSoft}`}>
                {isScheduled ? 'Bekor qilish' : 'Yakunlash'}
              </button>
            )
          )}
        </div>
      </div>

      {isScheduled ? (
        <div className={`no-shelf rounded-2xl border p-8 text-center ${ui.card}`}>
          <CalendarClock className={`mx-auto mb-3 ${ui.accentText}`} size={30} />
          <p className={`text-sm font-bold ${ui.strong}`}>Yo‘qlama {fmtDateTime(session.startsAt)} da avtomatik boshlanadi</p>
          <p className={`mt-1 text-xs ${ui.muted}`}>Shu vaqtda talabalarga Telegram orqali xabar boradi.</p>
        </div>
      ) : (
        <>
          {/* filters */}
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div className={`no-shelf inline-flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border p-1.5 ${isLight ? 'border-slate-200/80 bg-slate-100/90' : 'border-slate-800/90 bg-slate-950/70'}`}>
              {([
                ['all', 'Hammasi', session.summary.total],
                ['present', 'Borman', session.summary.present],
                ['absent', 'Yo‘q', session.summary.absent],
                ['unmarked', 'Bosmagan', session.summary.unmarked],
              ] as const).map(([key, label, count]) => (
                <Pill key={key} active={filter === key} onClick={() => setFilter(key)} isLight={isLight} label={label} count={count} />
              ))}
            </div>

            <div className="relative min-w-[200px] max-w-xs flex-1 self-stretch lg:self-auto">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Talaba yoki xona qidirish..."
                className={`no-shelf w-full rounded-xl border py-2 pl-9 pr-8 text-xs font-medium ${ui.input} ${ui.ring}`}
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="no-shelf absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {floors.length > 1 && (
            <div className={`no-shelf inline-flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl border p-1.5 ${isLight ? 'border-slate-200/80 bg-slate-100/90' : 'border-slate-800/90 bg-slate-950/70'}`}>
              <Pill active={floor === 'all'} onClick={() => setFloor('all')} isLight={isLight} label="Barcha qavat" />
              {floors.map((f) => (
                <Pill key={f} active={floor === f} onClick={() => setFloor(f)} isLight={isLight} label={f > 0 ? `${f}-qavat` : 'Qavatsiz'} />
              ))}
            </div>
          )}

          {/* floors */}
          {byFloor.length === 0 ? (
            <div className={`no-shelf rounded-2xl border p-10 text-center text-sm ${ui.card} ${ui.muted}`}>
              Tanlangan filtr bo‘yicha talaba topilmadi
            </div>
          ) : (
            <div className="space-y-4">
              {byFloor.map(([f, rooms]) => (
                <FloorPanel key={f} floor={f} rooms={[...rooms.entries()]} isLight={isLight} ui={ui} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Pill({
  active, onClick, label, count, isLight,
}: {
  active: boolean
  onClick: () => void
  label: string
  count?: number
  isLight: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`no-shelf inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98] sm:text-sm ${
        active
          ? isLight
            ? 'border-slate-200/80 bg-white font-bold text-indigo-600 shadow-xs'
            : 'border-indigo-500/30 bg-indigo-600 font-bold text-white'
          : isLight
            ? 'border-transparent text-slate-600 hover:bg-white/60 hover:text-slate-900'
            : 'border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
      }`}
    >
      <span>{label}</span>
      {count != null && (
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums ${
          active
            ? isLight ? 'bg-indigo-50 text-indigo-700' : 'bg-white/20 text-white'
            : isLight ? 'bg-slate-200/80 text-slate-600' : 'bg-slate-800 text-slate-400'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}

function FloorPanel({
  floor, rooms, isLight, ui,
}: {
  floor: number
  rooms: [string, DekanRosterResident[]][]
  isLight: boolean
  ui: ReturnType<typeof dekanUI>
}) {
  const [open, setOpen] = useState(true)
  const all = rooms.flatMap(([, r]) => r)
  const present = all.filter((r) => r.state === 'present').length
  const unmarked = all.filter((r) => r.state === 'unmarked').length

  return (
    <motion.section
      layout
      className={`no-shelf overflow-hidden rounded-2xl border ${isLight ? 'border-slate-200/90 bg-white shadow-xs' : 'border-slate-800/90 bg-slate-900/60 shadow-xs'}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`no-shelf flex w-full items-center justify-between gap-3 border-b p-3.5 text-left sm:p-4 ${isLight ? 'border-slate-100 bg-slate-50/70' : 'border-slate-800/80 bg-slate-900/50'}`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${isLight ? 'border border-indigo-200/80 bg-indigo-50 text-indigo-700' : 'border border-indigo-800/60 bg-indigo-950/60 text-indigo-300'}`}>
            {floor > 0 ? floor : '—'}
          </span>
          <span className="min-w-0">
            <span className={`block text-sm font-bold tracking-tight sm:text-base ${ui.strong}`}>
              {floor > 0 ? `${floor}-qavat` : 'Qavatsiz xonalar'}
            </span>
            <span className={`block text-xs font-medium ${ui.muted}`}>
              {rooms.length} ta xona · {present} ta bor{unmarked > 0 ? ` · ${unmarked} ta bosmagan` : ''}
            </span>
          </span>
        </span>
        <ChevronDown size={16} className={`${ui.muted} shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid gap-3.5 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {rooms.map(([room, residents]) => (
                <RoomCard key={room} room={room} residents={residents} isLight={isLight} ui={ui} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

function RoomCard({
  room, residents, isLight, ui,
}: {
  room: string
  residents: DekanRosterResident[]
  isLight: boolean
  ui: ReturnType<typeof dekanUI>
}) {
  const present = residents.filter((r) => r.state === 'present').length
  return (
    <div className={`no-shelf rounded-2xl border p-3.5 ${isLight ? 'border-slate-200/80 bg-slate-50/70 hover:border-slate-300' : 'border-slate-800/80 bg-slate-900/50 hover:border-slate-700'}`}>
      <div className="mb-2.5 flex items-center justify-between border-b border-slate-200/70 pb-2.5 dark:border-slate-800/80">
        <span className="flex items-center gap-2">
          <DoorOpen size={15} className="text-indigo-600 dark:text-indigo-400" />
          <span className={`text-xs font-black sm:text-sm ${ui.strong}`}>{room === '—' ? 'Xonasiz' : `${room}-xona`}</span>
        </span>
        <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold tabular-nums ${
          present === residents.length
            ? isLight ? 'border-emerald-200/80 bg-emerald-50 text-emerald-700' : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
            : isLight ? 'border-slate-200/60 bg-slate-200/70 text-slate-700' : 'border-slate-700 bg-slate-800 text-slate-300'
        }`}>
          {present}/{residents.length} bor
        </span>
      </div>
      <div className="space-y-1.5">
        {residents.map((r) => <ResidentRow key={r.id} r={r} isLight={isLight} ui={ui} />)}
      </div>
    </div>
  )
}

function ResidentRow({ r, isLight, ui }: { r: DekanRosterResident; isLight: boolean; ui: ReturnType<typeof dekanUI> }) {
  const meta = STATE_META[r.state]
  const chip = statusChip(meta.tone, isLight)
  return (
    <div className="flex items-center gap-2.5 rounded-xl p-1">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-bold ${isLight ? 'border-slate-200/80 bg-slate-100 text-slate-700' : 'border-slate-700 bg-slate-800 text-slate-200'}`}>
        {initials(r.fullName)}
      </div>
      <div className="min-w-0 flex-1">
        <span className={`block truncate text-xs font-semibold sm:text-sm ${ui.strong}`}>{r.fullName}</span>
        {r.state !== 'unmarked' && r.selfDistanceM != null ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400" title="Talaba GPS bilan tasdiqladi">
            <MapPin size={10} /> {r.selfDistanceM} m
          </span>
        ) : r.state === 'unmarked' && r.phone ? (
          <a href={`tel:${r.phone}`} className={`no-shelf inline-flex items-center gap-1 text-[10px] font-semibold ${ui.muted}`}>
            <Phone size={10} /> {r.phone}
          </a>
        ) : null}
      </div>
      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${chip.chip}`}>
        {r.state === 'present' ? <Check size={11} strokeWidth={2.6} /> : r.state === 'absent' ? <X size={11} strokeWidth={2.6} /> : <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />}
        {meta.label}
      </span>
    </div>
  )
}

/* ───────────────────────────── history ───────────────────────────── */

function History({
  sessions, activeId, isLight, ui, onOpen,
}: {
  sessions: DekanSessionInfo[]
  activeId: string | null
  isLight: boolean
  ui: ReturnType<typeof dekanUI>
  onOpen: (id: string) => void
}) {
  if (sessions.length === 0) return null
  return (
    <section className={`no-shelf rounded-2xl border p-4 sm:p-5 ${ui.card}`}>
      <h3 className={`mb-3 text-xs font-bold uppercase tracking-wider ${ui.muted}`}>Oldingi yo‘qlamalar</h3>
      <div className="space-y-2">
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onOpen(s.id)}
            className={`no-shelf flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border p-3 text-left transition-colors ${
              s.id === activeId ? `${ui.accentBorder} ${ui.accentSoft}` : `${ui.inset} ${isLight ? 'hover:border-slate-300' : 'hover:border-slate-600'}`
            }`}
          >
            <span className={`text-sm font-bold ${ui.strong}`}>{fmtDateTime(s.startsAt)}</span>
            <span className={`text-xs ${ui.muted}`}>{s.dormLabel}</span>
            <span className="ml-auto flex items-center gap-3 text-xs font-bold tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400">{s.summary.present} bor</span>
              <span className="text-rose-600 dark:text-rose-400">{s.summary.absent} yo‘q</span>
              <span className="text-amber-600 dark:text-amber-400">{s.summary.unmarked} bosmagan</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
