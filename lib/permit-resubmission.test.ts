import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.generated'
import { classifyPermitResubmission } from './permit-resubmission'

type Row = {
  id: string
  status: string | null
  passport_series: string
  jshshir: string | null
  email: string
  permit_url: string
  application_type: string
}

const row = (over: Partial<Row> & Pick<Row, 'id'>): Row => ({
  status: 'rejected',
  passport_series: 'AB1234567',
  jshshir: '12345678901234',
  email: 'a@x.uz',
  permit_url: '2026/old.pdf',
  application_type: 'yollanma',
  ...over,
})

// Minimal stand-in for `from('permit_requests').select(cols).eq(col, val).maybeSingle()`.
function fakeSupabase(rows: Row[]) {
  return {
    from: () => ({
      select: () => ({
        eq: (col: keyof Row, val: string) => ({
          maybeSingle: async () => ({ data: rows.find((r) => String(r[col]) === val) ?? null, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient<Database>
}

const yollanma = { passport: 'AB1234567', jshshir: '12345678901234', email: 'a@x.uz' }

describe('classifyPermitResubmission', () => {
  it('no existing row → insert', async () => {
    expect(await classifyPermitResubmission(fakeSupabase([]), yollanma)).toEqual({ action: 'insert' })
  })

  it('own rejected row, no other collision → reopen it', async () => {
    const result = await classifyPermitResubmission(fakeSupabase([row({ id: 'p1', status: 'rejected' })]), yollanma)
    expect(result).toEqual({ action: 'reopen', rowId: 'p1', oldPermitPath: '2026/old.pdf' })
  })

  it('own row still pending → conflict (already under review)', async () => {
    const result = await classifyPermitResubmission(fakeSupabase([row({ id: 'p1', status: 'pending' })]), yollanma)
    expect(result.action).toBe('conflict')
    expect((result as { message: string }).message).toContain("ko'rib chiqilmoqda")
  })

  it('own row already approved → conflict (points to status check)', async () => {
    const result = await classifyPermitResubmission(fakeSupabase([row({ id: 'p1', status: 'approved' })]), yollanma)
    expect(result.action).toBe('conflict')
    expect((result as { message: string }).message).toContain('tasdiqlangan')
  })

  it('resubmit with an email that belongs to someone else → conflict, never touch the other row', async () => {
    const rows = [
      row({ id: 'mine', status: 'rejected', email: 'a@x.uz' }),
      row({ id: 'someone-else', status: 'pending', passport_series: 'CD7654321', jshshir: '99999999999999', email: 'b@y.uz' }),
    ]
    const result = await classifyPermitResubmission(fakeSupabase(rows), {
      passport: 'AB1234567', jshshir: '12345678901234', email: 'b@y.uz',
    })
    expect(result).toEqual({ action: 'conflict', message: expect.stringContaining('band') })
  })

  it("email belongs to someone else, my passport is new → conflict (can't take their email)", async () => {
    const rows = [row({ id: 'other', status: 'pending', passport_series: 'ZZ0000000', jshshir: '00000000000000', email: 'a@x.uz' })]
    const result = await classifyPermitResubmission(fakeSupabase(rows), yollanma)
    expect(result.action).toBe('conflict')
  })

  it('imtiyozli (no jshshir): rejected row matched on the ID number → reopen', async () => {
    const rows = [row({ id: 'im1', status: 'rejected', jshshir: null, application_type: 'imtiyozli', passport_series: 'FA99887766' })]
    const result = await classifyPermitResubmission(fakeSupabase(rows), { passport: 'FA99887766', jshshir: null, email: 'a@x.uz' })
    expect(result).toEqual({ action: 'reopen', rowId: 'im1', oldPermitPath: '2026/old.pdf' })
  })
})
