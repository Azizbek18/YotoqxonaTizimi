import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('./202609080000_elonlar_faculty_not_null.sql', import.meta.url), 'utf8')

describe('elonlar faculty scoping (202609080000)', () => {
  it('backfills every faculty-less announcement to the primary building', () => {
    expect(sql).toMatch(/UPDATE public\.elonlar\s+SET faculty = 'amit'\s+WHERE faculty IS NULL/)
  })

  it('makes the faculty column mandatory so no future insert is faculty-less', () => {
    expect(sql).toContain("ALTER TABLE public.elonlar ALTER COLUMN faculty SET DEFAULT 'amit'")
    expect(sql).toContain('ALTER TABLE public.elonlar ALTER COLUMN faculty SET NOT NULL')
  })

  it('keeps the audience=all value (scoped on read, not dropped)', () => {
    expect(sql).not.toMatch(/SET audience = 'faculty'/)
    expect(sql).not.toMatch(/DROP CONSTRAINT[\s\S]*audience/)
  })
})
