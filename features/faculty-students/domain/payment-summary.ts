import type { FacultyPaymentRecord } from '../types'

export type PayState = 'paid' | 'partial' | 'none'

export type PaySummary = {
  paid: number
  waiting: number
  remaining: number
  contractFee: number
  progressPercent: number
  state: PayState
  hasWaiting: boolean
}

export const APPROVED_PAYMENT_STATUSES = new Set(['paid', 'approved'])
export const WAITING_PAYMENT_STATUSES = new Set(['waiting', 'pending'])

export const PAY_STATE_LABELS: Record<PayState, string> = {
  paid: "To'liq to'lagan",
  partial: 'Qisman',
  none: "To'lov yo'q",
}

export const PAY_STATE_BADGE_CLASSES: Record<PayState, string> = {
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  partial: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  none: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
}

export function formatSum(value: number) {
  return `${value.toLocaleString('uz-UZ')} so'm`
}

/**
 * Per-student debt position against the yearly contract fee. Shared by the
 * dekan Talabalar list and the export page so a student can never be
 * "qarzdor" on one screen and not on the other.
 *
 * `contractFee` is required rather than defaulted: every figure here is
 * measured against it, so a guessed value would produce debt numbers that
 * look real but aren't. Callers hold off until the setting has loaded.
 */
export function buildPaySummaries(
  students: readonly { id: string }[],
  payments: readonly FacultyPaymentRecord[],
  contractFee: number,
) {
  const map = new Map<string, PaySummary>()
  for (const student of students) {
    map.set(student.id, {
      paid: 0,
      waiting: 0,
      remaining: contractFee,
      contractFee,
      progressPercent: 0,
      state: 'none',
      hasWaiting: false,
    })
  }

  for (const record of payments) {
    const summary = map.get(record.student_id)
    if (!summary) continue
    if (APPROVED_PAYMENT_STATUSES.has(record.status)) {
      summary.paid += record.amount
    } else if (WAITING_PAYMENT_STATUSES.has(record.status)) {
      summary.waiting += record.amount
      summary.hasWaiting = true
    }
  }

  for (const summary of map.values()) {
    summary.remaining = Math.max(0, summary.contractFee - summary.paid)
    summary.progressPercent = summary.contractFee
      ? Math.min(100, Math.round((summary.paid / summary.contractFee) * 100))
      : 0
    summary.state = summary.paid >= summary.contractFee ? 'paid' : summary.paid > 0 ? 'partial' : 'none'
  }

  return map
}
