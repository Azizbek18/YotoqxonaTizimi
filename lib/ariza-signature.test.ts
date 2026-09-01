import { describe, expect, it } from 'vitest'

process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-secret-key-for-ariza-signature'

const {
  buildArizaSnapshot,
  canonicalJson,
  makeVerifyCode,
  normalizeVerifyCode,
  sha256Hex,
  signAriza,
  verifyArizaRecord,
  verifyArizaSignature,
} = await import('./ariza-signature')

const binding = {
  contentHash: 'a'.repeat(64),
  studentId: '11111111-1111-1111-1111-111111111111',
  signedAt: '2026-09-02T09:30:00.000Z',
  verifyCode: 'YT-8F3K-2Q9D',
}

describe('canonicalJson', () => {
  it('is key-order independent', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }))
  })
})

describe('makeVerifyCode / normalizeVerifyCode', () => {
  it('produces the YT-XXXX-XXXX shape with an unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = makeVerifyCode()
      expect(code).toMatch(/^YT-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    }
  })
  it('normalizes user input (spaces, lowercase, missing dashes)', () => {
    expect(normalizeVerifyCode(' yt8f3k2q9d ')).toBe('YT-8F3K-2Q9D')
    expect(normalizeVerifyCode('8F3K2Q9D')).toBe('YT-8F3K-2Q9D')
    expect(normalizeVerifyCode('YT-8F3K-2Q9D')).toBe('YT-8F3K-2Q9D')
  })
  it('rejects malformed codes', () => {
    expect(normalizeVerifyCode('abc')).toBe('')
    expect(normalizeVerifyCode('')).toBe('')
  })
})

describe('signAriza / verifyArizaSignature', () => {
  it('round-trips', () => {
    const sig = signAriza(binding)
    expect(verifyArizaSignature(binding, sig)).toBe(true)
  })
  it('fails when any bound field changes', () => {
    const sig = signAriza(binding)
    expect(verifyArizaSignature({ ...binding, contentHash: 'b'.repeat(64) }, sig)).toBe(false)
    expect(verifyArizaSignature({ ...binding, studentId: 'x' }, sig)).toBe(false)
    expect(verifyArizaSignature({ ...binding, signedAt: '2026-01-01T00:00:00.000Z' }, sig)).toBe(false)
    expect(verifyArizaSignature({ ...binding, verifyCode: 'YT-0000-0000' }, sig)).toBe(false)
  })
  it('rejects junk', () => {
    expect(verifyArizaSignature(binding, '')).toBe(false)
    expect(verifyArizaSignature(binding, 42 as unknown)).toBe(false)
  })
})

describe('verifyArizaRecord — tamper detection', () => {
  const snapshot = buildArizaSnapshot({
    arizaId: 'aaaa', studentId: binding.studentId, studentName: 'Aliyev Vali Akmal oʻgʻli',
    faculty: 'amit', direction: 'amaliy-matematika', course: 3,
    title: 'Tungi ruxsat soʻrovi', type: 'ariza', reason: 'sabab', text: 'ariza matni',
    signedAt: binding.signedAt,
  })
  const contentHash = sha256Hex(canonicalJson(snapshot))
  const signature = signAriza({ ...binding, contentHash })

  it('valid record verifies', () => {
    const r = verifyArizaRecord({ contentSnapshot: snapshot, contentHash, studentId: binding.studentId, signedAt: binding.signedAt, verifyCode: binding.verifyCode, signature })
    expect(r).toEqual({ hashOk: true, signatureOk: true, valid: true })
  })
  it('edited snapshot → hash mismatch', () => {
    const r = verifyArizaRecord({ contentSnapshot: { ...snapshot, text: 'boshqa matn' }, contentHash, studentId: binding.studentId, signedAt: binding.signedAt, verifyCode: binding.verifyCode, signature })
    expect(r.hashOk).toBe(false)
    expect(r.valid).toBe(false)
  })
  it('edited hash → signature mismatch', () => {
    const r = verifyArizaRecord({ contentSnapshot: snapshot, contentHash: 'c'.repeat(64), studentId: binding.studentId, signedAt: binding.signedAt, verifyCode: binding.verifyCode, signature })
    expect(r.signatureOk).toBe(false)
    expect(r.valid).toBe(false)
  })
})
