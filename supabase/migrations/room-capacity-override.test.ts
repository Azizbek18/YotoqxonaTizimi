import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609180000_room_capacity_override.sql', import.meta.url),
  'utf8',
)

describe('per-room capacity override migration', () => {
  it('adds a nullable, range-checked capacity column to floor_room_layout', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS capacity smallint')
    expect(sql).toMatch(/CHECK \(capacity IS NULL OR \(capacity BETWEEN 1 AND 20\)\)/)
  })

  it('every placement RPC gates fullness on the room override, falling back to p_max_capacity', () => {
    // One COALESCE check per: assign_student / approve_permit / assign_permit.
    const guarded = sql.match(/IF v_occupied >= COALESCE\(v_room_capacity, p_max_capacity\) THEN/g)
    expect(guarded?.length).toBe(3)
    // The old unconditional check must be gone from this migration.
    expect(sql).not.toMatch(/IF v_occupied >= p_max_capacity THEN/)
  })

  it('each placement RPC reads capacity alongside floor_number and frozen', () => {
    const reads = sql.match(
      /SELECT floor_number, frozen, capacity INTO v_floor, v_frozen, v_room_capacity/g,
    )
    expect(reads?.length).toBe(3)
  })

  it('replace_floor_room_layout carries capacity: incoming key wins, else the prior value is kept', () => {
    expect(sql).toContain('INSERT INTO public.floor_room_layout\n    (dorm_id, faculty, floor_number, room_number, side, position, size, frozen, frozen_reason, capacity)')
    // jsonb key-presence test so an explicit null clears the override while a
    // missing key (old client) preserves it.
    expect(sql).toMatch(/WHEN r \? 'capacity' THEN NULLIF\(r->>'capacity', ''\)::smallint/)
    expect(sql).toContain('v_capacity_snapshot')
  })

  it('keeps the RPC signatures and their service_role-only grants unchanged', () => {
    for (const fn of [
      'assign_student_room_atomic(uuid, text, int)',
      'approve_permit_room_atomic(uuid, text, int)',
      'assign_permit_room_atomic(uuid, text, int)',
      'replace_floor_room_layout(text, int, jsonb)',
    ]) {
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role`)
      expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION public.${fn} FROM anon, authenticated`)
    }
  })
})
