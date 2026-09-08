import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609300013_apply_building_layout_keep_lettered_rooms.sql', import.meta.url),
  'utf8',
)
const ddl = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ')

describe('apply_building_layout keeps lettered sub-rooms (202609300013)', () => {
  it('re-emits with the same 4-arg signature via CREATE OR REPLACE (no DROP)', () => {
    expect(ddl).toMatch(/CREATE OR REPLACE FUNCTION public\.apply_building_layout\(p_faculty text, p_numbering text, p_floors jsonb, p_dorm_id uuid DEFAULT NULL::uuid\)/)
    expect(ddl).not.toMatch(/DROP FUNCTION[^;]*apply_building_layout/)
  })

  it('adds a "kept" bucket for non-numeric rooms that passes them through verbatim', () => {
    expect(ddl).toMatch(/kept AS \( SELECT c\.floor_number AS floor, c\.room_number AS num_text, c\.room_number AS old_number,[\s\S]*?FROM _cur c WHERE NOT c\.is_num \)/)
    expect(ddl).toMatch(/SELECT floor, num_text AS room_number, old_number, side, size, frozen, frozen_reason, capacity, gender, 'keep'::text AS kind FROM kept/)
  })

  it('restricts pinned / movable / removed / conflict to pure-numeric rooms', () => {
    expect(ddl).toMatch(/pinned AS \([\s\S]*?FROM _cur c WHERE c\.occupied AND c\.is_num \)/)
    expect(ddl).toMatch(/movable AS \([\s\S]*?FROM _cur c WHERE NOT c\.occupied AND c\.is_num \)/)
    expect(ddl).toMatch(/FROM _cur c WHERE NOT c\.occupied AND c\.is_num AND NOT EXISTS/)
    // the old "NOT c.is_num" conflict trigger is gone
    expect(ddl).toMatch(/WHERE c\.occupied AND c\.is_num AND \( c\.rn < r\.lo OR c\.rn > r\.hi/)
    expect(ddl).not.toMatch(/WHERE c\.occupied AND \( NOT c\.is_num/)
  })

  it('sorts the INSERT position without casting a lettered room_number to int', () => {
    // numeric rooms first, then by their int value, letters fall back to text
    expect(ddl).toMatch(/ORDER BY \(n\.room_number ~ '\^\[0-9\]\+\$'\) DESC, CASE WHEN n\.room_number ~ '\^\[0-9\]\+\$' THEN n\.room_number::int END, n\.room_number/)
    expect(ddl).not.toMatch(/ORDER BY \(n\.room_number\)::int\)\)::int - 1/)
  })
})
