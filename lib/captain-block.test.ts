import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { effectiveCaptainBlock } = await import('./captain-block')

const db = (kind: string | null) => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: kind ? { layout_kind: kind } : null }) }) }) }),
}) as never

describe('effectiveCaptainBlock', () => {
  it('drops a stale block in a simple dorm', async () => {
    expect(await effectiveCaptainBlock(db('simple'), 'd1', 'A')).toBeNull()
  })
  it('keeps the block in a blocked dorm', async () => {
    expect(await effectiveCaptainBlock(db('blocked'), 'd1', 'B')).toBe('B')
  })
  it('is null without a block or dorm', async () => {
    expect(await effectiveCaptainBlock(db('blocked'), 'd1', null)).toBeNull()
    expect(await effectiveCaptainBlock(db('blocked'), null, 'A')).toBeNull()
  })
})
