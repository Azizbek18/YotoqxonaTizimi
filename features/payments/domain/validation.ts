import type { PaymentStatus } from '../types'

export type PaymentValidationErrorCode =
  | 'INVALID_PAYMENT_IDS'
  | 'INVALID_PAYMENT_STATUS'
  | 'INVALID_PAYMENT_AMOUNT'
  | 'ADMIN_MESSAGE_REQUIRED'

export class PaymentValidationError extends Error {
  constructor(public readonly code: PaymentValidationErrorCode, message: string) {
    super(message)
    this.name = 'PaymentValidationError'
  }
}

// The dorm billing year runs Sentabr -> Iyun (no charge over the Iyul/Avgust
// summer break) — NOT the calendar-year Yanvar -> Dekabr order. This is the
// single source of truth for that order so the student's chek-yuklash page
// can share it instead of keeping its own copy: it used to hardcode a
// separate Yanvar-first, 12-month list that both started the picker on the
// wrong month and let Iyul/Avgust be selected even though they'd always be
// rejected here.
export const PAYMENT_MONTHS_ORDER = [
  'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
] as const

export type PaymentMonth = typeof PAYMENT_MONTHS_ORDER[number]

export const PAYMENT_MONTHS = new Set<string>(PAYMENT_MONTHS_ORDER)

// Sentabr-Dekabr fall in the academic year's start calendar year; Yanvar-Iyun
// roll over into the next one (an academic year that "starts" in 2026 pays
// Yanvar..Iyun 2027). Index 4 is Yanvar — the rollover point.
const PAYMENT_MONTH_ROLLOVER_INDEX = 4

export function calendarYearForPaymentMonth(month: string, academicYearStart: number): number {
  const idx = PAYMENT_MONTHS_ORDER.indexOf(month as PaymentMonth)
  return idx >= PAYMENT_MONTH_ROLLOVER_INDEX ? academicYearStart + 1 : academicYearStart
}

export function normalizePaymentTransactionId(value: unknown): string {
  return typeof value === 'string'
    ? value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    : ''
}

export function isSuspiciousPaymentTransactionId(normalizedId: string): boolean {
  if (normalizedId.length < 6 || normalizedId.length > 128) return true

  const knownPlaceholders = new Set(['TX12345678', 'TX99281726', 'NA', 'TEST', 'TXXXXXXXXX'])
  if (knownPlaceholders.has(normalizedId)) return true

  const digitsOnly = normalizedId.replace(/[^0-9]/g, '')
  if (digitsOnly.length < 6) return false
  if (/^(\d)\1+$/.test(digitsOnly)) return true

  let ascending = true
  let descending = true
  for (let index = 1; index < digitsOnly.length; index += 1) {
    const previous = Number(digitsOnly[index - 1])
    const current = Number(digitsOnly[index])
    if (current !== (previous + 1) % 10) ascending = false
    if (current !== (previous + 9) % 10) descending = false
  }
  return ascending || descending
}

export function parsePaymentAmount(value: unknown): number {
  const amount = Number(value)
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100_000_000) {
    throw new PaymentValidationError('INVALID_PAYMENT_AMOUNT', 'To‘lov summasi noto‘g‘ri')
  }
  return amount
}

export function validatePaymentReview(input: { ids: unknown; status: unknown; message: unknown }) {
  const ids = Array.isArray(input.ids) ? Array.from(new Set(input.ids.map(String))) : []
  const status = input.status
  const message = String(input.message ?? '').trim().slice(0, 500)
  if (ids.length === 0 || ids.length > 24 || ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
    throw new PaymentValidationError('INVALID_PAYMENT_IDS', 'To‘lov identifikatorlari noto‘g‘ri')
  }
  if (status !== 'approved' && status !== 'rejected') {
    throw new PaymentValidationError('INVALID_PAYMENT_STATUS', 'To‘lov holati noto‘g‘ri')
  }
  if (!message) {
    throw new PaymentValidationError('ADMIN_MESSAGE_REQUIRED', 'Admin izohi talab qilinadi')
  }
  return { ids, status: status as Extract<PaymentStatus, 'approved' | 'rejected'>, message }
}
