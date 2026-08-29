import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609130000_dorm_shell_and_faculty_mapping.sql', import.meta.url),
  'utf8',
)

describe('dorm shell + faculty mapping (202609130000)', () => {
  it('creates the three new tables', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.dorms\b/)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.faculty_dorm\b/)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.dorm_floor\b/)
  })

  it('keeps the two fee columns out of dorms — they stay per-faculty', () => {
    const dormsBlock = sql.slice(
      sql.indexOf('CREATE TABLE IF NOT EXISTS public.dorms'),
      sql.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS dorms_number_key'),
    )
    expect(dormsBlock).not.toMatch(/monthly_fee|yearly_contract_fee/)
    expect(dormsBlock).toMatch(/ttj_name/)
    expect(dormsBlock).toMatch(/floor_count/)
  })

  it('enables RLS with no client-facing policy on every new table', () => {
    expect(sql).toMatch(/ALTER TABLE public\.dorms ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/ALTER TABLE public\.faculty_dorm ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/ALTER TABLE public\.dorm_floor ENABLE ROW LEVEL SECURITY/)
    expect(sql).not.toMatch(/CREATE POLICY/i)
  })

  it('adds a nullable dorm_id FK to staff / layout / users / permit_requests', () => {
    for (const table of ['staff', 'floor_room_layout', 'users', 'permit_requests']) {
      expect(sql).toMatch(
        new RegExp(
          `ALTER TABLE public\\.${table}\\s+ADD COLUMN IF NOT EXISTS dorm_id uuid REFERENCES public\\.dorms\\(id\\)`,
        ),
      )
    }
  })

  it('is idempotent — every INSERT is guarded', () => {
    const inserts = sql.match(/INSERT INTO[\s\S]*?;/g) ?? []
    expect(inserts.length).toBeGreaterThan(0)
    for (const stmt of inserts) {
      expect(stmt).toMatch(/ON CONFLICT[\s\S]*?DO NOTHING|NOT EXISTS \(SELECT 1/)
    }
  })

  it('seeds dorm #1 for amit and confirms all its floors', () => {
    expect(sql).toMatch(/INSERT INTO public\.faculty_dorm[\s\S]*?'amit'/)
    expect(sql).toMatch(/INSERT INTO public\.dorm_floor[\s\S]*?generate_series\(1, d\.floor_count\)/)
  })

  it('does not touch behaviour — no RPC or policy changes, no faculty column drops', () => {
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION/i)
    expect(sql).not.toMatch(/DROP COLUMN/i)
    expect(sql).not.toMatch(/ALTER COLUMN .* SET NOT NULL/i)
  })
})
