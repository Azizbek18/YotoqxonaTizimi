import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('./202609100000_drop_rls_drift.sql', import.meta.url), 'utf8')

describe('RLS drift cleanup (202609100000)', () => {
  it('drops the self-service users UPDATE/INSERT escalation policies', () => {
    for (const name of ['users_can_update_themselves', 'users_can_insert_self', 'Allow individual insert']) {
      expect(sql).toContain(`DROP POLICY IF EXISTS "${name}" ON public.users`)
    }
  })

  it('drops the role-based staff-wide arizalar policies', () => {
    expect(sql).toContain('DROP POLICY IF EXISTS "Admins can view all arizalar" ON public.arizalar')
    expect(sql).toContain('DROP POLICY IF EXISTS "Zamdekan can update all applications" ON public.arizalar')
  })

  it('drops the undocumented bemorlar test table', () => {
    expect(sql).toContain('DROP TABLE IF EXISTS public.bemorlar')
  })

  it('drops the apostrophe-named duplicate staff policy without typing the name', () => {
    expect(sql).toMatch(/pg_policies[\s\S]*tablename = 'staff'[\s\S]*LIKE 'Xodimlar%'/)
    expect(sql).toContain("EXECUTE format('DROP POLICY %I ON public.staff', p)")
  })

  it('never re-creates a client-facing write policy', () => {
    expect(sql).not.toMatch(/CREATE POLICY/i)
  })

  it('keeps RLS enabled on the touched tables', () => {
    expect(sql).toContain('ALTER TABLE public.users ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('ALTER TABLE public.arizalar ENABLE ROW LEVEL SECURITY')
  })
})
