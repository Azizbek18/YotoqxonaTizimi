import { describe, expect, it } from 'vitest'
import { isTarbiyachiStudent } from './tarbiyachi'

describe('tarbiyachi scope', () => {
  it('includes a student of the same faculty', () => {
    expect(isTarbiyachiStudent({ faculty: 'amit' }, { faculty: 'amit' })).toBe(true)
  })

  it('excludes a student of another faculty', () => {
    expect(isTarbiyachiStudent({ faculty: 'amit' }, { faculty: 'kimyo' })).toBe(false)
  })

  it('ignores floor and gender — the whole dormitory is in scope', () => {
    // No floor/gender fields are consulted; a faculty match is enough.
    expect(isTarbiyachiStudent({ faculty: 'fizika' }, { faculty: 'fizika' })).toBe(true)
  })

  it('treats a faculty-less staff or student as the primary building during the transition', () => {
    expect(isTarbiyachiStudent({ faculty: 'amit' }, { faculty: null })).toBe(true)
    expect(isTarbiyachiStudent({ faculty: null }, { faculty: 'amit' })).toBe(true)
    expect(isTarbiyachiStudent({ faculty: null }, { faculty: null })).toBe(true)
    expect(isTarbiyachiStudent({ faculty: null }, { faculty: 'kimyo' })).toBe(false)
  })
})
