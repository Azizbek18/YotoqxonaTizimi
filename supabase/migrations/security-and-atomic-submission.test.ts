import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202607290000_security_and_atomic_submission.sql', import.meta.url),
  'utf8',
)

describe('security and atomic submission migration', () => {
  it.each([
    'Active staff manage permit requests',
    'Active staff view payments',
    'Active admins manage payments',
    'Floor captains can manage duty schedule',
    'Residents or staff manage cleaning schedule',
    'Students can insert their own applications',
    'Users can update relevant applications',
    'Users can delete relevant applications',
    'Active admins can manage students',
  ])('drops the direct browser bypass policy: %s', (policy) => {
    expect(sql).toContain(`DROP POLICY IF EXISTS "${policy}"`)
  })

  it('creates server-only atomic payment and duty-schedule functions', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.submit_payment_batch_atomic')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.upsert_floor_duty_schedule')
    expect(sql).toContain('TO service_role;')
    expect(sql).toContain('elonlar_duty_schedule_scope_uidx')
  })

  it('requires an active admin in the legacy compatibility helper', () => {
    expect(sql).toContain("staff.status = 'active'")
    expect(sql).toContain('uid = auth.uid()')
  })
})
