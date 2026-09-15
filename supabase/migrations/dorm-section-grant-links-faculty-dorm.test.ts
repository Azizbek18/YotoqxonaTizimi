import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609300020_dorm_section_grant_links_faculty_dorm.sql', import.meta.url),
  'utf8',
)

// Bug: a blocked-dorm section grant (dorm_assign_section) only wrote
// dorm_section, never faculty_dorm — so assign_student_room_atomic /
// assign_permit_room_atomic (which gate an explicit p_dorm_id on
// faculty_dorm membership) rejected every placement into a granted
// section with P0002, even though the room genuinely exists and the
// dekan panel could see it fine (it reads dorm_section directly).
// dorm_grant_room (simple-dorm room grants, 202609300012) already did
// this correctly — this migration brings dorm_assign_section to parity
// and backfills the faculty_dorm rows that were missing in prod
// (7-yotoqxona: iqtisodiyot + ozbek-filologiyasi sections).
describe('dorm_assign_section links faculty_dorm (202609300020)', () => {
  const fn = sql.slice(
    sql.indexOf('CREATE OR REPLACE FUNCTION public.dorm_assign_section'),
    sql.indexOf('-- Backfill'),
  )

  it('inserts a non-primary faculty_dorm row for the granted faculty, same pattern as dorm_grant_room', () => {
    expect(fn).toMatch(
      /INSERT INTO public\.faculty_dorm \(faculty, dorm_id, is_primary\)\s*\n\s*VALUES \(p_faculty, p_dorm_id, false\)\s*\n\s*ON CONFLICT \(faculty, dorm_id\) DO NOTHING;/,
    )
  })

  it('still upserts dorm_section and syncs floor_room_layout.faculty (unchanged behaviour)', () => {
    expect(fn).toMatch(/INSERT INTO public\.dorm_section \(dorm_id, block, floor_number, faculty, assigned_by\)[\s\S]*?ON CONFLICT \(dorm_id, block, floor_number\) DO UPDATE SET/)
    expect(fn).toMatch(/UPDATE public\.floor_room_layout\s*\n\s*SET faculty = p_faculty\s*\n\s*WHERE dorm_id = p_dorm_id AND block = v_block AND floor_number = p_floor/)
  })

  it('still refuses when another faculty already lives in the section', () => {
    expect(fn).toMatch(/still has % resident\(s\) from another faculty[\s\S]*?USING ERRCODE = 'P0003'/)
  })

  it('backfills faculty_dorm for every (faculty, dorm_id) already in dorm_section', () => {
    const backfill = sql.slice(sql.indexOf('-- Backfill'))
    expect(backfill).toMatch(
      /INSERT INTO public\.faculty_dorm \(faculty, dorm_id, is_primary\)\s*\n\s*SELECT DISTINCT ds\.faculty, ds\.dorm_id, false\s*\n\s*FROM public\.dorm_section ds\s*\n\s*ON CONFLICT \(faculty, dorm_id\) DO NOTHING;/,
    )
  })

  it('re-locks dorm_assign_section to service_role only', () => {
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.dorm_assign_section\([^)]*\) FROM anon, authenticated/)
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.dorm_assign_section\([^)]*\) TO service_role/)
  })
})
