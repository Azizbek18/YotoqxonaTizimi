import { describe, expect, it, vi } from 'vitest'
import { fetchAllSupabaseRows } from './server-supabase-pagination'

describe('fetchAllSupabaseRows', () => {
  it('continues until the first short page', async () => {
    const load = vi.fn(async (from: number, to: number) => ({
      data: from === 0 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }],
      error: null,
      range: [from, to],
    }))

    await expect(fetchAllSupabaseRows(load, 2)).resolves.toEqual([
      { id: 1 }, { id: 2 }, { id: 3 },
    ])
    expect(load).toHaveBeenNthCalledWith(1, 0, 1)
    expect(load).toHaveBeenNthCalledWith(2, 2, 3)
  })

  it('propagates a page error without returning a partial report', async () => {
    const failure = new Error('page failed')
    await expect(fetchAllSupabaseRows(async () => ({ data: null, error: failure })))
      .rejects.toBe(failure)
  })
})
