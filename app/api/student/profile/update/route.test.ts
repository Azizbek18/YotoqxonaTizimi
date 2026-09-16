import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStudent: mocks.requireActiveStudent }))
vi.mock('@/features/profile/server/service', () => ({
  createProfileService: () => ({ update: mocks.update }),
}))

const { PATCH } = await import('./route')

function req(body?: unknown) {
  return new NextRequest('https://example.test/api/student/profile/update', {
    method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStudent.mockResolvedValue({ student: { id: 's1' } })
})

describe('PATCH /api/student/profile/update', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await PATCH(req({ group: '101-A' }))
    expect(res.status).toBe(401)
  })

  it('403s a blacklisted student (update is not allowBlacklisted)', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(403, 'Siz yotoqxona ro‘yxatidan chiqarilgansiz.', 'BLACKLISTED'))
    const res = await PATCH(req({ group: '101-A' }))
    expect(res.status).toBe(403)
  })

  it('400s an unparsable JSON body', async () => {
    const res = await PATCH(new NextRequest('https://example.test/api/student/profile/update', {
      method: 'PATCH', body: 'not json', headers: { 'content-type': 'application/json' },
    }))
    expect(res.status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('400s a validation failure surfaced by the service', async () => {
    mocks.update.mockRejectedValue(new ApiError(400, 'Guruh nomi noto‘g‘ri'))
    const res = await PATCH(req({ group: '' }))
    expect(res.status).toBe(400)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.update.mockRejectedValue(new Error('db down'))
    const res = await PATCH(req({ group: '101-A' }))
    expect(res.status).toBe(500)
  })

  it('updates the profile on success', async () => {
    mocks.update.mockResolvedValue({ id: 's1', group: '101-A' })
    const res = await PATCH(req({ group: '101-A' }))
    expect(res.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith('s1', { group: '101-A' })
  })
})
