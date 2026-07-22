import { describe, expect, it } from 'vitest'
import { PaymentValidationError, validatePaymentReview } from './validation'

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
