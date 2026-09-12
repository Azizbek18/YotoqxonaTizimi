import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const requireActiveStaff = vi.fn()
vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: (...a: unknown[]) => requireActiveStaff(...a) }))

const { GET } = await import('./route')

beforeEach(() => { vi.resetAllMocks() })

it('returns a tarbiyachi’s own revoked permissions, keyed only to what that role owns', async () => {
  requireActiveStaff.mockResolvedValue({
    staff: { role: 'tarbiyachi', permissions: { 'payments.review': false, 'not.a.real.key': false } },
  })
  const response = await GET(new NextRequest('http://localhost/api/staff/my-permissions'))
  const body = await response.json()
  expect(body).toEqual({ role: 'tarbiyachi', permissions: { 'payments.review': false } })
})

it('always answers full access for a dekan/admin — they hand rights out, they don’t carry them', async () => {
  requireActiveStaff.mockResolvedValue({ staff: { role: 'dekan', permissions: { 'payments.review': false } } })
  const response = await GET(new NextRequest('http://localhost/api/staff/my-permissions'))
  expect(await response.json()).toEqual({ role: 'dekan', permissions: {} })
})

it('propagates the guard rejecting an unauthenticated caller', async () => {
  requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi'))
  const response = await GET(new NextRequest('http://localhost/api/staff/my-permissions'))
  expect(response.status).toBe(401)
})
