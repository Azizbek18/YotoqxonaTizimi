import { describe, expect, it } from 'vitest'
import { resolveDeleteTarget } from './route'

describe('admin users delete target resolution', () => {
  it('rejects a staff target disguised as a users-row target', () => {
    expect(() => resolveDeleteTarget(
      'users',
      null,
      { id: 'zamdekan-id', role: 'zamdekan' },
    )).toThrow(/manbasi/)
  })

  it('blocks zamdekan deletion even when the submitted source is correct', () => {
    expect(() => resolveDeleteTarget(
      'staff',
      null,
      { id: 'zamdekan-id', role: 'zamdekan' },
    )).toThrow(/Zamdekan/)
  })

  it('rejects ambiguous and missing profile rows', () => {
    expect(() => resolveDeleteTarget(
      'users',
      { id: 'duplicate-id' },
      { id: 'duplicate-id', role: 'admin' },
    )).toThrow(/bir nechta/)
    expect(() => resolveDeleteTarget('users', null, null)).toThrow(/topilmadi/)
  })

  it('accepts a real student target only as a users source', () => {
    expect(resolveDeleteTarget('users', { id: 'student-id' }, null)).toBe('users')
  })
})
