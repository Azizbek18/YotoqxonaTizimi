import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./202609290000_backfill_user_dorm_and_guard.sql', import.meta.url),
  'utf8',
)

describe('202609290000_backfill_user_dorm_and_guard', () => {
  it('backfills users.dorm_id from the matching permit then from faculty_dorm', () => {
    expect(sql).toContain('UPDATE public.users u')
    expect(sql).toContain('FROM public.permit_requests pr')
    expect(sql).toContain('pr.dorm_id IS NOT NULL')
    expect(sql).toContain('FROM public.faculty_dorm fd')
    expect(sql).toContain("COALESCE(NULLIF(TRIM(u.faculty), ''), 'amit')")
  })

  it('guards both users and permit_requests with a roomed⇒dorm trigger', () => {
    expect(sql).toContain('FUNCTION public.enforce_dorm_id_when_roomed()')
    expect(sql).toContain('NEW.room_number IS NOT NULL AND NEW.dorm_id IS NULL')
    expect(sql).toContain('RAISE EXCEPTION')
    expect(sql).toContain('trg_users_dorm_when_roomed ON public.users')
    expect(sql).toContain('trg_permit_requests_dorm_when_roomed ON public.permit_requests')
  })
})
