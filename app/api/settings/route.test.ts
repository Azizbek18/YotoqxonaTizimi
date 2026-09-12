import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({ user: vi.fn(), faculty: vi.fn(), get: vi.fn() }))
vi.mock('@/server/auth/guards', () => ({ requireStaffPermission: () => {}, requireUser: mocks.user }))
vi.mock('@/server/auth/faculty', () => ({ resolveCallerFaculty: mocks.faculty }))
vi.mock('@/features/app-settings/server/service', () => ({ createAppSettingsService: () => ({ get: mocks.get }) }))
import { GET } from './route'

beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: 'student-2' }) })

it('loads settings for the verified caller faculty and prevents shared caching', async () => {
  mocks.faculty.mockResolvedValue('fizika')
  mocks.get.mockResolvedValue({ tarbiyachiName: 'Physics educator' })
  const response = await GET(new NextRequest('http://localhost/api/settings?faculty=amit'))
  expect(mocks.faculty).toHaveBeenCalledWith('student-2')
  expect(mocks.get).toHaveBeenCalledWith('fizika')
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(await response.json()).toEqual({ tarbiyachiName: 'Physics educator' })
})

it('does not read AMIT settings when the caller has no faculty', async () => {
  mocks.faculty.mockRejectedValue(new ApiError(403, 'Fakultet biriktirilmagan'))
  expect((await GET(new NextRequest('http://localhost/api/settings'))).status).toBe(403)
  expect(mocks.get).not.toHaveBeenCalled()
})
