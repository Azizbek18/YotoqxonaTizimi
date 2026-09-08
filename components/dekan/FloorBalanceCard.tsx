'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, Check, Layers, Plus } from 'lucide-react'
import { dekanUI, dekanChart, statusChip } from '@/lib/dekan-ui'
import { COURSES, MIN_DELTA, type FloorBalanceRow } from '@/lib/floor-balance'
import type { DekanFloorBalance } from '@/features/permits/types'

type BalancePayload = DekanFloorBalance

function isNearEmptyRow(row: FloorBalanceRow) {
  return row.placed < Math.max(4, row.capacity * 0.2)
}

type CellMode = 'over' | 'need' | 'ok'

/**
 * Honest, symmetric verdict for one course on one floor: being `MIN_DELTA`+
 * students off this floor's share — in either direction — is flagged as it is.
 * A near-empty floor is never told it has a surplus (its plan is still shown).
 */
function courseMode(row: FloorBalanceRow, course: number, nearEmpty: boolean) {
  const placed = row.byCourse[course]
  const target = row.targetByCourse[course]
  const gap = target - placed // +ve → place this many more of the course here
  const mode: CellMode = gap >= MIN_DELTA ? 'need' : !nearEmpty && gap <= -MIN_DELTA ? 'over' : 'ok'
  return { placed, target, gap, mode }
}

/** The one plain-language line for a floor: what's most off and what to do. */
function floorHeadline(row: FloorBalanceRow, nearEmpty: boolean) {
  if (nearEmpty) return { tone: 'neutral' as const, label: 'Hali toʻldirilmagan', Icon: Layers }
  const states = COURSES.map((c) => ({ course: c, ...courseMode(row, c, nearEmpty) }))
  const over = states.filter((s) => s.mode === 'over').sort((a, b) => a.gap - b.gap)[0]
  if (over) {
    return { tone: 'warning' as const, label: `${over.course}-kurs ${-over.gap} ta ortiqcha`, Icon: AlertTriangle }
  }
  const need = states.filter((s) => s.mode === 'need').sort((a, b) => b.gap - a.gap)[0]
  if (need) {
    return { tone: 'info' as const, label: `${need.course}-kursdan ${need.gap} ta kerak`, Icon: Plus }
  }
  return { tone: 'success' as const, label: 'Muvozanatli', Icon: Check }
}

/**
 * One course on one floor. The focal number is the concrete action —
 * how many students of this course still need placing here (`+N`), how many
 * are surplus (`N`), or `✓` when the floor already holds its share. A tinted
 * cell (amber = surplus, indigo = short, plain = fine) and the honest
 * `hozir N · meʼyor N` breakdown underneath.
 */
function CourseCell({
  row,
  course,
  colorIndex,
  ramp,
  isLight,
  nearEmpty,
}: {
  row: FloorBalanceRow
  course: number
  colorIndex: number
  ramp: string[]
  isLight: boolean
  nearEmpty: boolean
}) {
  const ui = dekanUI(isLight)
  const { placed, target, gap, mode } = courseMode(row, course, nearEmpty)

  const chip =
    mode === 'over'
      ? statusChip('warning', isLight)
      : mode === 'need'
        ? statusChip('info', isLight)
        : statusChip('success', isLight)

  const cellTone =
    mode === 'over'
      ? isLight
        ? 'bg-amber-50 ring-amber-200/70'
        : 'bg-amber-500/10 ring-amber-500/25'
      : mode === 'need'
        ? isLight
          ? 'bg-indigo-50 ring-indigo-200/70'
          : 'bg-indigo-500/10 ring-indigo-500/25'
        : isLight
          ? 'bg-white ring-slate-200'
          : 'bg-slate-900/40 ring-slate-700/60'

  // Progress toward the floor's share for this course — plain count ratio,
  // capped so a surplus just shows a full bar.
  const barPct = target > 0 ? Math.min(100, (placed / target) * 100) : placed > 0 ? 100 : 0
  // Only the two action states get a coloured bar — "yetarli" stays calm so the
  // eye lands on the cells that still need work.
  const barColor =
    mode === 'over'
      ? isLight
        ? 'bg-amber-400'
        : 'bg-amber-500'
      : mode === 'need'
        ? 'bg-indigo-500'
        : isLight
          ? 'bg-slate-300'
          : 'bg-slate-600'

  const bigNumber = mode === 'over' ? `${placed - target}` : mode === 'need' ? `+${gap}` : '✓'
  const bigWord = mode === 'over' ? 'ortiqcha' : mode === 'need' ? 'qoʻshish' : 'yetarli'

  return (
    <div className={`flex flex-col items-center rounded-xl px-2 py-3 text-center ring-1 ring-inset ${cellTone}`}>
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: ramp[colorIndex] }} />
        <span className={`text-[8px] font-bold uppercase tracking-wider ${ui.muted}`}>{course}-kurs</span>
      </div>

      <div className={`mt-1.5 text-2xl font-black leading-none tabular-nums ${chip.text}`}>{bigNumber}</div>
      <div className={`mt-0.5 text-[9px] font-bold uppercase tracking-wide ${chip.text}`}>{bigWord}</div>

      <div className={`mt-2 h-1.5 w-full rounded-full ${isLight ? 'bg-slate-200' : 'bg-slate-700/60'}`}>
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${Math.max(barPct, placed > 0 ? 6 : 0)}%` }}
        />
      </div>

      <span className={`mt-1.5 text-[9px] font-medium tabular-nums ${ui.faint}`}>
        hozir {placed} · meʼyor {target}
      </span>
    </div>
  )
}

function FloorBlock({
  row,
  ramp,
  isLight,
}: {
  row: FloorBalanceRow
  ramp: string[]
  isLight: boolean
}) {
  const ui = dekanUI(isLight)
  const nearEmpty = isNearEmptyRow(row)
  const head = floorHeadline(row, nearEmpty)
  const chip = statusChip(head.tone, isLight)
  const free = Math.max(0, row.capacity - row.placed)

  return (
    <div className={`rounded-xl border p-3.5 ${ui.inset}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className={`text-xs font-bold ${ui.strong}`}>{row.floor}-qavat</span>
          <span className={`text-[10px] font-medium tabular-nums ${ui.muted}`}>
            {row.placed} / {row.capacity} joy{free > 0 ? ` · ${free} ta boʻsh` : ''}
          </span>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${chip.chip}`}
        >
          <head.Icon size={10} /> {head.label}
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {COURSES.map((c, i) => (
          <CourseCell
            key={c}
            row={row}
            course={c}
            colorIndex={i}
            ramp={ramp}
            isLight={isLight}
            nearEmpty={nearEmpty}
          />
        ))}
      </div>
    </div>
  )
}

export default function FloorBalanceCard({
  balance,
  isLight,
  onlyFloor,
  className = '',
}: {
  balance: BalancePayload | undefined
  isLight: boolean
  /** Render just this one floor (compact form for the room-map sidebar). */
  onlyFloor?: number
  className?: string
}) {
  const ui = dekanUI(isLight)
  const ramp = dekanChart.courseRamp(isLight)

  const rows = (balance?.floors ?? []).filter((f) => onlyFloor == null || f.floor === onlyFloor)

  // Faculty course mix — the ratio every floor should mirror.
  const houseTotal = COURSES.reduce((sum, c) => sum + (balance?.totalToHouse[c] ?? 0), 0)
  const mixPct = COURSES.map((c) =>
    houseTotal > 0 ? Math.round(((balance?.totalToHouse[c] ?? 0) / houseTotal) * 100) : 0,
  )

  if (onlyFloor != null) {
    const row = rows[0]
    if (!row) return null
    return <FloorBlock row={row} ramp={ramp} isLight={isLight} />
  }

  // "Hali joylashtirilmagan" — totalToHouse already counts placed + roomless.
  const placedByCourse = COURSES.map((c) => rows.reduce((sum, r) => sum + r.byCourse[c], 0))
  const unplaced = COURSES.map((c, i) => Math.max(0, (balance?.totalToHouse[c] ?? 0) - placedByCourse[i]))
  const anyUnplaced = unplaced.some((n) => n > 0)
  const totalPlaced = rows.reduce((sum, r) => sum + r.placed, 0)
  const totalCap = rows.reduce((sum, r) => sum + r.capacity, 0)

  return (
    <div className={`rounded-2xl border p-5 ${ui.card} ${className}`}>
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${ui.accentTileSoft}`}>
          <Layers size={16} />
        </span>
        <div className="min-w-0">
          <h3 className={`text-sm font-bold ${ui.strong}`}>Qavatlar boʻyicha kurs balansi</h3>
          <p className={`mt-0.5 text-[11px] font-medium leading-snug ${ui.muted}`}>
            Har qavat fakultetning kurs tarkibini takrorlashi kerak. Har katakda shu qavatga yana nechta talaba
            joylashtirish kerakligi koʻrsatilgan.
          </p>
        </div>
      </div>

      {houseTotal > 0 && (
        <div className={`mt-3 rounded-xl border p-3 ${ui.inset}`}>
          <p className={`text-[9px] font-bold uppercase tracking-wider ${ui.muted}`}>
            Fakultet talabalari — har qavat shu tarkibda boʻlishi kerak
          </p>
          <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full">
            {COURSES.map((c, i) =>
              mixPct[i] > 0 ? (
                <div
                  key={c}
                  style={{ width: `${mixPct[i]}%`, backgroundColor: ramp[i] }}
                  title={`${c}-kurs — ${balance?.totalToHouse[c] ?? 0} ta`}
                />
              ) : null,
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {COURSES.map((c, i) => (
              <span key={c} className={`inline-flex items-center gap-1 text-[10px] font-medium ${ui.body}`}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ramp[i] }} />
                {c}-kurs <b className={ui.strong}>{balance?.totalToHouse[c] ?? 0} ta</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {anyUnplaced && (
        <div className={`mt-2.5 rounded-xl border p-3 ${ui.inset}`}>
          <p className={`text-[9px] font-bold uppercase tracking-wider ${ui.muted}`}>Hali joylashtirilmagan talabalar</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {COURSES.map((c, i) => (
              <span
                key={c}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                  unplaced[i] > 0
                    ? statusChip('info', isLight).chip
                    : isLight
                      ? 'bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200'
                      : 'bg-slate-800 text-slate-500 ring-1 ring-inset ring-slate-700'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ramp[i] }} />
                {c}-kurs: {unplaced[i]}
              </span>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className={`py-8 text-center text-xs font-medium ${ui.faint}`}>
          Xonalar tarxi kiritilmagan — avval qavatlarni sozlang
        </p>
      ) : (
        <>
          <div className="mt-3.5 space-y-2.5">
            {rows.map((row) => (
              <FloorBlock key={row.floor} row={row} ramp={ramp} isLight={isLight} />
            ))}
          </div>
          {totalCap > 0 && (
            <p className={`mt-3 text-[10px] font-medium tabular-nums ${ui.muted}`}>
              Jami: {totalPlaced} / {totalCap} joy band · {Math.max(0, totalCap - totalPlaced)} ta boʻsh
            </p>
          )}
        </>
      )}

      <div className="mt-3 flex justify-end">
        <Link
          href="/dekan/xonalar"
          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${ui.accentText}`}
        >
          Xonalar xaritasida joylashtirish <ArrowRight size={10} />
        </Link>
      </div>
    </div>
  )
}
