import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609250000_fix_room_occupancy_double_count.sql', import.meta.url),
  'utf8',
)

describe('room occupancy double-count fix', () => {
  it("each assign RPC's occupancy count drops an approved permit whose holder already registered", () => {
    // One NOT EXISTS guard per: assign_student / approve_permit / assign_permit.
    const guards = sql.match(
      /AND NOT EXISTS \(\s*(?:--[^\n]*\n\s*)*SELECT 1 FROM public\.users u\s*WHERE u\.role = 'talaba'/g,
    )
    expect(guards?.length).toBe(3)

    // Matched by passport OR jshshir (both unique per person), NOT scoped to
    // this room — a registered applicant is counted via their users row
    // wherever they now live, never via the spent permit reservation.
    expect(sql).toContain('u.passport_series IS NOT NULL AND u.passport_series = pr.passport_series')
    expect(sql).toContain('u.jshshir IS NOT NULL AND pr.jshshir IS NOT NULL AND u.jshshir = pr.jshshir')
    expect(sql).not.toContain('u.role = \'talaba\' AND u.room_number = p_room_number\n          AND (')
  })

  it('leaves the fullness comparison and every other guard from 202609240000 intact', () => {
    expect(sql.match(/IF v_occupied >= COALESCE\(v_room_capacity, p_max_capacity\) THEN/g)?.length).toBe(3)
    expect(sql.match(/RAISE EXCEPTION 'Room reserved for other gender' USING ERRCODE = 'P0001'/g)?.length).toBe(3)
    expect(sql.match(/SELECT floor_number, frozen, capacity, gender INTO v_floor, v_frozen, v_room_capacity, v_room_gender/g)?.length).toBe(3)
  })

  it('keeps the RPC signatures and their service_role-only grants unchanged', () => {
    for (const fn of [
      'assign_student_room_atomic(uuid, text, int)',
      'approve_permit_room_atomic(uuid, text, int)',
      'assign_permit_room_atomic(uuid, text, int)',
    ]) {
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role`)
      expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION public.${fn} FROM anon, authenticated`)
    }
  })

  it('sorts after 202609240000 so db push applies it in order', () => {
    const version = new URL('./202609250000_fix_room_occupancy_double_count.sql', import.meta.url).pathname.match(/(\d{12,14})_/)?.[1]
    expect(Number(version) > 202609240000).toBe(true)
  })
})
