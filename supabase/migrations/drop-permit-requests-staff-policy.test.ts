import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609090000_drop_permit_requests_staff_policy.sql', import.meta.url),
  'utf8',
)

describe('permit_requests staff policy removal (202609090000)', () => {
  it('drops the staff-facing FOR ALL policy that spanned every faculty', () => {
    expect(sql).toContain('DROP POLICY IF EXISTS "Active staff manage permit requests" ON public.permit_requests')
  })

  it('never re-creates a client-facing policy on permit_requests', () => {
    expect(sql).not.toMatch(/CREATE POLICY/i)
  })

  it('leaves RLS enabled so anon/authenticated see no rows', () => {
    expect(sql).toContain('ALTER TABLE public.permit_requests ENABLE ROW LEVEL SECURITY')
  })
})
