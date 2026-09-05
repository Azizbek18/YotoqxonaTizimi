import { describe, expect, it } from 'vitest'
import {
  calendarYearForPaymentMonth,
  isSuspiciousPaymentTransactionId,
  normalizePaymentTransactionId,
  parsePaymentAmount,
  PAYMENT_MONTHS_ORDER,
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

describe('academic-year payment month order', () => {
  it('starts the billing year at Sentabr, not Yanvar — and skips the summer break', () => {
    expect(PAYMENT_MONTHS_ORDER[0]).toBe('Sentabr')
    expect(PAYMENT_MONTHS_ORDER).not.toContain('Iyul')
    expect(PAYMENT_MONTHS_ORDER).not.toContain('Avgust')
    expect(PAYMENT_MONTHS_ORDER).toHaveLength(10)
  })

  it('keeps Sentabr..Dekabr in the academic year\'s own start year', () => {
    expect(calendarYearForPaymentMonth('Sentabr', 2026)).toBe(2026)
    expect(calendarYearForPaymentMonth('Oktabr', 2026)).toBe(2026)
    expect(calendarYearForPaymentMonth('Noyabr', 2026)).toBe(2026)
    expect(calendarYearForPaymentMonth('Dekabr', 2026)).toBe(2026)
  })

  it('rolls Yanvar..Iyun over into the following calendar year', () => {
    expect(calendarYearForPaymentMonth('Yanvar', 2026)).toBe(2027)
    expect(calendarYearForPaymentMonth('Fevral', 2026)).toBe(2027)
    expect(calendarYearForPaymentMonth('Iyun', 2026)).toBe(2027)
  })
})
