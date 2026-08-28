import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609030001_room_assignment_rpcs_faculty.sql', import.meta.url),
  'utf8',
)
const cleanup = readFileSync(
  new URL('./202609030000_clear_cross_faculty_room_assignments.sql', import.meta.url),
  'utf8',
)

describe('room-assignment RPC faculty scoping', () => {
  it('every room-placement RPC and the layout replace use the same faculty:room advisory lock key', () => {
    const perRoomLock = /pg_advisory_xact_lock\(hashtext\((?:v_faculty|p_faculty) \|\| ':' \|\| (?:p_room_number|v_room)\)\)/g
    // 3 assignment RPCs + the per-removed-room loop in replace_floor_room_layout
    expect(sql.match(perRoomLock)?.length).toBe(4)
    // The old bare-room-number key must be gone from this migration.
    expect(sql).not.toContain('pg_advisory_xact_lock(hashtext(p_room_number))')
  })

  it('reads the faculty before taking the lock, and scopes the layout lookup by it', () => {
    expect(sql).toContain("COALESCE(NULLIF(faculty, ''), 'amit')")
    expect(sql).toContain('FROM public.floor_room_layout\n  WHERE faculty = v_faculty AND room_number = p_room_number')
  })

  it('scopes occupancy and gender counts to the same faculty building', () => {
    // No unqualified "room_number = p_room_number" occupant count survives —
    // every occupant/gender subquery pairs it with the faculty filter.
    const bareOccupancy = /WHERE (?:role = 'talaba'|status = 'approved')\s+AND room_number = p_room_number/g
    expect(sql.match(bareOccupancy)).toBeNull()
  })

  it('stays locked down to service_role', () => {
    for (const fn of [
      'assign_student_room_atomic(uuid, text, int)',
      'approve_permit_room_atomic(uuid, text, int)',
      'assign_permit_room_atomic(uuid, text, int)',
      'replace_floor_room_layout(text, int, jsonb)',
    ]) {
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role`)
      expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION public.${fn} FROM anon, authenticated`)
    }
  })

  it('the cleanup migration only clears non-primary-faculty rooms', () => {
    expect(cleanup).toContain("lower(coalesce(faculty, '')) NOT IN ('amit', '')")
    expect(cleanup).toContain('UPDATE public.users')
    expect(cleanup).toContain('UPDATE public.permit_requests')
    // Never touches an AMIT / faculty-less resident's room.
    expect(cleanup).not.toMatch(/WHERE role = 'talaba'\s+AND room_number IS NOT NULL;/)
  })
})
