import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isNetworkUnreachable, logDegradedFallback } from './network-error'

describe('isNetworkUnreachable', () => {
  it('is false for null/undefined/non-object errors', () => {
    expect(isNetworkUnreachable(null)).toBe(false)
    expect(isNetworkUnreachable(undefined)).toBe(false)
    expect(isNetworkUnreachable('boom')).toBe(false)
  })

  it('is false for a genuine data/query error', () => {
    expect(isNetworkUnreachable(new Error('duplicate key value violates unique constraint'))).toBe(false)
  })

  it('is true for a fetch failed TypeError (undici cannot reach the host)', () => {
    expect(isNetworkUnreachable(new TypeError('fetch failed'))).toBe(true)
  })

  it('is true for a top-level unreachable-network error code', () => {
    expect(isNetworkUnreachable(Object.assign(new Error('blocked'), { code: 'EACCES' }))).toBe(true)
    expect(isNetworkUnreachable(Object.assign(new Error('no dns'), { code: 'ENOTFOUND' }))).toBe(true)
  })

  it('is true for a network error code nested in .cause (undici wraps it there)', () => {
    expect(isNetworkUnreachable(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }))).toBe(true)
  })

  it('is false for an unrelated error code', () => {
    expect(isNetworkUnreachable(Object.assign(new Error('nope'), { code: 'SOME_OTHER_CODE' }))).toBe(false)
  })
})

describe('logDegradedFallback', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('error-logs a genuine data/query error in full, every time', () => {
    const err = new Error('duplicate key value violates unique constraint')
    logDegradedFallback(`scope-a-${Math.random()}`, err)
    logDegradedFallback(`scope-a2-${Math.random()}`, err)
    expect(errorSpy).toHaveBeenCalledTimes(2)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('warns once per scope for a network-unreachable error, with just the message (no full stack dump)', () => {
    const scope = `network-scope-${Math.random()}`
    logDegradedFallback(scope, new TypeError('fetch failed'))
    logDegradedFallback(scope, new TypeError('fetch failed'))
    logDegradedFallback(scope, new TypeError('fetch failed'))
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).not.toHaveBeenCalled()
    const [line] = warnSpy.mock.calls[0]
    expect(line).toContain('fetch failed')
    expect(line).not.toContain('at ') // no stack trace frames leaked into the message
  })

  it('does not suppress a different scope’s first network warning', () => {
    logDegradedFallback(`scope-b1-${Math.random()}`, new TypeError('fetch failed'))
    logDegradedFallback(`scope-b2-${Math.random()}`, new TypeError('fetch failed'))
    expect(warnSpy).toHaveBeenCalledTimes(2)
  })

  it('formats a plain Supabase error object without [object Object]', () => {
    const scope = `plain-object-${Math.random()}`
    logDegradedFallback(scope, { message: 'TypeError: fetch failed', code: 'EACCES', hint: 'blocked egress' })
    const [line] = warnSpy.mock.calls[0]
    expect(line).toContain('TypeError: fetch failed')
    expect(line).toContain('EACCES')
    expect(line).toContain('blocked egress')
    expect(line).not.toContain('[object Object]')
  })

  it('does not print a multiline Supabase details stack for a degraded fallback', () => {
    const scope = `multiline-details-${Math.random()}`
    logDegradedFallback(scope, {
      message: 'TypeError: fetch failed',
      details: 'TypeError: fetch failed\nCaused by: AggregateError\n    at internalConnectMultiple',
    })
    const [line] = warnSpy.mock.calls[0]
    expect(line).toContain('TypeError: fetch failed')
    expect(line).not.toContain('AggregateError')
    expect(line).not.toContain('\n')
  })
})
