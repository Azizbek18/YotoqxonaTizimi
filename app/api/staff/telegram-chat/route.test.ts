import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  getStaffTelegramChatId: vi.fn(),
  setStaffTelegramChatId: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: mocks.requireActiveStaff }))
vi.mock('@/lib/staff-telegram', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/staff-telegram')>()
  return {
    ...actual,
    getStaffTelegramChatId: mocks.getStaffTelegramChatId,
    setStaffTelegramChatId: mocks.setStaffTelegramChatId,
  }
})

const { GET, PUT } = await import('./route')

function req(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStaff.mockResolvedValue({ user: { id: 'staff1' } })
})

describe('GET /api/staff/telegram-chat', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req('https://example.test/api/staff/telegram-chat'))
    expect(res.status).toBe(401)
  })

  it('403s a role outside tarbiyachi/dekan/admin', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await GET(req('https://example.test/api/staff/telegram-chat'))
    expect(res.status).toBe(403)
  })

  it('500s when the lookup throws unexpectedly', async () => {
    mocks.getStaffTelegramChatId.mockRejectedValue(new Error('db down'))
    const res = await GET(req('https://example.test/api/staff/telegram-chat'))
    expect(res.status).toBe(500)
  })

  it('returns the caller’s own chat id on success', async () => {
    mocks.getStaffTelegramChatId.mockResolvedValue('123456789')
    const res = await GET(req('https://example.test/api/staff/telegram-chat'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ chatId: '123456789' })
    expect(mocks.getStaffTelegramChatId).toHaveBeenCalledWith('staff1')
  })
})

describe('PUT /api/staff/telegram-chat', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await PUT(req('https://example.test/api/staff/telegram-chat', { method: 'PUT', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('400s an invalid chat id', async () => {
    const res = await PUT(req('https://example.test/api/staff/telegram-chat', {
      method: 'PUT', body: JSON.stringify({ chatId: 'not-valid!!' }),
    }))
    expect(res.status).toBe(400)
    expect(mocks.setStaffTelegramChatId).not.toHaveBeenCalled()
  })

  it('clears the chat id when given an empty string', async () => {
    mocks.setStaffTelegramChatId.mockResolvedValue('')
    const res = await PUT(req('https://example.test/api/staff/telegram-chat', {
      method: 'PUT', body: JSON.stringify({ chatId: '' }),
    }))
    expect(res.status).toBe(200)
    expect(mocks.setStaffTelegramChatId).toHaveBeenCalledWith('staff1', '')
  })

  it('500s when the save throws unexpectedly', async () => {
    mocks.setStaffTelegramChatId.mockRejectedValue(new Error('db down'))
    const res = await PUT(req('https://example.test/api/staff/telegram-chat', {
      method: 'PUT', body: JSON.stringify({ chatId: '123456789' }),
    }))
    expect(res.status).toBe(500)
  })

  it('sets a numeric chat id on success', async () => {
    mocks.setStaffTelegramChatId.mockResolvedValue('123456789')
    const res = await PUT(req('https://example.test/api/staff/telegram-chat', {
      method: 'PUT', body: JSON.stringify({ chatId: '123456789' }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ chatId: '123456789' })
  })

  it('sets a @channel-style chat id on success', async () => {
    mocks.setStaffTelegramChatId.mockResolvedValue('@mychannel')
    const res = await PUT(req('https://example.test/api/staff/telegram-chat', {
      method: 'PUT', body: JSON.stringify({ chatId: '@mychannel' }),
    }))
    expect(res.status).toBe(200)
    expect(mocks.setStaffTelegramChatId).toHaveBeenCalledWith('staff1', '@mychannel')
  })
})
