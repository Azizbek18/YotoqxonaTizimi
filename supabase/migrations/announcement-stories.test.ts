import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('./202609300006_announcement_stories.sql', import.meta.url), 'utf8')

describe('announcement stories migration (202609300006)', () => {
  it('creates the table with a hard 24h TTL default', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.announcement_stories')
    expect(sql).toMatch(/expires_at\s+timestamptz NOT NULL DEFAULT \(now\(\) \+ interval '24 hours'\)/)
  })

  it('is service-role only — no anon/authenticated access to the table', () => {
    expect(sql).toContain('ALTER TABLE public.announcement_stories ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE ALL ON TABLE public.announcement_stories FROM anon, authenticated')
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.announcement_stories TO service_role')
  })

  it('constrains the type to the four announcement categories', () => {
    expect(sql).toMatch(/type IN \('Muhim', 'Tadbir', 'Yangilik', 'Ogohlantirish'\)/)
  })

  it('creates a public storage bucket for the images', () => {
    expect(sql).toMatch(/INSERT INTO storage\.buckets[\s\S]*'stories', 'stories', true, 4194304/)
    expect(sql).toContain('"Story images are publicly accessible"')
    expect(sql).toContain("USING (bucket_id = 'stories')")
  })

  it('adds the stories bucket to the live-auth-session carve-out', () => {
    expect(sql).toContain("bucket_id IN ('avatar', 'stories') OR (SELECT private.has_active_auth_session())")
  })

  it('indexes the active-per-faculty read path', () => {
    expect(sql).toContain('announcement_stories_active_idx')
    expect(sql).toContain('(faculty, expires_at DESC)')
  })
})
