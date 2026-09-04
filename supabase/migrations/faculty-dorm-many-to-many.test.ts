import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609300000_faculty_dorm_many_to_many.sql', import.meta.url),
  'utf8',
)

describe('faculty_dorm many-to-many (202609300000)', () => {
  it('lifts the primary key from (faculty) to (faculty, dorm_id)', () => {
    expect(sql).toMatch(/DROP CONSTRAINT faculty_dorm_pkey/)
    expect(sql).toMatch(/ADD CONSTRAINT faculty_dorm_pkey PRIMARY KEY \(faculty, dorm_id\)/)
  })

  it('adds is_primary defaulting true so every existing row stays primary', () => {
    expect(sql).toMatch(/ADD COLUMN is_primary boolean NOT NULL DEFAULT true/)
  })

  it('enforces at most one primary dorm per faculty', () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX faculty_dorm_one_primary\s+ON public\.faculty_dorm \(faculty\)\s+WHERE is_primary/,
    )
  })

  it('ships set_primary_dorm that demotes before it promotes', () => {
    const fn = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION public.set_primary_dorm'),
      sql.indexOf('REVOKE ALL ON FUNCTION public.set_primary_dorm'),
    )
    expect(fn).toMatch(/SECURITY DEFINER/)
    expect(fn).toMatch(/SET search_path TO 'public'/)
    const demote = fn.indexOf('SET is_primary = false')
    const promote = fn.indexOf('SET is_primary = true')
    expect(demote).toBeGreaterThan(-1)
    expect(promote).toBeGreaterThan(demote)
    // guards against linking-less faculties
    expect(fn).toMatch(/RAISE EXCEPTION[\s\S]*?P0002/)
  })

  it('locks set_primary_dorm down to service_role', () => {
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.set_primary_dorm\(text, uuid\) FROM anon, authenticated/)
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.set_primary_dorm\(text, uuid\) TO service_role/)
  })

  it('touches no room RPC — the scalar faculty_dorm lookups stay single-row here', () => {
    expect(sql).not.toMatch(/assign_student_room_atomic|assign_permit_room_atomic|approve_permit_room_atomic/)
  })
})
