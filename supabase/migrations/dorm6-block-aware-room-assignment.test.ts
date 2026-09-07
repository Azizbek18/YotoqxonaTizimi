import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609300011_dorm6_block_aware_room_assignment.sql', import.meta.url),
  'utf8',
)

// P1: the two live room-assignment RPCs gain p_block + p_floor and branch on
// dorms.layout_kind. 'simple' path must stay byte-for-byte what it was; a
// 'blocked' dorm gets section (not floor) ownership, a 4-column room key and
// a 4-part advisory lock. Plus three new RPCs: dorm_build_blocked_layout,
// dorm_assign_section, dorm_clear_section.
describe('dorm 6 block-aware room assignment (202609300011)', () => {
  const ASSIGN = ['assign_student_room_atomic', 'assign_permit_room_atomic']

  function body(fn: string) {
    const start = sql.indexOf(`CREATE FUNCTION public.${fn}`)
    const end = sql.indexOf('REVOKE ALL ON FUNCTION', start)
    return sql.slice(start, end)
  }

  it('adds permit_requests.assigned_floor (needed because room numbers repeat per floor)', () => {
    expect(sql).toMatch(/ALTER TABLE public\.permit_requests ADD COLUMN IF NOT EXISTS assigned_floor int;/)
  })

  it('drops the old 4-arg signatures and recreates with p_block + p_floor', () => {
    for (const fn of ASSIGN) {
      expect(sql).toMatch(new RegExp(`DROP FUNCTION IF EXISTS public\\.${fn}\\(uuid, text, integer, uuid\\);`))
      expect(body(fn)).toMatch(/p_dorm_id uuid DEFAULT NULL,\s*p_block text DEFAULT NULL,\s*p_floor integer DEFAULT NULL/)
    }
  })

  it('branches on dorms.layout_kind and requires block + floor only for a blocked dorm', () => {
    for (const fn of ASSIGN) {
      const b = body(fn)
      expect(b).toMatch(/SELECT layout_kind, block_count INTO v_layout, v_block_count\s*\n\s*FROM public\.dorms WHERE id = v_dorm_id/)
      expect(b).toMatch(/IF v_layout = 'blocked' THEN/)
      expect(b).toMatch(/IF p_block IS NULL OR p_floor IS NULL THEN\s*\n\s*RAISE EXCEPTION 'Block and floor are required for this building' USING ERRCODE = 'P0002'/)
      // block is normalised + range-checked against block_count
      expect(b).toMatch(/v_block := upper\(btrim\(p_block\)\);/)
      expect(b).toMatch(/v_block !~ '\^\[A-Z\]\$' OR v_block > chr\(64 \+ v_block_count\)/)
    }
  })

  it('a blocked dorm keys the room on (dorm_id, block, floor, room) and locks on all four', () => {
    for (const fn of ASSIGN) {
      const b = body(fn)
      expect(b).toMatch(
        /pg_advisory_xact_lock\(hashtext\(\s*v_dorm_id::text \|\| ':' \|\| v_block \|\| ':' \|\| v_floor::text \|\| ':' \|\| p_room_number\)\)/,
      )
      expect(b).toMatch(
        /FROM public\.floor_room_layout\s*\n\s*WHERE dorm_id = v_dorm_id AND block = v_block\s*\n\s*AND floor_number = v_floor AND room_number = p_room_number/,
      )
    }
  })

  it('a blocked dorm takes ownership from dorm_section, not dorm_floor', () => {
    for (const fn of ASSIGN) {
      const b = body(fn)
      const blockedPart = b.slice(b.indexOf("IF v_layout = 'blocked' THEN"), b.indexOf('-- ============ SIMPLE BINO'))
      expect(blockedPart).toMatch(/FROM public\.dorm_section\s*\n\s*WHERE dorm_id = v_dorm_id AND block = v_block AND floor_number = v_floor/)
      expect(blockedPart).toMatch(/Section .* is not assigned to any faculty.*USING ERRCODE = 'P0007'/)
      expect(blockedPart).toMatch(/RAISE EXCEPTION 'Section belongs to another faculty' USING ERRCODE = 'P0007'/)
      expect(blockedPart).toMatch(/RAISE EXCEPTION 'Section reserved for other gender' USING ERRCODE = 'P0001'/)
      expect(blockedPart).not.toMatch(/dorm_floor/)
    }
  })

  it('keeps the simple-dorm path exactly as before (dorm_floor ownership, 2-part lock, block untouched)', () => {
    for (const fn of ASSIGN) {
      const b = body(fn)
      const simplePart = b.slice(b.indexOf('-- ============ SIMPLE BINO'))
      expect(simplePart).toMatch(/pg_advisory_xact_lock\(hashtext\(v_dorm_id::text \|\| ':' \|\| p_room_number\)\)/)
      expect(simplePart).toMatch(/FROM public\.dorm_floor\s*\n\s*WHERE dorm_id = v_dorm_id AND floor_number = v_floor/)
      expect(simplePart).toMatch(/RAISE EXCEPTION 'Room is on another faculty''s floor' USING ERRCODE = 'P0007'/)
      // the simple UPDATE never writes block
      const simpleUpdate = simplePart.match(/UPDATE public\.users\s+SET room_number = p_room_number[\s\S]*?WHERE id = p_student_id;/)
      if (simpleUpdate) expect(simpleUpdate[0]).not.toMatch(/block/)
    }
  })

  it('re-locks both assign RPCs to service_role on the new 6-arg signature', () => {
    for (const fn of ASSIGN) {
      expect(sql).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\(uuid, text, integer, uuid, text, integer\\) FROM anon, authenticated`))
      expect(sql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\(uuid, text, integer, uuid, text, integer\\) TO service_role`))
    }
  })

  it('does not touch approve_permit_room_atomic (dead code — no trigger calls it)', () => {
    expect(sql).not.toMatch(/FUNCTION public\.approve_permit_room_atomic/)
  })

  describe('dorm_build_blocked_layout', () => {
    const b = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION public.dorm_build_blocked_layout'),
      sql.indexOf('REVOKE ALL ON FUNCTION public.dorm_build_blocked_layout'),
    )
    it('refuses a non-blocked dorm', () => {
      expect(b).toMatch(/IF v_layout <> 'blocked' THEN\s*\n\s*RAISE EXCEPTION 'Dorm is not a blocked-layout building'/)
    })
    it('emits the fixed 9-room capacity profile from the diagram (1 -> 4, 5 -> 8, else 6)', () => {
      expect(b).toMatch(/v_cap\s+:= CASE r WHEN 1 THEN 4 WHEN 5 THEN 8 ELSE 6 END;/)
      expect(b).toMatch(/FOR r IN 1\.\.9 LOOP/)
    })
    it('is idempotent — inserts only rooms that do not already exist', () => {
      expect(b).toMatch(/INSERT INTO public\.floor_room_layout[\s\S]*?WHERE NOT EXISTS \(\s*\n\s*SELECT 1 FROM public\.floor_room_layout/)
      expect(b).toMatch(/GET DIAGNOSTICS v_inserted = ROW_COUNT;/)
    })
    it('takes the building-layout advisory lock', () => {
      expect(b).toMatch(/pg_advisory_xact_lock\(hashtext\(p_dorm_id::text \|\| ':layout'\)\)/)
    })
  })

  describe('dorm_assign_section / dorm_clear_section', () => {
    const assign = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION public.dorm_assign_section'),
      sql.indexOf('REVOKE ALL ON FUNCTION public.dorm_assign_section'),
    )
    const clear = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION public.dorm_clear_section'),
      sql.indexOf('REVOKE ALL ON FUNCTION public.dorm_clear_section'),
    )
    it('assign upserts the section and syncs floor_room_layout.faculty', () => {
      expect(assign).toMatch(/INSERT INTO public\.dorm_section \(dorm_id, block, floor_number, faculty, assigned_by\)[\s\S]*?ON CONFLICT \(dorm_id, block, floor_number\) DO UPDATE SET/)
      expect(assign).toMatch(/UPDATE public\.floor_room_layout\s*\n\s*SET faculty = p_faculty\s*\n\s*WHERE dorm_id = p_dorm_id AND block = v_block AND floor_number = p_floor/)
    })
    it('assign blocks when another faculty already lives in the section', () => {
      expect(assign).toMatch(/FROM public\.users\s*\n\s*WHERE role = 'talaba' AND dorm_id = p_dorm_id AND block = v_block\s*\n\s*AND assigned_floor = p_floor\s*\n\s*AND COALESCE\(NULLIF\(btrim\(faculty\), ''\), 'amit'\) <> p_faculty/)
      expect(assign).toMatch(/still has % resident\(s\) from another faculty[\s\S]*?USING ERRCODE = 'P0003'/)
    })
    it('clear refuses a section that still has residents', () => {
      expect(clear).toMatch(/IF v_residents > 0 THEN\s*\n\s*RAISE EXCEPTION 'Section .* still has % resident\(s\)'.*USING ERRCODE = 'P0003'/)
      expect(clear).toMatch(/DELETE FROM public\.dorm_section\s*\n\s*WHERE dorm_id = p_dorm_id AND block = v_block AND floor_number = p_floor/)
    })
    it('all three new RPCs are SECURITY DEFINER, search_path-pinned and service_role only', () => {
      for (const fn of ['dorm_build_blocked_layout', 'dorm_assign_section', 'dorm_clear_section']) {
        const decl = sql.slice(sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}`))
        expect(decl.slice(0, 400)).toMatch(/SECURITY DEFINER\s*\n\s*SET search_path TO 'public'/)
        expect(sql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\(`))
        expect(sql).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) FROM anon, authenticated`))
      }
    })
  })
})
