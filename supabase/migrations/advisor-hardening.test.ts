import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = fs.readFileSync(
  path.join(import.meta.dirname, '202609200001_optimize_rls_and_foreign_keys.sql'),
  'utf8',
)

describe('Supabase advisor hardening migration', () => {
  it('adds every missing foreign-key index', () => {
    for (const index of [
      'dorm_floor_confirmed_by_idx',
      'dorm_floor_pending_by_idx',
      'elonlar_created_by_idx',
      'payment_receipt_uploads_student_id_idx',
      'staff_created_by_idx',
      'staff_dorm_id_idx',
      'staff_invites_created_by_idx',
    ]) {
      expect(sql).toContain(`CREATE INDEX IF NOT EXISTS ${index}`)
    }
  })

  it('removes the duplicate application index', () => {
    expect(sql).toContain('DROP INDEX IF EXISTS public.idx_arizalar_student_id')
  })

  it('uses initplan-friendly auth checks in the four affected policies', () => {
    expect(sql.match(/\(SELECT auth\.uid\(\)\)/g)).toHaveLength(4)
  })
})
