import { describe, expect, it } from 'vitest'
import { isActiveStaff, isActiveStudent } from './policies'

describe('authorization policies', () => {
  it('accepts only active student records', () => {
    expect(isActiveStudent({ role: 'talaba', status: 'active' })).toBe(true)
    expect(isActiveStudent({ role: 'talaba', status: 'blocked' })).toBe(false)
    expect(isActiveStudent({ role: 'admin', status: 'active' })).toBe(false)
  })

  it('checks both active status and allowed staff role', () => {
    expect(isActiveStaff({ role: 'admin', status: 'active' }, ['admin'])).toBe(true)
    expect(isActiveStaff({ role: 'admin', status: 'inactive' }, ['admin'])).toBe(false)
    expect(isActiveStaff({ role: 'tarbiyachi', status: 'active' }, ['admin'])).toBe(false)
  })
})
