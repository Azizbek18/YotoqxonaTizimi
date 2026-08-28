import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const captain = readFileSync(new URL('./202609040000_floor_captain_faculty.sql', import.meta.url), 'utf8')
const duty = readFileSync(new URL('./202609040001_duty_schedule_faculty.sql', import.meta.url), 'utf8')

describe('floor captain faculty scoping (202609040000)', () => {
  it('makes captain uniqueness per (faculty, floor, gender)', () => {
    expect(captain).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS users_floor_captain_unique_idx\n  ON public.users ((COALESCE(NULLIF(faculty, ''), 'amit')), assigned_floor, gender)\n  WHERE is_floor_captain = true",
    )
  })

  it('promote_floor_captain demotes only the same faculty building and locks per faculty', () => {
    expect(captain).toContain("hashtext('floor-captain:' || v_faculty || ':' || p_assigned_floor::text || ':' || p_gender)")
    expect(captain).toMatch(/UPDATE public\.users\s+SET is_floor_captain = false\s+WHERE is_floor_captain = true\s+AND COALESCE\(NULLIF\(faculty, ''\), 'amit'\) = v_faculty/)
  })

  it('stays service_role only', () => {
    expect(captain).toContain('GRANT EXECUTE ON FUNCTION public.promote_floor_captain(uuid, int, text, boolean) TO service_role')
    expect(captain).toContain('REVOKE EXECUTE ON FUNCTION public.promote_floor_captain(uuid, int, text, boolean) FROM anon, authenticated')
  })
})

describe('duty schedule faculty scoping (202609040001)', () => {
  it('derives the building from the captain and drops the spoofable p_faculty arg', () => {
    expect(duty).toContain("SELECT COALESCE(NULLIF(u.faculty, ''), 'amit') INTO v_faculty")
    // The old 5-arg signature (with p_faculty) is dropped; nothing reads it.
    expect(duty).toContain('DROP FUNCTION IF EXISTS public.upsert_floor_duty_schedule(uuid, integer, text, text, text)')
    expect(duty).toContain('CREATE OR REPLACE FUNCTION public.upsert_floor_duty_schedule(\n  p_creator_id uuid,\n  p_floor integer,\n  p_gender text,\n  p_text text\n)')
    // The old fallback that stamped a non-faculty label on the row is gone.
    expect(duty).not.toContain("'Barchasi'")
    // p_faculty appears only in explanatory comments, never in a statement.
    expect(duty).not.toMatch(/^\s*[^-].*p_faculty/m)
  })

  it('scopes the duty row lookup, the advisory lock and the unique index by faculty', () => {
    expect(duty).toContain("COALESCE(faculty, 'amit') = v_faculty")
    expect(duty).toContain("hashtextextended('duty-schedule:' || v_faculty || ':' || p_floor::text || ':' || p_gender, 0)")
    expect(duty).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS elonlar_duty_schedule_scope_uidx\n  ON public.elonlar ((COALESCE(faculty, 'amit')), target_floor, target_gender)",
    )
  })

  it('requires a faculty on every duty-schedule row via CHECK', () => {
    expect(duty).toMatch(/elonlar_duty_schedule_scope_check[\s\S]*faculty IS NOT NULL AND faculty <> ''/)
  })

  it('backfills existing floor rows to the primary building', () => {
    expect(duty).toContain("SET faculty = 'amit'")
    expect(duty).toContain("WHERE audience = 'floor'")
  })

  it('stays service_role only', () => {
    expect(duty).toContain('GRANT EXECUTE ON FUNCTION public.upsert_floor_duty_schedule(uuid, integer, text, text)\n  TO service_role')
    expect(duty).toContain('REVOKE ALL ON FUNCTION public.upsert_floor_duty_schedule(uuid, integer, text, text)\n  FROM PUBLIC, anon, authenticated')
  })
})
