import { describe, expect, it } from 'vitest'
import { isPermissionDeniedError } from './verify-remote-helpers.mjs'

describe('remote verification error classification', () => {
  it('accepts only explicit authorization failures', () => {
    expect(isPermissionDeniedError({ code: '42501', message: 'permission denied for function' })).toBe(true)
    expect(isPermissionDeniedError({ message: 'not authorized' })).toBe(true)
  })

  it('rejects network, schema and API-key failures', () => {
    expect(isPermissionDeniedError(new TypeError('fetch failed'))).toBe(false)
    expect(isPermissionDeniedError({ code: '42P01', message: 'relation does not exist' })).toBe(false)
    expect(isPermissionDeniedError({ message: 'Invalid API key' })).toBe(false)
  })
})
