import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609240000_room_gender.sql', import.meta.url),
  'utf8',
)

describe('declared room gender migration', () => {
  it('adds a nullable, value-checked gender column to floor_room_layout', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS gender text')
    expect(sql).toMatch(/CHECK \(gender IS NULL OR gender IN \('male', 'female'\)\)/)
  })

  it('every placement RPC reads the room gender and refuses a mismatched student', () => {
    // One read per: assign_student / approve_permit / assign_permit.
    const reads = sql.match(
      /SELECT floor_number, frozen, capacity, gender INTO v_floor, v_frozen, v_room_capacity, v_room_gender/g,
    )
    expect(reads?.length).toBe(3)

    const guards = sql.match(
      /IF v_room_gender IS NOT NULL AND v_gender IS NOT NULL AND v_room_gender <> v_gender THEN\s+RAISE EXCEPTION 'Room reserved for other gender' USING ERRCODE = 'P0001';/g,
    )
    expect(guards?.length).toBe(3)
  })

  it('the occupant capacity + gender-conflict checks from 202609180000 are still present', () => {
    expect(sql.match(/IF v_occupied >= COALESCE\(v_room_capacity, p_max_capacity\) THEN/g)?.length).toBe(3)
    expect(sql.match(/RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001'/g)?.length).toBe(3)
  })

  it('replace_floor_room_layout keeps a room its declared gender when a floor is re-saved', () => {
    expect(sql).toContain('v_gender_snapshot jsonb')
    expect(sql).toContain('SELECT jsonb_object_agg(old.room_number, old.gender)')
    expect(sql).toContain(
      'INSERT INTO public.floor_room_layout\n    (dorm_id, faculty, floor_number, room_number, side, position, size, frozen, frozen_reason, capacity, gender)',
    )
    // The builder never sends gender, so it always restores from the snapshot
    // (no r ? \'gender\' key-presence branch, unlike capacity).
    expect(sql).toContain("(v_gender_snapshot ->> (r->>'roomNumber'))")
  })

  it('apply_building_layout carries gender across a whole-building renumber', () => {
    expect(sql).toContain('l.frozen, l.frozen_reason, l.capacity, l.gender')
    // pinned + renum keep the old value, fresh rooms have none.
    expect(sql).toContain('NULL::smallint AS capacity, NULL::text AS gender')
    expect(sql).toContain(
      'INSERT INTO public.floor_room_layout\n    (dorm_id, faculty, floor_number, room_number, side, position, size, frozen, frozen_reason, capacity, gender)',
    )
    expect(sql).toContain('n.size, n.frozen, n.frozen_reason, n.capacity, n.gender')
  })

  it('keeps the RPC signatures and their service_role-only grants unchanged', () => {
    for (const fn of [
      'assign_student_room_atomic(uuid, text, int)',
      'approve_permit_room_atomic(uuid, text, int)',
      'assign_permit_room_atomic(uuid, text, int)',
      'replace_floor_room_layout(text, int, jsonb)',
      'apply_building_layout(text, text, jsonb)',
    ]) {
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role`)
      expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION public.${fn} FROM anon, authenticated`)
    }
  })

  it('sorts after every migration already applied on prod (avoids db push skip)', () => {
    // The file name — 202609240000 — must be greater than 202609220000.
    const version = new URL('./202609240000_room_gender.sql', import.meta.url).pathname.match(/(\d{12,14})_/)?.[1]
    expect(version).toBe('202609240000')
    expect(Number(version) > 202609220000).toBe(true)
  })
})
