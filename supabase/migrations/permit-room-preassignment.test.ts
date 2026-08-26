import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202608270000_permit_room_preassignment.sql', import.meta.url),
  'utf8',
)

describe('permit room pre-assignment migration', () => {
  it('only reserves a room on an approved permit, never a pending one', () => {
    expect(sql).toContain("status = 'approved' FOR UPDATE")
    expect(sql).toContain("WHERE id = p_permit_id AND status = 'approved'")
  })

  it('checks room existence and frozen state before capacity/gender, same as assign_student_room_atomic', () => {
    expect(sql).toContain("RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002'")
    expect(sql).toContain("RAISE EXCEPTION 'Room is frozen' USING ERRCODE = 'P0004'")
  })

  it('excludes its own permit row when counting occupants and gender conflicts, so re-assigning the same permit never self-blocks', () => {
    expect(sql).toContain("status = 'approved' AND room_number = p_room_number AND id <> p_permit_id")
  })

  it('is locked down to service_role only, matching every other room-placement RPC', () => {
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) TO service_role')
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) FROM anon, authenticated')
  })
})
