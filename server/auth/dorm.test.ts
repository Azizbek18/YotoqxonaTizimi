import { describe, expect, it, vi } from 'vitest'
import { requireDormFilter } from './dorm'

describe('building filter authorization', () => {
  const repository = { facultyDormIds: vi.fn(async () => ['d12', 'd3']) }
  it('accepts either of the faculty’s buildings', async () => {
    expect(await requireDormFilter('amit', 'd12', repository)).toBe('d12')
    expect(await requireDormFilter('amit', 'd3', repository)).toBe('d3')
  })
  it('rejects a different building and empty filter instead of widening scope', async () => {
    await expect(requireDormFilter('amit', 'foreign', repository)).rejects.toMatchObject({ status: 403 })
    await expect(requireDormFilter('amit', '', repository)).rejects.toMatchObject({ status: 403 })
  })
  it('distinguishes an unassigned view from a legacy unfiltered request', async () => {
    expect(await requireDormFilter('amit', 'unassigned', repository)).toBeNull()
    expect(await requireDormFilter('amit', null, repository)).toBeUndefined()
    await expect(requireDormFilter(null, 'd12', repository)).rejects.toMatchObject({ status: 403 })
  })
})
