import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609170000_fix_floor_ownership_check.sql', import.meta.url),
  'utf8',
)

describe('floor-ownership check fix (202609170000)', () => {
  it('rejects any floor whose confirmed owner is not exactly the caller', () => {
    // was: `v_floor_owner IS NOT NULL AND ... <>` (let a NULL / pending
    // floor through). now: a matched dorm_floor row must belong to the
    // caller, or there must be no row at all.
    expect(sql).toMatch(/IF FOUND AND v_floor_owner IS DISTINCT FROM p_faculty THEN/)
    const guarded = sql.match(/IF v_df_found AND v_floor_owner IS DISTINCT FROM v_faculty THEN/g) ?? []
    expect(guarded.length).toBe(3) // the three assignment RPCs
    // the old, leaky check must be gone from the executable body
    const body = sql.slice(sql.indexOf('CREATE OR REPLACE'))
    expect(body).not.toMatch(/v_floor_owner IS NOT NULL AND v_floor_owner/)
  })

  it('re-creates all four room RPCs with SET search_path', () => {
    for (const fn of ['replace_floor_room_layout', 'assign_student_room_atomic', 'approve_permit_room_atomic', 'assign_permit_room_atomic']) {
      expect(sql).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`))
    }
    expect((sql.match(/SET search_path = public/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })

  it('pins search_path on the three flagged trigger functions', () => {
    for (const fn of ['check_student_permit_approved', 'update_warning_count', 'set_elonlar_updated_at']) {
      expect(sql).toMatch(new RegExp(`ALTER FUNCTION public\\.${fn}\\(\\) SET search_path = public`))
    }
  })
})
