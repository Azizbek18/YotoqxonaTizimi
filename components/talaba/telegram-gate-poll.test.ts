import { describe, expect, it } from 'vitest'
import { GATE_POLL_FIRST_MS, GATE_POLL_MAX_MS, gatePollDelay } from './telegram-gate-poll'

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
