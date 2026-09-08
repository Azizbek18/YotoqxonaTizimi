import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609300015_resolve_floor_syncs_room_faculty.sql', import.meta.url),
  'utf8',
)
const ddl = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ')

describe('dorm_resolve_floor syncs floor_room_layout.faculty (202609300015)', () => {
  it('only replaces dorm_resolve_floor', () => {
    expect(ddl).toMatch(/CREATE OR REPLACE FUNCTION public\.dorm_resolve_floor\(/)
    expect(ddl).not.toMatch(/CREATE OR REPLACE FUNCTION public\.dorm_claim_floors/)
    expect(ddl).not.toMatch(/CREATE OR REPLACE FUNCTION public\.dorm_withdraw_floors/)
  })

  it('writes the new owner onto the floor\'s room rows on accept', () => {
    expect(ddl).toMatch(
      /UPDATE public\.floor_room_layout frl SET faculty = v_row\.pending_faculty WHERE frl\.dorm_id = p_dorm_id AND frl\.floor_number = p_floor/,
    )
  })

  it('leaves rooms granted to a third faculty alone', () => {
    expect(ddl).toMatch(
      /NOT EXISTS \( SELECT 1 FROM public\.dorm_room_grant g WHERE g\.dorm_id = p_dorm_id AND g\.room_number = frl\.room_number \)/,
    )
  })

  it('touches only simple (non-blocked) room rows', () => {
    expect(ddl).toMatch(/frl\.block IS NULL/)
  })

  it('skips rows already tagged with the new owner', () => {
    expect(ddl).toMatch(/frl\.faculty IS DISTINCT FROM v_row\.pending_faculty/)
  })

  it('keeps the resident-block guard and the per-dorm advisory lock', () => {
    expect(ddl).toMatch(/v_residents > 0[\s\S]*?USING ERRCODE = 'P0003'/)
    expect(ddl).toMatch(/pg_advisory_xact_lock\(hashtext\('dorm_floor:' \|\| p_dorm_id::text\)\)/)
  })

  it('does not sync on reject (the room UPDATE is after the accept branch returns)', () => {
    const rejectIdx = ddl.indexOf("'outcome', 'rejected'")
    const syncIdx = ddl.indexOf('UPDATE public.floor_room_layout frl')
    expect(rejectIdx).toBeGreaterThan(-1)
    expect(syncIdx).toBeGreaterThan(rejectIdx)
  })

  it('stays service_role-only', () => {
    expect(ddl).toMatch(/REVOKE EXECUTE ON FUNCTION public\.dorm_resolve_floor\(uuid, int, uuid, boolean\) FROM anon, authenticated/)
    expect(ddl).toMatch(/GRANT EXECUTE ON FUNCTION public\.dorm_resolve_floor\(uuid, int, uuid, boolean\) TO service_role/)
  })
})
