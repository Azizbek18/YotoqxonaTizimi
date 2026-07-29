import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./route.ts', import.meta.url), 'utf8')

describe('student registration security invariants', () => {
  it('never assigns a requester-supplied password before email proof', () => {
    expect(source).toContain('randomBytes(48)')
    expect(source).toContain('inaccessiblePassword')
    expect(source).not.toContain('body.password')
    expect(source).not.toContain('body.confirmPassword')
  })

  it('creates a pending profile and leaves permit consumption to activation', () => {
    expect(source).toContain("status: 'pending'")
    expect(source).not.toContain(".update({ status: 'registered'")
    expect(source).toContain('requiresEmailVerification: true')
  })
})
