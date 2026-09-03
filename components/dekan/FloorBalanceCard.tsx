'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowDown, ArrowRight, Check, Layers } from 'lucide-react'
import { dekanUI, dekanChart, statusChip } from '@/lib/dekan-ui'
import { COURSES, type FloorBalanceRow } from '@/lib/floor-balance'
import type { DekanFloorBalance } from '@/features/permits/types'

type BalancePayload = DekanFloorBalance

function courseStatusTone(kind: 'over' | 'under' | 'ok') {
  return kind === 'over' ? 'warning' : kind === 'under' ? 'info' : 'success'
}

/** "1-kurs ko'p" / "4-kurs kam" / "Muvozanatli" / "Kam to'lgan". */
function floorHeadline(row: FloorBalanceRow, nearEmpty: boolean) {
  if (nearEmpty) return { tone: 'neutral' as const, label: 'Kam toʻlgan', Icon: Layers }
  if (!row.worst) return { tone: 'success' as const, label: 'Muvozanatli', Icon: Check }
  return row.worst.kind === 'over'
    ? { tone: 'warning' as const, label: `${row.worst.course}-kurs koʻp`, Icon: AlertTriangle }
    : { tone: 'info' as const, label: `${row.worst.course}-kurs kam`, Icon: ArrowDown }
}

function FloorBlock({ row, ramp, isLight }: { row: FloorBalanceRow; ramp: string[]; isLight: boolean }) {
  const ui = dekanUI(isLight)
  const nearEmpty = row.placed < Math.max(4, row.capacity * 0.2)
  const head = floorHeadline(row, nearEmpty)
  const chip = statusChip(head.tone, isLight)

  const total = COURSES.reduce((s, c) => s + row.byCourse[c], 0)

  return (
    <div className={`rounded-xl border p-3 ${ui.inset}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className={`text-xs font-bold ${ui.strong}`}>{row.floor}-qavat</span>
          <span className={`ml-2 text-[10px] font-medium ${ui.muted}`}>{row.placed} / {row.capacity} joy</span>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${chip.chip}`}>
          <head.Icon size={10} /> {head.label}
        </span>
      </div>

      {/* Proportion bar — one shade per course, 2px surface gaps. A floor
          stacked with one course shows one dominant shade. */}
      {total > 0 && (
        <div className="mt-2 flex h-2 gap-[2px] overflow-hidden rounded-full">
          {COURSES.map((c, i) =>
            row.byCourse[c] > 0 ? (
              <div
                key={c}
                title={`${c}-kurs: ${row.byCourse[c]} ta`}
                style={{ width: `${(row.byCourse[c] / total) * 100}%`, backgroundColor: ramp[i] }}
              />
            ) : null,
          )}
        </div>
      )}

      {/* Per-course: placed / target + status. The literal, no-color-needed read. */}
      <div className="mt-2.5 grid grid-cols-4 gap-1.5">
        {COURSES.map((c, i) => {
          const kind = row.statusByCourse[c]
          const cellTone = kind === 'over'
            ? (isLight ? 'bg-amber-50 ring-amber-100' : 'bg-amber-500/10 ring-amber-500/20')
            : kind === 'under'
              ? (isLight ? 'bg-indigo-50 ring-indigo-100' : 'bg-indigo-500/10 ring-indigo-500/20')
              : `${ui.card} ring-transparent`
          const st = statusChip(courseStatusTone(kind), isLight)
          return (
            <div key={c} className={`rounded-lg px-1.5 py-1.5 text-center ring-1 ring-inset ${cellTone}`}>
              <div className="flex items-center justify-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ramp[i] }} />
                <span className={`text-[8px] font-bold uppercase tracking-wider ${ui.muted}`}>{c}-kurs</span>
              </div>
              <div className={`mt-0.5 text-sm font-black tabular-nums ${kind === 'ok' ? ui.strong : st.text}`}>
                {row.byCourse[c]}
              </div>
              <div className={`text-[9px] font-medium tabular-nums ${ui.faint}`}>kerak: {row.targetByCourse[c]}</div>
            </div>
          )
        })}
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

  if (onlyFloor != null) {
    const row = rows[0]
    if (!row) return null
    return <FloorBlock row={row} ramp={ramp} isLight={isLight} />
  }

  return (
    <div className={`rounded-2xl border p-5 ${ui.card} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={`text-sm font-bold ${ui.strong}`}>Qavatlar boʻyicha kurs balansi</h3>
          <p className={`mt-0.5 text-[10px] font-medium ${ui.muted}`}>
            Har qavat fakultetning kurs nisbatini takrorlashi kerak
          </p>
        </div>
        <div className={`hidden shrink-0 items-center gap-3 text-[9px] font-medium sm:flex ${ui.muted}`}>
          {COURSES.map((c, i) => (
            <span key={c} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded" style={{ backgroundColor: ramp[i] }} /> {c}-kurs
            </span>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className={`py-8 text-center text-xs font-medium ${ui.faint}`}>
          Xonalar tarxi kiritilmagan — avval qavatlarni sozlang
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {rows.map((row) => (
            <FloorBlock key={row.floor} row={row} ramp={ramp} isLight={isLight} />
          ))}
        </div>
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
