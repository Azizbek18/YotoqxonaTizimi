import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609280001_carry_room_on_activation.sql', import.meta.url),
  'utf8',
)

describe('202609280001_carry_room_on_activation', () => {
  it('rewrites both room functions', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.assign_permit_room_atomic')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.activate_pending_student')
  })

  it('only touches a pending, room-less users row', () => {
    expect(sql).toContain("u.status = 'pending'")
    expect(sql).toContain('u.room_number IS NULL')
  })

  it('keeps the service_role-only lockdown', () => {
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) TO service_role')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.activate_pending_student(uuid, text)')
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) FROM anon, authenticated')
  })
})
