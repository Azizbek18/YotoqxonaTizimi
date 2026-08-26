import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202608260000_room_freeze.sql', import.meta.url),
  'utf8',
)

describe('room freeze migration', () => {
  it('adds the frozen columns with a safe default', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS frozen boolean NOT NULL DEFAULT false')
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS frozen_reason text')
  })

  it('blocks both room-placement RPCs on a frozen room before the capacity/gender checks', () => {
    // Each occurrence pairs the frozen check right after the room-exists
    // check (P0002) and before the first capacity check (P0001) — asserting
    // the substring spans that gap in both functions keeps the ordering
    // honest, not just the check's mere presence.
    const guard = /RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002';\s*END IF;\s*IF v_frozen THEN\s*RAISE EXCEPTION 'Room is frozen' USING ERRCODE = 'P0004';\s*END IF;/g
    expect(sql.match(guard)?.length).toBe(2)
  })

  it('carries frozen state forward across a floor replace instead of silently thawing it', () => {
    expect(sql).toContain('jsonb_object_agg(old.room_number')
    expect(sql).toContain("WHERE old.floor_number = p_floor_number AND old.frozen")
    expect(sql).toContain("COALESCE((v_frozen_snapshot -> (r->>'roomNumber') ->> 'frozen')::boolean, false)")
  })
})
