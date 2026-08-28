import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('./202609110000_staff_invites_shared_dekan.sql', import.meta.url), 'utf8')

describe('shared dekan link (202609110000)', () => {
  it('lets staff_invites.faculty be NULL (the one shared code)', () => {
    expect(sql).toContain('ALTER TABLE public.staff_invites ALTER COLUMN faculty DROP NOT NULL')
  })

  it('enforces one active dekan per faculty via a partial unique index', () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS staff_one_active_dekan_per_faculty\s+ON public\.staff \(lower\(faculty\)\)\s+WHERE role = 'dekan' AND status = 'active'/,
    )
  })
})
