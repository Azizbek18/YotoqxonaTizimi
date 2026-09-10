import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609300017_apply_building_layout_reject_blocked.sql', import.meta.url),
  'utf8',
)
const ddl = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ')

describe('apply_building_layout — rejects a blocked-layout building (202609300017)', () => {
  it('re-emits the same signature via CREATE OR REPLACE, no DROP', () => {
    expect(ddl).toMatch(/CREATE OR REPLACE FUNCTION public\.apply_building_layout\(\s*p_faculty text,\s*p_numbering text,\s*p_floors jsonb,\s*p_dorm_id uuid DEFAULT NULL::uuid\s*\)/)
    expect(ddl).not.toMatch(/DROP FUNCTION[^;]*apply_building_layout/)
  })

  it('raises P0001 for a blocked dorm, after the dorm is resolved', () => {
    expect(ddl).toMatch(/IF \(SELECT layout_kind FROM public\.dorms WHERE id = v_dorm_id\) = 'blocked' THEN[\s\S]*?ERRCODE = 'P0001'/)
  })

  it('keeps the P0007 foreign-floor guard and the building-wide numbering from 016', () => {
    expect(ddl).toMatch(/ERRCODE = 'P0007'/)
    expect(ddl).toMatch(/1 \+ COALESCE\(\(SELECT sum\(b\.num_count\) FROM building b WHERE b\.floor < p\.floor\), 0\)/)
  })
})
