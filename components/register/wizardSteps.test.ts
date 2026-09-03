import { describe, expect, it } from 'vitest'
import { buildSteps } from './wizardSteps'

describe('buildSteps', () => {
  it('yollanma includes the UZ address step (8 steps)', () => {
    const ids = buildSteps('yollanma').map((s) => s.id)
    expect(ids).toContain('address')
    expect(ids).toHaveLength(8)
  })

  it('imtiyozli skips the UZ address step (7 steps)', () => {
    const ids = buildSteps('imtiyozli').map((s) => s.id)
    expect(ids).not.toContain('address')
    expect(ids).toHaveLength(7)
  })

  it('starts at passport, ends at password, ids are unique', () => {
    const ids = buildSteps('yollanma').map((s) => s.id)
    expect(ids[0]).toBe('passport')
    expect(ids[ids.length - 1]).toBe('password')
    expect(new Set(ids).size).toBe(ids.length)
  })
})
