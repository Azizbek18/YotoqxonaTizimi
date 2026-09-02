import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const carry = readFileSync(
  new URL('./202609230000_carry_room_from_permit.sql', import.meta.url),
  'utf8',
)
const backfill = readFileSync(
  new URL('./202609230001_backfill_missing_student_room.sql', import.meta.url),
  'utf8',
)

describe('carry room from permit migration', () => {
  it('assign_permit_room_atomic still keeps the dorm-scoped guards (202609180000 body)', () => {
    expect(carry).toContain("RAISE EXCEPTION 'Room is on another faculty''s floor' USING ERRCODE = 'P0007'")
    expect(carry).toContain('COALESCE(v_room_capacity, p_max_capacity)')
    expect(carry).toContain('pg_advisory_xact_lock(hashtext(v_dorm_id::text')
  })

  it('assign_permit_room_atomic carries the room onto a matching pending account', () => {
    expect(carry).toContain('UPDATE public.users u')
    expect(carry).toContain("u.status = 'pending'")
    expect(carry).toContain('u.room_number IS NULL')
    expect(carry).toContain('u.passport_series = pr.passport_series')
    expect(carry).toContain('lower(trim(u.email)) = lower(trim(pr.email))')
  })

  it('activate_pending_student copies permit.room_number when the account has none', () => {
    // The copy must sit before the permit is flipped to 'registered'.
    const copyIdx = carry.indexOf('SET room_number = pr.room_number')
    const registeredIdx = carry.indexOf("SET status = 'registered'")
    expect(copyIdx).toBeGreaterThan(-1)
    expect(registeredIdx).toBeGreaterThan(copyIdx)
    expect(carry).toContain('AND pr.room_number IS NOT NULL')
    expect(carry).toContain('AND u.room_number IS NULL')
  })

  it('both functions stay service_role only', () => {
    expect(carry).toContain('GRANT EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) TO service_role')
    expect(carry).toContain('GRANT EXECUTE ON FUNCTION public.activate_pending_student(uuid, text)\n  TO service_role')
    expect(carry).toContain('REVOKE EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) FROM anon, authenticated')
  })
})

describe('backfill missing student room migration', () => {
  it('only touches roomless accounts and respects room capacity', () => {
    expect(backfill).toContain('u.room_number IS NULL')
    expect(backfill).toContain('c.occupied < COALESCE(c.capacity, 4)')
  })

  it('only pulls from approved/registered permits with a room', () => {
    expect(backfill).toContain("pr.status IN ('approved', 'registered')")
    expect(backfill).toContain('pr.room_number IS NOT NULL')
  })

  it('matches yollanma by jshshir and imtiyozli by null jshshir', () => {
    expect(backfill).toContain('pr.jshshir IS NOT NULL AND u.jshshir = pr.jshshir')
    expect(backfill).toContain("u.jshshir IS NULL AND pr.application_type = 'imtiyozli'")
  })
})
