import { describe, expect, it } from 'vitest'
import {
  GATE_POLL_FIRST_MS,
  GATE_POLL_MAX_MS,
  LINKED_FLAG_TTL_MS,
  gatePollDelay,
  readLinkedFlag,
  writeLinkedFlag,
} from './telegram-gate-poll'

describe('gatePollDelay', () => {
  it('starts at the first interval and doubles', () => {
    expect(gatePollDelay(0)).toBe(GATE_POLL_FIRST_MS)
    expect(gatePollDelay(1)).toBe(60_000)
    expect(gatePollDelay(2)).toBe(120_000)
  })

  it('never exceeds the cap, however long the student waits', () => {
    expect(gatePollDelay(3)).toBe(GATE_POLL_MAX_MS)
    expect(gatePollDelay(50)).toBe(GATE_POLL_MAX_MS)
    expect(gatePollDelay(Number.MAX_SAFE_INTEGER)).toBe(GATE_POLL_MAX_MS)
  })

  it('treats junk input as the first attempt', () => {
    expect(gatePollDelay(-1)).toBe(GATE_POLL_FIRST_MS)
    expect(gatePollDelay(Number.NaN)).toBe(GATE_POLL_FIRST_MS)
  })

  it('is far gentler than the old fixed 10 s poll', () => {
    const calls = (windowMs: number) => {
      let t = 0
      let n = 0
      while (t + gatePollDelay(n) <= windowMs) { t += gatePollDelay(n); n += 1 }
      return n
    }
    expect(calls(60 * 60_000)).toBeLessThan(25) // old: 360 an hour
  })
})


function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v) },
    removeItem: (k: string) => { data.delete(k) },
  }
}

describe('linked flag', () => {
  it('is false until written, then true for that user only', () => {
    const s = memoryStorage()
    expect(readLinkedFlag(s, 'u1', 1_000)).toBe(false)
    writeLinkedFlag(s, 'u1', 1_000)
    expect(readLinkedFlag(s, 'u1', 2_000)).toBe(true)
    expect(readLinkedFlag(s, 'u2', 2_000)).toBe(false)
  })

  it('expires after the TTL and is cleaned up', () => {
    const s = memoryStorage()
    writeLinkedFlag(s, 'u1', 1_000)
    expect(readLinkedFlag(s, 'u1', 1_000 + LINKED_FLAG_TTL_MS)).toBe(false)
    expect(s.getItem('tg-linked:u1')).toBeNull()
  })

  it('ignores a future/garbage timestamp and survives a blocked storage', () => {
    const s = memoryStorage()
    s.setItem('tg-linked:u1', 'nonsense')
    expect(readLinkedFlag(s, 'u1')).toBe(false)
    s.setItem('tg-linked:u1', String(Date.now() + 99_999_999))
    expect(readLinkedFlag(s, 'u1')).toBe(false)
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => undefined }
    expect(readLinkedFlag(broken, 'u1')).toBe(false)
    expect(() => writeLinkedFlag(broken, 'u1')).not.toThrow()
    expect(readLinkedFlag(null, 'u1')).toBe(false)
  })
})
