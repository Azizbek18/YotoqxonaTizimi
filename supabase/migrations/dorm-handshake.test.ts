import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609140000_dorm_floor_handshake.sql', import.meta.url),
  'utf8',
)

describe('dorm_floor handshake (202609140000)', () => {
  it('adds the pending-claim columns and lets faculty be NULL', () => {
    expect(sql).toMatch(/ALTER TABLE public\.dorm_floor ALTER COLUMN faculty DROP NOT NULL/)
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS pending_faculty text/)
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS pending_by uuid/)
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS pending_at timestamptz/)
  })

  it('guards the row states with CHECK constraints', () => {
    expect(sql).toMatch(/dorm_floor_not_empty[\s\S]*?CHECK \(faculty IS NOT NULL OR pending_faculty IS NOT NULL\)/)
    expect(sql).toMatch(/dorm_floor_distinct_claims[\s\S]*?CHECK \(faculty IS DISTINCT FROM pending_faculty\)/)
  })

  it('defines the three handshake RPCs', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.dorm_claim_floors\(/)
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.dorm_resolve_floor\(/)
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.dorm_withdraw_floors\(/)
  })

  it('auto-confirms only when there is no other confirmed faculty in the dorm', () => {
    expect(sql).toMatch(/v_has_other_confirmed[\s\S]*?faculty IS NOT NULL AND faculty <> p_faculty/)
    expect(sql).toMatch(/IF NOT v_has_other_confirmed THEN[\s\S]*?confirmed_at = now\(\)/)
  })

  it('blocks a takeover while the losing faculty still has residents on the floor', () => {
    expect(sql).toMatch(/v_residents > 0[\s\S]*?USING ERRCODE = 'P0003'/)
  })

  it('serialises every mutation on a per-dorm advisory lock', () => {
    const locks = sql.match(/pg_advisory_xact_lock\(hashtext\('dorm_floor:' \|\| p_dorm_id::text\)\)/g) ?? []
    expect(locks.length).toBe(3)
  })

  it('grants execute to service_role only', () => {
    for (const fn of ['dorm_claim_floors', 'dorm_resolve_floor', 'dorm_withdraw_floors']) {
      expect(sql).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) FROM anon, authenticated`))
      expect(sql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO service_role`))
    }
  })
})
