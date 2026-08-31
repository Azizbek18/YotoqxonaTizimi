import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = fs.readFileSync(
  path.join(import.meta.dirname, '202609200000_enforce_dorm_upload_limit.sql'),
  'utf8',
)

describe('dorm upload limit migration', () => {
  it('aligns existing rows, the default and the database constraint to 4 MiB', () => {
    expect(sql).toContain('SET max_upload_size_mb = 4')
    expect(sql).toContain('ALTER COLUMN max_upload_size_mb SET DEFAULT 4')
    expect(sql).toContain('CHECK (max_upload_size_mb BETWEEN 1 AND 4)')
  })
})
