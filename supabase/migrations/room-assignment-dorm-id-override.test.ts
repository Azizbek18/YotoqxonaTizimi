import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609300003_room_assignment_dorm_id_override.sql', import.meta.url),
  'utf8',
)

// Lets a dekan place a student/permit into a room in a SPECIFIC one of
// their faculty's buildings (many-to-many, 202609300000), not just
// whichever the row/faculty already resolves to. Adds an optional
// p_dorm_id, highest priority when given; omitted keeps the exact prior
// resolution order (row's own dorm_id, then faculty's primary).
describe('room-assignment dorm_id override (202609300003)', () => {
  const FUNCTIONS = ['assign_student_room_atomic', 'assign_permit_room_atomic']

  it('drops the old 3-arg signatures and recreates with p_dorm_id as a 4th param', () => {
    for (const fn of FUNCTIONS) {
      expect(sql).toMatch(new RegExp(`DROP FUNCTION IF EXISTS public\\.${fn}\\(uuid, text, integer\\)`))
      expect(sql).toMatch(new RegExp(`CREATE FUNCTION public\\.${fn}\\(\\s*p_\\w+_id uuid, p_room_number text, p_max_capacity integer DEFAULT 4, p_dorm_id uuid DEFAULT NULL`))
    }
  })

  function body(fnName: string) {
    const start = sql.indexOf(`CREATE FUNCTION public.${fnName}`)
    const nextDrop = sql.indexOf('DROP FUNCTION', start + 1)
    return sql.slice(start, nextDrop === -1 ? undefined : nextDrop)
  }

  it('an explicit p_dorm_id is validated against faculty_dorm and wins over the row/primary resolution', () => {
    for (const fn of FUNCTIONS) {
      const fnBody = body(fn)
      expect(fnBody).toMatch(/IF p_dorm_id IS NOT NULL THEN/)
      expect(fnBody).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.faculty_dorm WHERE faculty = v_faculty AND dorm_id = p_dorm_id\)/)
      expect(fnBody).toMatch(/RAISE EXCEPTION 'Dorm % does not belong to faculty %'.*USING ERRCODE = 'P0002'/)
      expect(fnBody).toMatch(/v_dorm_id := p_dorm_id;/)
    }
  })

  it('omitted p_dorm_id keeps the exact prior fallback: row dorm_id, then is_primary', () => {
    for (const fn of FUNCTIONS) {
      const fnBody = body(fn)
      expect(fnBody).toMatch(/ELSE\s*\n\s*v_dorm_id := COALESCE\(v_row_dorm, \(SELECT dorm_id FROM public\.faculty_dorm WHERE faculty = v_faculty AND is_primary\)\);/)
    }
  })

  it('re-locks both down to service_role only, on the new 4-arg signature', () => {
    for (const fn of FUNCTIONS) {
      expect(sql).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\(uuid, text, integer, uuid\\) FROM anon, authenticated`))
      expect(sql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\(uuid, text, integer, uuid\\) TO service_role`))
    }
  })

  it('keeps occupancy/gender/floor-ownership checks and the advisory-lock key untouched', () => {
    for (const fn of FUNCTIONS) {
      const fnBody = body(fn)
      expect(fnBody).toMatch(/pg_advisory_xact_lock\(hashtext\(v_dorm_id::text \|\| ':' \|\| p_room_number\)\)/)
      expect(fnBody).toMatch(/RAISE EXCEPTION 'Room is on another faculty''s floor' USING ERRCODE = 'P0007'/)
      expect(fnBody).toMatch(/RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001'/)
      expect(fnBody).toMatch(/RAISE EXCEPTION 'Room is full' USING ERRCODE = 'P0001'/)
    }
  })
})
