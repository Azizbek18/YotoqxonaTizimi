import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('./202609300021_enforce_room_gender_integrity.sql', import.meta.url), 'utf8')

describe('room gender integrity trigger migration', () => {
  it('guards both registered residents and approved room reservations', () => {
    expect(sql).toContain('CREATE TRIGGER enforce_users_room_gender')
    expect(sql).toContain('CREATE TRIGGER enforce_permit_room_gender')
    expect(sql).toContain("NEW.gender IS NULL OR NEW.gender NOT IN ('male', 'female')")
  })

  it('serializes by the complete room identity and rejects unknown or opposite gender occupants', () => {
    expect(sql).toContain('pg_advisory_xact_lock(hashtext(v_lock_key))')
    expect(sql).toContain("v_layout <> 'blocked'")
    expect(sql).toContain('occupants.gender IS DISTINCT FROM NEW.gender')
  })

  it('is ordered after the current room-assignment migrations', () => {
    expect(202609300021).toBeGreaterThan(202609300020)
  })
})
