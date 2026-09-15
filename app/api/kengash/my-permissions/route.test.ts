import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'

const requireCouncilChair = vi.fn()
vi.mock('@/server/auth/council', () => ({
  requireCouncilChair: (...args: unknown[]) => requireCouncilChair(...args),
}))

const { GET } = await import('./route')

beforeEach(() => { vi.resetAllMocks() })

it('returns the raisi’s own revoked permissions, keyed only to what a raisi owns', async () => {
  requireCouncilChair.mockResolvedValue({
    caller: { council_chair_permissions: { 'council.announcements': false, 'payments.review': false } },
  })
  const response = await GET(new NextRequest('http://localhost/api/kengash/my-permissions'))
  expect(await response.json()).toEqual({ permissions: { 'council.announcements': false } })
})

it('is unfiltered by permission (a raisi must always see their own rights) and passes through the auth guard’s error', async () => {
  requireCouncilChair.mockResolvedValue({
    error: NextResponse.json({ error: 'Siz talaba kengashi raisi emassiz' }, { status: 403 }),
  })
  const response = await GET(new NextRequest('http://localhost/api/kengash/my-permissions'))
  expect(response.status).toBe(403)
  expect(requireCouncilChair).toHaveBeenCalledWith(expect.anything())
})
