import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireCouncilChair = vi.fn()
vi.mock('@/server/auth/council', () => ({
  requireCouncilChair: (...args: unknown[]) => requireCouncilChair(...args),
}))

const { POST } = await import('./route')

describe('POST /api/kengash/elonlar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stamps a whole-faculty, gender-scoped audience — no floor, unlike a sardor post', async () => {
    const single = vi.fn(async () => ({
      data: { id: 'elon-1', title: 'Yig’ilish', audience: 'council' },
      error: null,
    }))
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    requireCouncilChair.mockResolvedValue({
      caller: { id: 'raisi-1' },
      serviceSupabase: { from: () => ({ insert }) },
      faculty: 'amit',
      gender: 'female',
    })

    const request = new NextRequest('http://localhost/api/kengash/elonlar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Yig’ilish', text: 'Ertaga soat 15:00 da', type: 'Muhim' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      audience: 'council',
      faculty: 'amit',
      target_floor: null,
      target_gender: 'female',
      created_by: 'raisi-1',
    }))
  })

  it('rejects when the dekan has revoked council.announcements', async () => {
    requireCouncilChair.mockResolvedValue({
      error: NextResponse.json({ error: 'Bu bo‘lim uchun dekan ruxsat bermagan', code: 'PERMISSION_REVOKED' }, { status: 403 }),
    })

    const request = new NextRequest('http://localhost/api/kengash/elonlar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Yig’ilish', text: 'Ertaga soat 15:00 da', type: 'Muhim' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
    expect(requireCouncilChair).toHaveBeenCalledWith(expect.anything(), 'council.announcements')
  })
})
