import { describe, expect, it } from 'vitest'

process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-secret-key-for-email-proof'

const {
  CODE_TTL_MS,
  PROOF_TTL_MS,
  hasEmailProof,
  issueEmailChallenge,
  issueEmailProof,
  readEmailChallenge,
  verifyEmailChallenge,
} = await import('./email-proof')

describe('email challenge', () => {
  it('verifies the mailed code and returns the normalised email', () => {
    const { code, challenge } = issueEmailChallenge('  Ali@Example.COM ')
    expect(code).toMatch(/^\d{6}$/)
    expect(verifyEmailChallenge(challenge, code)).toBe('ali@example.com')
  })

  it('rejects a wrong code', () => {
    const { code, challenge } = issueEmailChallenge('ali@example.com')
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0')
    expect(verifyEmailChallenge(challenge, wrong)).toBeNull()
  })

  it('rejects an expired challenge', () => {
    const now = Date.now()
    const { code, challenge } = issueEmailChallenge('ali@example.com', now)
    expect(verifyEmailChallenge(challenge, code, now + CODE_TTL_MS + 1)).toBeNull()
  })

  it('rejects a challenge whose email was swapped', () => {
    const { code, challenge } = issueEmailChallenge('ali@example.com')
    const [payload, sig] = challenge.split('.')
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    const forged = Buffer.from(JSON.stringify({ ...data, e: 'victim@example.com' })).toString('base64url')
    expect(verifyEmailChallenge(`${forged}.${sig}`, code)).toBeNull()
  })

  it('exposes the nonce for attempt limiting', () => {
    const { challenge } = issueEmailChallenge('ali@example.com')
    expect(readEmailChallenge(challenge)).toMatchObject({ email: 'ali@example.com', expired: false })
    expect(readEmailChallenge('garbage')).toBeNull()
  })
})

describe('email proof', () => {
  it('accepts the proven email only', () => {
    const { proof } = issueEmailProof('ali@example.com')
    expect(hasEmailProof(proof, 'ALI@example.com ')).toBe(true)
    expect(hasEmailProof(proof, 'vali@example.com')).toBe(false)
  })

  it('expires', () => {
    const now = Date.now()
    const { proof } = issueEmailProof('ali@example.com', now)
    expect(hasEmailProof(proof, 'ali@example.com', now + PROOF_TTL_MS + 1)).toBe(false)
  })

  it('cannot be minted from a challenge (different MAC domain)', () => {
    const { challenge } = issueEmailChallenge('ali@example.com')
    expect(hasEmailProof(challenge, 'ali@example.com')).toBe(false)
    expect(hasEmailProof(undefined, 'ali@example.com')).toBe(false)
  })
})
