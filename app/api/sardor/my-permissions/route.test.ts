import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'

const requireFloorCaptain = vi.fn()
vi.mock('@/server/auth/sardor', () => ({
  requireFloorCaptain: (...args: unknown[]) => requireFloorCaptain(...args),
}))

const { GET } = await import('./route')

beforeEach(() => { vi.resetAllMocks() })

it('returns the captain’s own revoked permissions, keyed only to what a sardor owns', async () => {
  requireFloorCaptain.mockResolvedValue({
    caller: { captain_permissions: { 'attendance.mark': false, 'payments.review': false } },
  })
  const response = await GET(new NextRequest('http://localhost/api/sardor/my-permissions'))
  expect(await response.json()).toEqual({ permissions: { 'attendance.mark': false } })
})

it('is unfiltered by permission (a captain must always see their own rights) and passes through the auth guard’s error', async () => {
  requireFloorCaptain.mockResolvedValue({
    error: NextResponse.json({ error: 'Siz qavat sardori emassiz' }, { status: 403 }),
  })
  const response = await GET(new NextRequest('http://localhost/api/sardor/my-permissions'))
  expect(response.status).toBe(403)
  expect(requireFloorCaptain).toHaveBeenCalledWith(expect.anything())
})
