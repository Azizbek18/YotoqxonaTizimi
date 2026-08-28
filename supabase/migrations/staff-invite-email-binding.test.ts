import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('./202609120000_staff_invite_email_binding.sql', import.meta.url), 'utf8')

describe('staff invite email binding (202609120000)', () => {
  it('adds a nullable email column to staff_invites', () => {
    expect(sql).toContain('ALTER TABLE public.staff_invites ADD COLUMN IF NOT EXISTS email text')
  })

  it('adds a gender column to staff', () => {
    expect(sql).toContain('ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS gender text')
  })

  it('allows only one pending (unrevoked, unused) invite per email', () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS staff_invites_one_pending_per_email\s+ON public\.staff_invites \(lower\(email\)\)\s+WHERE email IS NOT NULL AND revoked_at IS NULL AND use_count = 0/,
    )
  })

  it('recreates claim_staff_invite to also return the bound email', () => {
    expect(sql).toContain('DROP FUNCTION IF EXISTS public.claim_staff_invite(text)')
    expect(sql).toMatch(/RETURNS TABLE \(faculty text, role text, email text\)/)
    expect(sql).toContain('RETURN QUERY SELECT v_faculty, v_role, v_email')
  })

  it('refuses an email-bound code without spending a use when that email is already staff', () => {
    expect(sql).toMatch(/IF v_email IS NOT NULL AND EXISTS \(\s*SELECT 1 FROM public\.staff s WHERE lower\(s\.email\) = lower\(v_email\)/)
    expect(sql).toContain("RAISE EXCEPTION 'Email already registered'")
  })

  it('keeps the function locked down to service_role', () => {
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.claim_staff_invite(text) FROM anon, authenticated')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.claim_staff_invite(text) TO service_role')
  })
})
