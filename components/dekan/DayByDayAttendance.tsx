'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, FileSpreadsheet, Loader2, RefreshCw, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAuthHeaders } from '@/lib/auth-session'
import { dekanUI, statusChip } from '@/lib/dekan-ui'
import type {
  DekanHistoryDay,
  DekanHistoryState,
  DekanHistoryStudent,
  DekanHistoryView,
} from '@/features/attendance/types'

const RANGES = [7, 14, 30] as const
const PAGE_SIZE = 60
const WEEKDAYS = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan']

const STATE_LABEL: Record<DekanHistoryState, string> = {
  present: 'Borman',
  absent: 'Yo‘q',
  unmarked: 'Bosmagan',
}

type UI = ReturnType<typeof dekanUI>

/** `2026-10-05` -> { short: '05.10', weekday: 'Dush' } (pure calendar maths). */
function dateParts(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return { short: `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}`, weekday }
}

function percent(day: DekanHistoryDay) {
  return day.summary.total === 0 ? 0 : Math.round((day.summary.present / day.summary.total) * 100)
}

async function fetchHistory(dormId: string, days: number): Promise<DekanHistoryView> {
  const res = await fetch(`/api/dekan/yoqlama?history=1&days=${days}&dormId=${dormId}`, {
    headers: await getAuthHeaders(),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Kunlar bo‘yicha ma’lumotni yuklab bo‘lmadi')
  return data as DekanHistoryView
}

/**
 * Several days of the dekan's own roll-calls: a card per day (open it to see
 * that day's roster) and a student × day grid with totals, so repeat
 * non-responders stand out. Export mirrors the grid.
 */
export default function DayByDayAttendance({
  dormId, dormLabel, isLight, onOpenSession,
}: {
  dormId: string
  dormLabel: string
  isLight: boolean
  onOpenSession: (sessionId: string) => void
}) {
  const ui = dekanUI(isLight)
  const [days, setDays] = useState<(typeof RANGES)[number]>(7)
  const [view, setView] = useState<DekanHistoryView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [onlyMissed, setOnlyMissed] = useState(false)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setError(null)
      setView(await fetchHistory(dormId, days))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik')
    } finally {
      setLoading(false)
    }
  }, [dormId, days])

  useEffect(() => { setView(null); void load() }, [load])
  useEffect(() => { setLimit(PAGE_SIZE) }, [query, onlyMissed, dormId, days])

  const ranDays = useMemo(() => view?.days.filter((d) => d.sessionIds.length > 0 || d.nightly).length ?? 0, [view])

  const rows = useMemo(() => {
    if (!view) return []
    const q = query.trim().toLowerCase()
    return view.students.filter((s) => {
      if (onlyMissed && s.unmarked + s.absent === 0) return false
      if (q && !s.fullName.toLowerCase().includes(q) && !s.roomNumber.toLowerCase().includes(q)) return false
      return true
    })
  }, [view, query, onlyMissed])

  const exportXlsx = async () => {
    if (!view || view.students.length === 0) { toast('Yuklab olinadigan ma’lumot yo‘q'); return }
    setExporting(true)
    try {
      const { downloadXlsx } = await import('@/lib/spreadsheet-export')
      await downloadXlsx({
        filename: `yoqlama-kunlar-${dormLabel.replace(/\s+/g, '')}-${view.dates[view.dates.length - 1]}_${view.dates[0]}.xlsx`,
        sheetName: 'Kunlar bo‘yicha',
        headers: ['№', 'F.I.Sh', 'Xona', ...view.dates.map((d) => dateParts(d).short), 'Borman', 'Yo‘q', 'Bosmagan'],
        rows: view.students.map((s, i) => [
          i + 1,
          s.fullName,
          s.roomNumber,
          ...view.dates.map((d) => (s.states[d] ? STATE_LABEL[s.states[d]] : '—')),
          s.present,
          s.absent,
          s.unmarked,
        ]),
      })
    } catch {
      toast.error('Excel faylini yaratib bo‘lmadi')
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className={`no-shelf space-y-4 rounded-2xl border p-4 sm:p-5 ${ui.card}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${ui.accentTileSoft}`}>
          <CalendarDays size={18} />
        </div>
        <div className="min-w-0">
          <h3 className={`text-sm font-bold ${ui.strong}`}>Kunlar bo‘yicha</h3>
          <p className={`text-xs ${ui.muted}`}>
            {dormLabel}
            {view && ` · ${ranDays} kunda yo‘qlama o‘tgan`}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Davr"
            className={`no-shelf inline-flex items-center gap-1 rounded-xl border p-1 ${isLight ? 'border-slate-200/80 bg-slate-100/90' : 'border-slate-800/90 bg-slate-950/70'}`}
          >
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDays(r)}
                aria-pressed={days === r}
                className={`no-shelf rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  days === r
                    ? isLight ? 'bg-white text-indigo-600 shadow-xs' : 'bg-indigo-600 text-white'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r} kun
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Yangilash"
            className={`no-shelf rounded-xl p-2 ${ui.btnGhost}`}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => void exportXlsx()}
            disabled={exporting || !view || view.students.length === 0}
            className={`no-shelf inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${ui.accentSolid}`}
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            Excel
          </button>
        </div>
      </div>

      {error ? (
        <div className={`rounded-xl border p-4 text-sm ${ui.dangerSoft}`}>
          {error}{' '}
          <button type="button" onClick={() => void load()} className="font-bold underline">Qayta urinish</button>
        </div>
      ) : !view ? (
        <div className="space-y-2" aria-busy="true">
          <div className={`h-24 animate-pulse rounded-xl ${ui.inset} border`} />
          <div className={`h-40 animate-pulse rounded-xl ${ui.inset} border`} />
        </div>
      ) : (
        <>
          <DayStrip view={view} isLight={isLight} ui={ui} onOpen={onOpenSession} />

          {ranDays === 0 ? (
            <p className={`rounded-xl border p-6 text-center text-sm ${ui.inset} ${ui.muted}`}>
              Oxirgi {days} kunda bu yotoqxonada yo‘qlama o‘tkazilmagan.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[200px] max-w-xs flex-1">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Talaba yoki xona qidirish..."
                    className={`no-shelf w-full rounded-xl border py-2 pl-9 pr-8 text-xs font-medium ${ui.input} ${ui.ring}`}
                  />
                  {query && (
                    <button type="button" aria-label="Tozalash" onClick={() => setQuery('')} className="no-shelf absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <label className={`flex cursor-pointer items-center gap-2 text-xs font-semibold ${ui.body}`}>
                  <input
                    type="checkbox"
                    checked={onlyMissed}
                    onChange={(e) => setOnlyMissed(e.target.checked)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  Faqat belgilamaganlar
                </label>
                <span className={`ml-auto text-xs tabular-nums ${ui.muted}`}>{rows.length} / {view.students.length} talaba</span>
              </div>

              <Grid view={view} rows={rows.slice(0, limit)} isLight={isLight} ui={ui} />

              {rows.length > limit && (
                <button
                  type="button"
                  onClick={() => setLimit((l) => l + PAGE_SIZE)}
                  className={`no-shelf mx-auto block rounded-xl px-4 py-2 text-xs font-bold ${ui.btnGhost}`}
                >
                  Yana {Math.min(PAGE_SIZE, rows.length - limit)} ta ko‘rsatish
                </button>
              )}
              {rows.length === 0 && (
                <p className={`rounded-xl border p-6 text-center text-sm ${ui.inset} ${ui.muted}`}>Talaba topilmadi</p>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}

/* ───────────────────────────── day cards ───────────────────────────── */

function DayStrip({
  view, isLight, ui, onOpen,
}: {
  view: DekanHistoryView
  isLight: boolean
  ui: UI
  onOpen: (sessionId: string) => void
}) {
  const good = statusChip('success', isLight)
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {view.days.map((day) => {
        const { short, weekday } = dateParts(day.date)
        const ran = day.sessionIds.length > 0 || day.nightly
        const openable = day.sessionIds.length > 0
        const pct = percent(day)
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className={`text-sm font-bold tabular-nums ${ui.strong}`}>{short}</span>
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${ui.faint}`}>{weekday}</span>
            </div>
            {ran ? (
              <>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className={`text-lg font-bold tabular-nums ${good.text}`}>{pct}%</span>
                  <span className={`text-[10px] ${ui.muted}`}>keldi</span>
                  {day.live && <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-emerald-500" title="Davom etmoqda" />}
                </div>
                <div className={`mt-1.5 h-1.5 overflow-hidden rounded-full ${isLight ? 'bg-slate-200' : 'bg-slate-700/70'}`}>
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <p className={`mt-1.5 text-[10px] tabular-nums ${ui.muted}`}>
                  {day.summary.present} / {day.summary.total}
                  {day.summary.unmarked > 0 && ` · ${day.summary.unmarked} bosmagan`}
                </p>
                {day.nightly && <p className={`mt-1 text-[10px] font-semibold ${ui.faint}`}>Kechki yo‘qlama</p>}
              </>
            ) : (
              <p className={`mt-3 text-[11px] ${ui.faint}`}>Yo‘qlama yo‘q</p>
            )}
          </>
        )
        const base = `no-shelf w-[8.5rem] shrink-0 rounded-xl border p-3 text-left ${ui.inset}`
        return openable ? (
          <button
            key={day.date}
            type="button"
            onClick={() => onOpen(day.sessionIds[0])}
            title="Shu kun yo‘qlamasini ochish"
            className={`${base} transition-colors ${isLight ? 'hover:border-slate-300' : 'hover:border-slate-600'}`}
          >
            {body}
          </button>
        ) : (
          <div key={day.date} className={`${base} ${ran ? '' : 'opacity-70'}`}>{body}</div>
        )
      })}
    </div>
  )
}

/* ───────────────────────────── student × day grid ───────────────────────────── */

const CELL: Record<DekanHistoryState, { dot: string; ring: string }> = {
  present: { dot: 'bg-emerald-500', ring: 'ring-emerald-500/30' },
  absent: { dot: 'bg-rose-500', ring: 'ring-rose-500/30' },
  unmarked: { dot: 'bg-amber-500', ring: 'ring-amber-500/30' },
}

function Grid({
  view, rows, isLight, ui,
}: {
  view: DekanHistoryView
  rows: DekanHistoryStudent[]
  isLight: boolean
  ui: UI
}) {
  const stick = isLight ? 'bg-white' : 'bg-slate-900'
  return (
    <div className={`overflow-x-auto rounded-xl border ${ui.border}`}>
      <table className="w-full min-w-max border-collapse text-xs">
        <thead>
          <tr className={isLight ? 'bg-slate-50' : 'bg-slate-800/40'}>
            <th className={`sticky left-0 z-10 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider ${ui.muted} ${isLight ? 'bg-slate-50' : 'bg-slate-900'}`}>
              Talaba
            </th>
            {view.dates.map((d) => {
              const { short, weekday } = dateParts(d)
              return (
                <th key={d} className={`px-1.5 py-2 text-center font-semibold tabular-nums ${ui.muted}`}>
                  <span className="block text-[11px]">{short}</span>
                  <span className={`block text-[10px] font-medium ${ui.faint}`}>{weekday}</span>
                </th>
              )
            })}
            <th className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Bor</th>
            <th className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Yo‘q</th>
            <th className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Bos.</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${ui.divide}`}>
          {rows.map((s) => (
            <tr key={s.id}>
              <td className={`sticky left-0 z-10 max-w-[13rem] px-3 py-2 ${stick}`}>
                <span className={`block truncate text-xs font-semibold ${ui.strong}`}>{s.fullName}</span>
                <span className={`block text-[10px] ${ui.muted}`}>
                  {s.roomNumber}{s.floor != null && ` · ${s.floor}-qavat`}
                </span>
              </td>
              {view.dates.map((d) => {
                const state = s.states[d]
                return (
                  <td key={d} className="px-1.5 py-2 text-center">
                    {state ? (
                      <span
                        title={`${dateParts(d).short}: ${STATE_LABEL[state]}`}
                        className={`inline-block h-3.5 w-3.5 rounded-full ring-2 ${CELL[state].dot} ${CELL[state].ring}`}
                      >
                        <span className="sr-only">{STATE_LABEL[state]}</span>
                      </span>
                    ) : (
                      <span className={`${ui.faint}`} aria-label="Yo‘qlama o‘tmagan">·</span>
                    )}
                  </td>
                )
              })}
              <td className="px-2 py-2 text-center font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{s.present}</td>
              <td className="px-2 py-2 text-center font-bold tabular-nums text-rose-600 dark:text-rose-400">{s.absent}</td>
              <td className="px-2 py-2 text-center font-bold tabular-nums text-amber-600 dark:text-amber-400">{s.unmarked}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
