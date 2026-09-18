import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const sql = readFileSync(
  new URL('./202609300022_fix_room_gender_trigger_table_branches.sql', import.meta.url),
  'utf8',
)

describe('room gender trigger table-specific branches', () => {
  it('reads role only inside the users branch', () => {
    expect(sql).toMatch(/IF TG_TABLE_NAME = 'users' THEN\s+IF NEW\.role/)
  })

  it('returns pending permit requests before room-integrity checks', () => {
    expect(sql).toMatch(
      /ELSIF TG_TABLE_NAME = 'permit_requests' THEN\s+IF NEW\.status IS DISTINCT FROM 'approved' OR NEW\.room_number IS NULL THEN\s+RETURN NEW;/,
    )
  })

  it('fails closed if the shared function is attached to another table', () => {
    expect(sql).toContain('Unsupported table for room gender trigger')
  })
})
