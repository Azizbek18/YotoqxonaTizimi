import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609300005_atomic_faculty_dorm_primary_switch.sql', import.meta.url),
  'utf8',
)

describe('atomic faculty dorm primary switch (202609300005)', () => {
  it('serializes switches per faculty', () => {
    expect(sql).toMatch(/pg_advisory_xact_lock\([\s\S]*?'faculty-dorm-primary:' \|\| v_faculty/)
  })

  it('inserts the target as non-primary before changing flags', () => {
    const insert = sql.indexOf('VALUES (v_faculty, p_dorm_id, false)')
    const demote = sql.indexOf('SET is_primary = false')
    const promote = sql.indexOf('SET is_primary = true')

    expect(insert).toBeGreaterThan(-1)
    expect(insert).toBeLessThan(demote)
    expect(demote).toBeLessThan(promote)
  })

  it('keeps the privileged function inaccessible to browser roles', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.set_primary_dorm\(text, uuid\) FROM PUBLIC/)
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.set_primary_dorm\(text, uuid\) FROM anon, authenticated/)
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.set_primary_dorm\(text, uuid\) TO service_role/)
  })
})
