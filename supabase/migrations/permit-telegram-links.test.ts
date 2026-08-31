import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('./202609200002_permit_telegram_links.sql', import.meta.url), 'utf8')

describe('permit Telegram links migration', () => {
  it('stores only a token hash and protects the table with RLS', () => {
    expect(sql).toContain('token_hash text NOT NULL UNIQUE')
    expect(sql).not.toMatch(/\btoken\s+text/i)
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE ALL ON TABLE public.permit_telegram_links FROM anon, authenticated')
  })

  it('keeps one Telegram link per permit and deletes it with the permit', () => {
    expect(sql).toContain('permit_request_id uuid PRIMARY KEY')
    expect(sql).toContain('REFERENCES public.permit_requests(id) ON DELETE CASCADE')
  })
})
