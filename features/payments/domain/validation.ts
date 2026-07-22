import type { PaymentStatus } from '../types'

export type PaymentValidationErrorCode =
  | 'INVALID_PAYMENT_IDS'
  | 'INVALID_PAYMENT_STATUS'
  | 'ADMIN_MESSAGE_REQUIRED'

export class PaymentValidationError extends Error {
  constructor(public readonly code: PaymentValidationErrorCode, message: string) {
    super(message)
    this.name = 'PaymentValidationError'
  }
}

export const PAYMENT_MONTHS = new Set([
  'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr', 'Yanvar',
  'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
])

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
