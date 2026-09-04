import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609290001_room_rpcs_strict_dorm_occupancy.sql', import.meta.url),
  'utf8',
)

describe('202609290001_room_rpcs_strict_dorm_occupancy', () => {
  it('re-emits all four room functions', () => {
    for (const fn of [
      'assign_student_room_atomic',
      'assign_permit_room_atomic',
      'approve_permit_room_atomic',
      'replace_floor_room_layout',
    ]) {
      expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`)
    }
  })

  it('drops the "OR <x>.dorm_id IS NULL" from every occupancy / occupied-room check', () => {
    // strip SQL line comments so the "old behaviour" note in the header
    // doesn't trip the assertions
    const body = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    expect(body).not.toMatch(/dorm_id\s*=\s*v_dorm_id\s+OR\s+\w*\.?dorm_id\s+IS\s+NULL/i)
    expect(body).toContain('AND dorm_id = v_dorm_id')
    expect(body).toContain('AND pr.dorm_id = v_dorm_id')
  })

  it('keeps the pending-account room carry from 202609280001', () => {
    expect(sql).toContain("u.status = 'pending'")
    expect(sql).toContain('u.room_number IS NULL')
  })
})
