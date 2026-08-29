import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609160000_room_layer_to_dorm.sql', import.meta.url),
  'utf8',
)

describe('room layer -> dorm (202609160000)', () => {
  it('makes room_number unique per dorm, not per faculty', () => {
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS floor_room_layout_faculty_room_number_key/)
    expect(sql).toMatch(/ADD CONSTRAINT floor_room_layout_dorm_room_number_key UNIQUE \(dorm_id, room_number\)/)
    expect(sql).toMatch(/ALTER TABLE public\.floor_room_layout ALTER COLUMN dorm_id SET NOT NULL/)
  })

  it('rewrites all four room RPCs, keeping their signatures', () => {
    for (const fn of [
      'replace_floor_room_layout(\n  p_faculty text',
      'assign_student_room_atomic(\n  p_student_id uuid',
      'approve_permit_room_atomic(\n  p_permit_id uuid',
      'assign_permit_room_atomic(\n  p_permit_id uuid',
    ]) {
      expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`)
    }
  })

  it('locks and scopes on dorm_id, not faculty', () => {
    const locks = sql.match(/pg_advisory_xact_lock\(hashtext\(v_dorm_id::text \|\| ':' \|\| p_room_number\)\)/g) ?? []
    expect(locks.length).toBe(3) // the three assignment RPCs
    expect(sql).toMatch(/hashtext\(v_dorm_id::text \|\| ':floor:' \|\| p_floor_number::text\)/)
    // occupancy no longer filters by faculty
    expect(sql).not.toMatch(/COALESCE\(NULLIF\(faculty, ''\), 'amit'\) = v_faculty/)
  })

  it('enforces floor ownership with P0007', () => {
    expect(sql).toMatch(/USING ERRCODE = 'P0007'/)
  })

  it('sets dorm_id when placing a student or permit', () => {
    expect(sql).toMatch(/UPDATE public\.users\s+SET room_number = p_room_number, dorm_id = v_dorm_id/)
    expect(sql).toMatch(/status = 'approved', room_number = p_room_number, dorm_id = v_dorm_id/)
  })

  it('keeps execute grants service-role only', () => {
    for (const fn of ['replace_floor_room_layout', 'assign_student_room_atomic', 'approve_permit_room_atomic', 'assign_permit_room_atomic']) {
      expect(sql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO service_role`))
    }
  })
})
