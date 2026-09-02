import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./20260902021853_atomic_payment_ai_review.sql', import.meta.url),
  'utf8',
)
const compatibilitySql = readFileSync(
  new URL('./20260902022241_payment_rpc_compatibility.sql', import.meta.url),
  'utf8',
)
const returnAliasSql = readFileSync(
  new URL('./20260902022511_fix_atomic_payment_return_alias.sql', import.meta.url),
  'utf8',
)

describe('atomic payment AI review migration', () => {
  it('accepts only passed or manual review states', () => {
    expect(sql).toContain("p_ai_review NOT IN ('passed', 'manual')")
  })

  it('requires a transaction id only for AI-passed submissions', () => {
    expect(sql).toContain("p_ai_review = 'passed'")
    expect(sql).toContain("p_ai_review = 'manual'")
    expect(sql).toContain("coalesce(p_transaction_id, '') <> ''")
  })

  it('persists ai_review inside the payment insert', () => {
    expect(sql).toMatch(/faculty,\s+ai_review\s+\)/)
    expect(sql).toMatch(/v_faculty,\s+p_ai_review/)
  })

  it('keeps the RPC service-role only', () => {
    expect(sql).toContain('FROM PUBLIC, anon, authenticated;')
    expect(sql).toContain('TO service_role;')
  })

  it('keeps legacy verified callers working during rollout', () => {
    expect(compatibilitySql).toContain("p_transaction_id_normalized,\n    'passed'")
    expect(compatibilitySql).toContain('FROM PUBLIC, anon, authenticated;')
    expect(compatibilitySql).toContain('TO service_role;')
  })

  it('qualifies returned payment columns to avoid PL/pgSQL name collisions', () => {
    expect(returnAliasSql).toContain('public.tolovlar AS inserted_payment')
    expect(returnAliasSql).toContain('RETURNING inserted_payment.id')
  })
})
