import { describe, expect, it } from 'vitest'
import { UNREGISTERED_EXPORT_HEADERS, unregisteredExportRows } from './unregistered-export'
import type { UnregisteredPermitRow } from '../types'

const row: UnregisteredPermitRow = {
  id: 'p1',
  full_name: 'Sirojiddinov Husanboy Muhiddin ogli',
  gender: 'male',
  phone: '+998878275556',
  relative_phone: '+998888203636',
  email: 'mbm80967@gmail.com',
  faculty: 'amit',
  direction: 'amaliy-matematika',
  course: 2,
  study_type: 'kontrakt',
  application_type: 'yollanma',
  origin_region: "Farg'ona",
  origin_country: "O'zbekiston",
  ai_review: 'manual',
  passport_series: 'AD5615857',
  jshshir: '51511077080016',
  room_number: '162',
  dorm_id: 'd12',
  block: null,
  assigned_floor: null,
  created_at: '2026-09-09T07:57:06.884Z',
}

describe('unregisteredExportRows', () => {
  it('emits one row per permit with as many cells as headers', () => {
    const rows = unregisteredExportRows([row, { ...row, id: 'p2' }], () => '12-yotoqxona')
    expect(rows).toHaveLength(2)
    for (const r of rows) expect(r).toHaveLength(UNREGISTERED_EXPORT_HEADERS.length)
    expect(rows[1][0]).toBe(2)
  })

  it('writes the full, untruncated values the dekan needs', () => {
    const [r] = unregisteredExportRows([row], (id) => (id === 'd12' ? '12-yotoqxona' : ''))
    expect(r[1]).toBe('Sirojiddinov Husanboy Muhiddin ogli')
    expect(r).toContain('mbm80967@gmail.com')
    expect(r).toContain('51511077080016')
    expect(r).toContain('12-yotoqxona')
    expect(r).toContain("Farg'ona, O'zbekiston")
  })

  it('leaves missing fields blank instead of printing null/undefined', () => {
    const [r] = unregisteredExportRows(
      [{ ...row, email: null, relative_phone: null, room_number: null, dorm_id: null, origin_region: null, origin_country: null }],
      () => '',
    )
    expect(r.some((cell) => cell === null || cell === undefined || cell === 'null' || cell === 'undefined')).toBe(false)
  })
})
