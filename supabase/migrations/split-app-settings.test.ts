import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609150000_split_app_settings.sql', import.meta.url),
  'utf8',
)

describe('split app_settings (202609150000)', () => {
  it('re-syncs dorms from app_settings before dropping anything', () => {
    const syncAt = sql.indexOf('UPDATE public.dorms')
    const dropAt = sql.indexOf('ALTER TABLE public.app_settings')
    expect(syncAt).toBeGreaterThan(-1)
    expect(dropAt).toBeGreaterThan(syncAt)
    // one dorm shared by two faculties -> most recently edited wins
    expect(sql).toMatch(/DISTINCT ON \(fd\.dorm_id\)[\s\S]*?ORDER BY fd\.dorm_id, a\.updated_at DESC/)
  })

  it('drops every non-fee column from app_settings', () => {
    for (const col of [
      'default_room_capacity',
      'floor_count',
      'ttj_name',
      'warning_threshold',
      'max_upload_size_mb',
      'security_phone',
      'komendant_name',
      'doctor_phone',
    ]) {
      expect(sql).toMatch(new RegExp(`DROP COLUMN IF EXISTS ${col}\\b`))
    }
  })

  it('keeps the fee columns and faculty PK', () => {
    expect(sql).not.toMatch(/DROP COLUMN IF EXISTS monthly_fee/)
    expect(sql).not.toMatch(/DROP COLUMN IF EXISTS yearly_contract_fee/)
    expect(sql).not.toMatch(/DROP COLUMN IF EXISTS faculty/)
  })
})
