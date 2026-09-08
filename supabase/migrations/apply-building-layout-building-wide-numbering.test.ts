import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609300016_apply_building_layout_building_wide_numbering.sql', import.meta.url),
  'utf8',
)
const ddl = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ')

describe('apply_building_layout — building-wide sequential numbering (202609300016)', () => {
  it('re-emits the same signature via CREATE OR REPLACE, no DROP', () => {
    expect(ddl).toMatch(/CREATE OR REPLACE FUNCTION public\.apply_building_layout\(\s*p_faculty text,\s*p_numbering text,\s*p_floors jsonb,\s*p_dorm_id uuid DEFAULT NULL::uuid\s*\)/)
    expect(ddl).not.toMatch(/DROP FUNCTION[^;]*apply_building_layout/)
  })

  it('computes each planned floor start from every numeric room below it in the whole building', () => {
    expect(ddl).toMatch(/building AS \(/)
    expect(ddl).toMatch(/FROM generate_series\(1, COALESCE\(\(SELECT floor_count FROM public\.dorms WHERE id = v_dorm_id\), 0\)\) AS g\(floor\)/)
    expect(ddl).toMatch(/1 \+ COALESCE\(\(SELECT sum\(b\.num_count\) FROM building b WHERE b\.floor < p\.floor\), 0\)/)
  })

  it('counts an untouched floor by its current numeric rooms, a planned one by its target', () => {
    expect(ddl).toMatch(/WHEN p\.floor IS NOT NULL THEN GREATEST\(p\.rooms - COALESCE\(x\.n, 0\), 0\) ELSE COALESCE\(\( SELECT count\(\*\) FROM public\.floor_room_layout l WHERE l\.dorm_id = v_dorm_id AND l\.floor_number = g\.floor AND l\.room_number ~ '\^\[0-9\]\+\$'/)
  })

  it('no longer uses the plan-relative running sum', () => {
    expect(ddl).not.toMatch(/sum\(num_target\) OVER \(ORDER BY floor/)
  })

  it('still refuses another faculty\'s floor in the plan (P0007 unchanged)', () => {
    expect(ddl).toMatch(/df\.faculty IS DISTINCT FROM p_faculty AND df\.floor_number IN \(SELECT \(e->>'floor'\)::int FROM jsonb_array_elements\(p_floors\) e\)[\s\S]*?ERRCODE = 'P0007'/)
  })

  it('tags inserted rows with the floor\'s real owner, falling back to p_faculty', () => {
    expect(ddl).toMatch(/COALESCE\(\s*\(SELECT df\.faculty FROM public\.dorm_floor df\s*WHERE df\.dorm_id = v_dorm_id AND df\.floor_number = n\.floor\),\s*p_faculty\)/)
  })

  it('keeps the resident-overflow conflict, the lettered-rooms kept bucket, and the P0003 raise', () => {
    expect(ddl).toMatch(/WHERE c2\.floor_number = c\.floor_number AND c2\.occupied AND c2\.is_num\) > r\.num_target/)
    expect(ddl).toMatch(/kept AS \([\s\S]*?FROM _cur c WHERE NOT c\.is_num \)/)
    expect(ddl).toMatch(/Band xonalarni qayta raqamlab bo''lmadi: %[\s\S]*?ERRCODE = 'P0003'/)
  })
})
