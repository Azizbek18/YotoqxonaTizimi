import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609300012_dorm_room_grants.sql', import.meta.url),
  'utf8',
)
const ddl = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ')

// A 'simple' dorm can hand SPECIFIC rooms on one faculty's floor to another
// (dorm_room_grant), so several faculties share a floor. The grant overrides
// the dorm_floor owner in the assign RPCs' simple branch; the blocked branch
// (dorm_section) is untouched.
describe('dorm room grants (202609300012)', () => {
  it('creates dorm_room_grant keyed on (dorm_id, room_number), RLS on, no policy', () => {
    const tbl = ddl.slice(
      ddl.indexOf('CREATE TABLE IF NOT EXISTS public.dorm_room_grant'),
      ddl.indexOf('dorm_room_grant_faculty_idx'),
    )
    expect(tbl).toMatch(/PRIMARY KEY \(dorm_id, room_number\)/)
    expect(tbl).toMatch(/faculty\s+text NOT NULL/)
    expect(tbl).toMatch(/dorm_id\s+uuid NOT NULL REFERENCES public\.dorms\(id\) ON DELETE CASCADE/)
    expect(ddl).toMatch(/ALTER TABLE public\.dorm_room_grant ENABLE ROW LEVEL SECURITY/)
    expect(ddl).not.toMatch(/CREATE POLICY[\s\S]*dorm_room_grant/)
  })

  it('re-emits the assign RPCs with CREATE OR REPLACE (signature unchanged, no DROP)', () => {
    for (const fn of ['assign_student_room_atomic', 'assign_permit_room_atomic']) {
      expect(ddl).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\( p_\\w+ uuid, p_room_number text, p_max_capacity integer DEFAULT 4, p_dorm_id uuid DEFAULT NULL, p_block text DEFAULT NULL, p_floor integer DEFAULT NULL \\)`))
      expect(ddl).not.toMatch(new RegExp(`DROP FUNCTION IF EXISTS public\\.${fn}`))
    }
  })

  it('checks the room grant before the floor owner, and the grant wins', () => {
    // both assign RPCs declare v_room_grant and do the grant lookup (once per
    // simple branch = twice total)
    expect((ddl.match(/v_owner text; v_section_gender text;(?: v_floor_owner text;)? v_room_grant text;/g) ?? []).length).toBe(2)
    expect((ddl.match(/SELECT faculty INTO v_room_grant FROM public\.dorm_room_grant WHERE dorm_id = v_dorm_id AND room_number = p_room_number/g) ?? []).length).toBe(2)
    expect(ddl).toMatch(/RAISE EXCEPTION 'Room is granted to another faculty' USING ERRCODE = 'P0007'/)
    // the floor-owner check now sits inside the ELSE of the grant check
    expect(ddl).toMatch(/ELSE SELECT faculty INTO v_(owner|floor_owner) FROM public\.dorm_floor WHERE dorm_id = v_dorm_id AND floor_number = v_floor; IF FOUND AND v_\w+ IS DISTINCT FROM v_faculty THEN RAISE EXCEPTION 'Room is on another faculty''s floor'/)
  })

  it('leaves the blocked branch (dorm_section) exactly as it was', () => {
    // still section-owned, still the section error strings, no grant lookup there
    expect(ddl).toMatch(/FROM public\.dorm_section WHERE dorm_id = v_dorm_id AND block = v_block AND floor_number = v_floor/)
    expect(ddl).toMatch(/RAISE EXCEPTION 'Section belongs to another faculty' USING ERRCODE = 'P0007'/)
    const blocked = ddl.slice(ddl.indexOf('BLOCKED BINO (blok + qavat + xona)'), ddl.indexOf('============ SIMPLE BINO'))
    expect(blocked).not.toContain('dorm_room_grant')
  })

  it('dorm_grant_room: refuses a blocked dorm, guards conflicting residents, auto-links faculty_dorm, syncs layout', () => {
    const fn = ddl.slice(
      ddl.indexOf('CREATE OR REPLACE FUNCTION public.dorm_grant_room'),
      ddl.indexOf('CREATE OR REPLACE FUNCTION public.dorm_ungrant_room'),
    )
    expect(fn).toMatch(/IF v_layout = 'blocked' THEN RAISE EXCEPTION 'Blocked dorms use dorm_section/)
    expect(fn).toMatch(/still has % resident\(s\) from another faculty[\s\S]*?USING ERRCODE = 'P0003'/)
    expect(fn).toMatch(/INSERT INTO public\.faculty_dorm \(faculty, dorm_id, is_primary\) VALUES \(p_faculty, p_dorm_id, false\) ON CONFLICT \(faculty, dorm_id\) DO NOTHING/)
    expect(fn).toMatch(/INSERT INTO public\.dorm_room_grant[\s\S]*?ON CONFLICT \(dorm_id, room_number\) DO UPDATE SET/)
    expect(fn).toMatch(/UPDATE public\.floor_room_layout SET faculty = p_faculty/)
  })

  it('dorm_ungrant_room: refuses while occupied, reverts layout faculty to the floor owner', () => {
    const fn = ddl.slice(ddl.indexOf('CREATE OR REPLACE FUNCTION public.dorm_ungrant_room'))
    expect(fn).toMatch(/IF v_residents > 0 THEN RAISE EXCEPTION 'Room % still has % resident\(s\)'.*USING ERRCODE = 'P0003'/)
    expect(fn).toMatch(/DELETE FROM public\.dorm_room_grant WHERE dorm_id = p_dorm_id AND room_number = p_room_number/)
    expect(fn).toMatch(/SELECT faculty INTO v_owner FROM public\.dorm_floor[\s\S]*?UPDATE public\.floor_room_layout SET faculty = v_owner/)
  })

  it('locks every function to service_role', () => {
    for (const sig of [
      'assign_student_room_atomic(uuid, text, integer, uuid, text, integer)',
      'assign_permit_room_atomic(uuid, text, integer, uuid, text, integer)',
      'dorm_grant_room(uuid, text, text, uuid)',
      'dorm_ungrant_room(uuid, text)',
    ]) {
      const esc = sig.replace(/[()]/g, '\\$&')
      expect(ddl).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${esc} FROM anon, authenticated`))
      expect(ddl).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${esc} TO service_role`))
    }
  })
})
