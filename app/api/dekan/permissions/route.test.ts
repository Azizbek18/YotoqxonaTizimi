import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  requirePickedFaculty: vi.fn(),
  listMembers: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: mocks.requireActiveStaff }))
vi.mock('@/server/auth/faculty', () => ({ requirePickedFaculty: mocks.requirePickedFaculty }))
vi.mock('@/features/permissions/server/service', () => ({
  createPermissionsService: () => ({ listMembers: mocks.listMembers, update: mocks.update }),
}))

const { GET, PATCH } = await import('./route')

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requirePickedFaculty.mockImplementation((staff: { faculty: string }) => staff.faculty)
})

it('GET only opens the roster to dekan/admin, matching the MANAGERS list passed to requireActiveStaff', async () => {
  mocks.requireActiveStaff.mockResolvedValue({ staff: { faculty: 'amit' } })
  mocks.listMembers.mockResolvedValue([{ id: '1', subject: 'tarbiyachi', fullName: 'X', detail: '', permissions: {} }])

  const response = await GET(new NextRequest('http://localhost/api/dekan/permissions'))

  expect(mocks.requireActiveStaff).toHaveBeenCalledWith(expect.anything(), ['dekan', 'admin'])
  expect(mocks.listMembers).toHaveBeenCalledWith('amit')
  expect(response.status).toBe(200)
  expect((await response.json()).members).toHaveLength(1)
})

it('GET propagates the guard rejecting a non-manager caller', async () => {
  mocks.requireActiveStaff.mockRejectedValue(new ApiError(403, 'Ruxsat yo‘q'))
  const response = await GET(new NextRequest('http://localhost/api/dekan/permissions'))
  expect(response.status).toBe(403)
  expect(mocks.listMembers).not.toHaveBeenCalled()
})

it('PATCH scopes the update to the caller faculty and returns the service result', async () => {
  mocks.requireActiveStaff.mockResolvedValue({ staff: { faculty: 'amit' } })
  mocks.update.mockResolvedValue({ ok: true, permissions: { 'payments.review': false } })

  const request = new NextRequest('http://localhost/api/dekan/permissions', {
    method: 'PATCH',
    body: JSON.stringify({ memberId: 't-1', subject: 'tarbiyachi', permissions: { 'payments.review': false } }),
  })
  const response = await PATCH(request)

  expect(mocks.update).toHaveBeenCalledWith('amit', { memberId: 't-1', subject: 'tarbiyachi', permissions: { 'payments.review': false } })
  expect(await response.json()).toEqual({ ok: true, permissions: { 'payments.review': false } })
})

it('PATCH surfaces a service ApiError (e.g. cross-faculty target) with its status', async () => {
  mocks.requireActiveStaff.mockResolvedValue({ staff: { faculty: 'amit' } })
  mocks.update.mockRejectedValue(new ApiError(403, 'Boshqa fakultet xodimini boshqarib bo‘lmaydi'))

  const request = new NextRequest('http://localhost/api/dekan/permissions', { method: 'PATCH', body: '{}' })
  const response = await PATCH(request)

  expect(response.status).toBe(403)
})
