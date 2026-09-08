import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609300014_apply_building_layout_lettered_count_in_target.sql', import.meta.url),
  'utf8',
)
const ddl = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ')

describe('apply_building_layout — lettered rooms count toward the target (202609300014)', () => {
  it('re-emits the same signature via CREATE OR REPLACE (supersedes 202609300013)', () => {
    expect(ddl).toMatch(/CREATE OR REPLACE FUNCTION public\.apply_building_layout\(p_faculty text, p_numbering text, p_floors jsonb, p_dorm_id uuid DEFAULT NULL::uuid\)/)
    expect(ddl).not.toMatch(/DROP FUNCTION[^;]*apply_building_layout/)
  })

  it('counts existing lettered rooms per floor into _lettered', () => {
    expect(ddl).toMatch(/CREATE TEMP TABLE _lettered ON COMMIT DROP AS SELECT l\.floor_number AS floor, count\(\*\)::int AS n FROM public\.floor_room_layout l WHERE l\.dorm_id = v_dorm_id AND l\.room_number !~ '\^\[0-9\]\+\$'/)
  })

  it('derives a numeric target = plan.rooms − lettered, and flows the sequence by it', () => {
    expect(ddl).toMatch(/GREATEST\(p\.rooms - COALESCE\(x\.n, 0\), 0\) AS num_target/)
    expect(ddl).toMatch(/sum\(num_target\) OVER \(ORDER BY floor ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING\), 0\) \+ 1/)
    expect(ddl).toMatch(/SELECT floor, rooms, num_target, lo, lo \+ num_target - 1 AS hi/)
  })

  it('uses num_target (not the raw plan count) in the resident-overflow conflict', () => {
    expect(ddl).toMatch(/WHERE c2\.floor_number = c\.floor_number AND c2\.occupied AND c2\.is_num\) > r\.num_target/)
  })

  it('still passes lettered rooms through untouched (kept bucket) and never casts them to int', () => {
    expect(ddl).toMatch(/kept AS \([\s\S]*?FROM _cur c WHERE NOT c\.is_num \)/)
    expect(ddl).toMatch(/ORDER BY \(n\.room_number ~ '\^\[0-9\]\+\$'\) DESC, CASE WHEN n\.room_number ~ '\^\[0-9\]\+\$' THEN n\.room_number::int END/)
  })
})
