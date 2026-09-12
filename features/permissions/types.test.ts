import { describe, expect, it } from 'vitest'
import {
  SARDOR_PERMISSIONS,
  TARBIYACHI_PERMISSIONS,
  PERMISSION_LABELS,
  can,
  permissionsForSubject,
  sanitizePermissions,
} from './types'

describe('can', () => {
  // The whole feature is safe to ship only because of this: the column
  // arrives as '{}' on every existing row, and that has to mean "unchanged".
  it('treats an empty / missing map as full access', () => {
    expect(can({}, 'payments.review')).toBe(true)
    expect(can(null, 'payments.review')).toBe(true)
    expect(can(undefined, 'payments.review')).toBe(true)
  })

  it('only denies on an explicit false', () => {
    expect(can({ 'payments.review': false }, 'payments.review')).toBe(false)
    expect(can({ 'payments.review': true }, 'payments.review')).toBe(true)
  })

  it('does not let one revoked key affect another', () => {
    const map = { 'payments.review': false }
    expect(can(map, 'payments.review')).toBe(false)
    expect(can(map, 'students.view')).toBe(true)
  })

  it('fails open on junk rather than locking a member out', () => {
    expect(can('nonsense', 'students.view')).toBe(true)
    expect(can([], 'students.view')).toBe(true)
    expect(can(42, 'students.view')).toBe(true)
  })
})

describe('sanitizePermissions', () => {
  it('keeps only revocations, so "empty = full access" holds', () => {
    expect(sanitizePermissions('tarbiyachi', {
      'payments.review': false,
      'students.view': true,
    })).toEqual({ 'payments.review': false })
  })

  it('drops keys that do not belong to the subject', () => {
    // 'duty.schedule' is a sardor right; a tarbiyachi payload must not carry it.
    expect(sanitizePermissions('tarbiyachi', {
      'duty.schedule': false,
      'attendance.manage': false,
    })).toEqual({ 'attendance.manage': false })
  })

  it('ignores unknown keys and non-object input', () => {
    expect(sanitizePermissions('sardor', { 'made.up': false })).toEqual({})
    expect(sanitizePermissions('sardor', null)).toEqual({})
    expect(sanitizePermissions('sardor', ['duty.schedule'])).toEqual({})
  })
})

describe('catalogue', () => {
  it('exposes the right keys per subject', () => {
    expect(permissionsForSubject('tarbiyachi')).toBe(TARBIYACHI_PERMISSIONS)
    expect(permissionsForSubject('sardor')).toBe(SARDOR_PERMISSIONS)
  })

  it('labels every key both subjects can carry', () => {
    for (const key of [...TARBIYACHI_PERMISSIONS, ...SARDOR_PERMISSIONS]) {
      expect(PERMISSION_LABELS[key]?.title).toBeTruthy()
      expect(PERMISSION_LABELS[key]?.hint).toBeTruthy()
    }
  })
})
