import { describe, expect, it } from 'vitest'
import {
  isSuspiciousPaymentTransactionId,
  normalizePaymentTransactionId,
  parsePaymentAmount,
  PaymentValidationError,
  validatePaymentReview,
} from './validation'

const paymentId = '123e4567-e89b-12d3-a456-426614174000'

describe('payment review validation', () => {
  it('normalizes a valid review command', () => {
    expect(validatePaymentReview({ ids: [paymentId, paymentId], status: 'approved', message: ' Tasdiqlandi ' }))
      .toEqual({ ids: [paymentId], status: 'approved', message: 'Tasdiqlandi' })
  })

  it('rejects malformed identifiers', () => {
    expect(() => validatePaymentReview({ ids: ['bad-id'], status: 'approved', message: 'ok' }))
      .toThrowError(PaymentValidationError)
  })

  it('requires an admin message', () => {
    expect(() => validatePaymentReview({ ids: [paymentId], status: 'rejected', message: ' ' }))
      .toThrowError('Admin izohi talab qilinadi')
  })
})

describe('payment submission validation', () => {
  it('normalizes transaction identifiers consistently with the database', () => {
    expect(normalizePaymentTransactionId(' trx-9a 7b/4c2d ')).toBe('TRX9A7B4C2D')
  })

  it('rejects placeholder and sequential transaction identifiers', () => {
    expect(isSuspiciousPaymentTransactionId('TX12345678')).toBe(true)
    expect(isSuspiciousPaymentTransactionId('9876543210')).toBe(true)
    expect(isSuspiciousPaymentTransactionId('TRX9A7B4C2D')).toBe(false)
  })

  it('accepts only finite, positive, safe payment amounts', () => {
    expect(parsePaymentAmount('500000')).toBe(500000)
    expect(() => parsePaymentAmount('Infinity')).toThrowError(PaymentValidationError)
    expect(() => parsePaymentAmount('-1')).toThrowError('To‘lov summasi noto‘g‘ri')
  })
})
