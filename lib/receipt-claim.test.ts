import { beforeEach, describe, expect, it } from 'vitest'
import { signFileClaim, verifyFileClaim } from './receipt-claim'

describe('receipt claim context binding', () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-secret'
  })

  it('verifies the exact file and transaction context', () => {
    const context = { userId: 'student-1', amount: 500000, transactionId: 'TRX9A7B4C2D' }
    const claim = signFileClaim('payment', 'a'.repeat(64), context)

    expect(verifyFileClaim('payment', claim, 'a'.repeat(64), context)).toBe(true)
    expect(verifyFileClaim('payment', claim, 'a'.repeat(64), {
      ...context,
      transactionId: 'TRX8Z6Y3X1W',
    })).toBe(false)
  })

  it('does not allow separator characters to create an ambiguous context', () => {
    const original = { a: 'x&b=y', b: 'z' }
    const collidingUnderLegacyFormat = { a: 'x', b: 'y&b=z' }
    const claim = signFileClaim('test', 'b'.repeat(64), original)

    expect(verifyFileClaim('test', claim, 'b'.repeat(64), collidingUnderLegacyFormat)).toBe(false)
  })
})
