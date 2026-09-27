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

  it('rejects a tampered payload (also proves the email is not just base64 — a bit-flip must break decryption, not merely the signature)', () => {
    const { code, challenge } = issueEmailChallenge('ali@example.com')
    const [payload, sig] = challenge.split('.')
    const bytes = Buffer.from(payload, 'base64url')
    bytes[bytes.length - 1] ^= 0xff // flip the last ciphertext byte
    const tampered = bytes.toString('base64url')
    expect(verifyEmailChallenge(`${tampered}.${sig}`, code)).toBeNull()
    expect(readEmailChallenge(`${tampered}.${sig}`)).toBeNull()
  })

  it('exposes the nonce for attempt limiting, but never the email in a form readable without the server secret', () => {
    const { challenge } = issueEmailChallenge('ali@example.com')
    expect(readEmailChallenge(challenge)).toMatchObject({ email: 'ali@example.com', expired: false })
    expect(readEmailChallenge('garbage')).toBeNull()
    const [payload] = challenge.split('.')
    expect(Buffer.from(payload, 'base64url').toString('utf8')).not.toContain('ali@example.com')
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
