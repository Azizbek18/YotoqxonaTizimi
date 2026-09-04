import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609300002_room_layout_dorm_id_override.sql', import.meta.url),
  'utf8',
)

// Lets a dekan draw/generate a room layout in a SPECIFIC one of their
// faculty's buildings (many-to-many, 202609300000) instead of only the
// primary. Adds an optional p_dorm_id to the two layout RPCs — omitted
// resolves to primary exactly as before (202609300001).
describe('room-layout dorm_id override (202609300002)', () => {
  it('drops the old 3/4-arg signatures before recreating with p_dorm_id', () => {
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.replace_floor_room_layout\(text, integer, jsonb\)/)
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.apply_building_layout\(text, text, jsonb\)/)
    expect(sql).toMatch(/CREATE FUNCTION public\.replace_floor_room_layout\(\s*p_faculty text, p_floor_number integer, p_rows jsonb, p_dorm_id uuid DEFAULT NULL/)
    expect(sql).toMatch(/CREATE FUNCTION public\.apply_building_layout\(\s*p_faculty text, p_numbering text, p_floors jsonb, p_dorm_id uuid DEFAULT NULL/)
  })

  it('both functions validate an explicit p_dorm_id actually belongs to the faculty', () => {
    const fns = [
      sql.slice(sql.indexOf('CREATE FUNCTION public.replace_floor_room_layout'), sql.indexOf('CREATE FUNCTION public.apply_building_layout')),
      sql.slice(sql.indexOf('CREATE FUNCTION public.apply_building_layout')),
    ]
    for (const fn of fns) {
      expect(fn).toMatch(/IF p_dorm_id IS NOT NULL THEN/)
      expect(fn).toMatch(/WHERE faculty = p_faculty AND dorm_id = p_dorm_id/)
      expect(fn).toMatch(/RAISE EXCEPTION 'Dorm % does not belong to faculty %'.*USING ERRCODE = 'P0002'/)
    }
  })

  it('both functions still fall back to is_primary when p_dorm_id is omitted', () => {
    const fns = [
      sql.slice(sql.indexOf('CREATE FUNCTION public.replace_floor_room_layout'), sql.indexOf('CREATE FUNCTION public.apply_building_layout')),
      sql.slice(sql.indexOf('CREATE FUNCTION public.apply_building_layout')),
    ]
    for (const fn of fns) {
      expect(fn).toMatch(/ELSE\s*\n\s*SELECT dorm_id INTO v_dorm_id FROM public\.faculty_dorm WHERE faculty = p_faculty AND is_primary;/)
    }
  })

  it('re-locks both down to service_role only, on the new 4-arg signature', () => {
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.replace_floor_room_layout\(text, integer, jsonb, uuid\) FROM anon, authenticated/)
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.replace_floor_room_layout\(text, integer, jsonb, uuid\) TO service_role/)
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.apply_building_layout\(text, text, jsonb, uuid\) FROM anon, authenticated/)
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.apply_building_layout\(text, text, jsonb, uuid\) TO service_role/)
  })

  it('keeps the advisory-lock keys hashed on dorm_id, unchanged', () => {
    expect(sql).toMatch(/hashtext\(v_dorm_id::text \|\| ':floor:' \|\| p_floor_number::text\)/)
    expect(sql).toMatch(/hashtext\(v_dorm_id::text \|\| ':layout'\)/)
  })
})
