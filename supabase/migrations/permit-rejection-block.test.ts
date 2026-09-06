import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('./202609300007_permit_rejection_block.sql', import.meta.url), 'utf8')

describe('permit rejection block migration (202609300007)', () => {
  it('adds the four tracking columns idempotently with safe defaults', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS rejection_count\s+integer NOT NULL DEFAULT 0/)
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS blocked\s+boolean NOT NULL DEFAULT false/)
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS blocked_at        timestamptz')
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS block_notified_at timestamptz')
  })

  it('indexes only the blocked rows', () => {
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS permit_requests_blocked_idx\s+ON public\.permit_requests \(blocked\) WHERE blocked/)
  })
})
