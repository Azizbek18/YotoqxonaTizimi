import { describe, expect, it } from 'vitest'
import { isWithinTarbiyachiFloor } from './tarbiyachi'

describe('tarbiyachi scope', () => {
  it('fails closed when floor or gender scope is missing', () => {
    expect(isWithinTarbiyachiFloor(
      { id: 'staff', email: 'staff@example.com', role: 'tarbiyachi', assigned_floor: null, assigned_gender: 'male' },
      { assigned_floor: 2, gender: 'male' },
    )).toBe(false)
    expect(isWithinTarbiyachiFloor(
      { id: 'staff', email: 'staff@example.com', role: 'tarbiyachi', assigned_floor: 2, assigned_gender: null },
      { assigned_floor: 2, gender: 'male' },
    )).toBe(false)
  })

  it('requires both the assigned floor and gender', () => {
    const staff = {
      id: 'staff',
      email: 'staff@example.com',
      role: 'tarbiyachi',
      assigned_floor: 2,
      assigned_gender: 'female',
    }
    expect(isWithinTarbiyachiFloor(staff, { assigned_floor: 2, gender: 'female' })).toBe(true)
    expect(isWithinTarbiyachiFloor(staff, { assigned_floor: 2, gender: 'male' })).toBe(false)
    expect(isWithinTarbiyachiFloor(staff, { assigned_floor: 3, gender: 'female' })).toBe(false)
  })
})
