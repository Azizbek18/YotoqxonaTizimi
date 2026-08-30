import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('./202609190000_elonlar_system_audience.sql', import.meta.url), 'utf8')

describe('elonlar system audience (202609190000)', () => {
  it('drops the old audience check before re-adding it (idempotent)', () => {
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS elonlar_audience_check')
  })

  it("adds 'system' to the allowed audiences without losing the existing ones", () => {
    expect(sql).toMatch(
      /ADD CONSTRAINT elonlar_audience_check\s+CHECK \(audience IN \('all', 'faculty', 'floor', 'internal', 'system'\)\)/,
    )
  })
})
