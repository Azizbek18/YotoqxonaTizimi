import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const bindPermitTelegramChat = vi.fn()
const formatPermitTelegramMessage = vi.fn(() => '<b>Holat</b>')
const sendTelegramChatMessage = vi.fn(async () => true)
const eq = vi.fn(async () => ({ error: null }))
const update = vi.fn(() => ({ eq }))
vi.mock('@/lib/permit-telegram', () => ({ bindPermitTelegramChat, formatPermitTelegramMessage }))
vi.mock('@/lib/telegram', () => ({ sendTelegramChatMessage }))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({ from: () => ({ update }) }),
}))

const { POST } = await import('./route')
const originalSecret = process.env.TELEGRAM_WEBHOOK_SECRET

function request(body: unknown, secret = 'test_secret_12345678901234567890') {
  return new Request('https://example.uz/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-api-secret-token': secret,
    },
    body: JSON.stringify(body),
  })
}

describe('Telegram webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test_secret_12345678901234567890'
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.uz'
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET
    else process.env.TELEGRAM_WEBHOOK_SECRET = originalSecret
  })

  it('rejects a request without the Telegram webhook secret', async () => {
    const response = await POST(request({}, 'wrong'))
    expect(response.status).toBe(401)
    expect(bindPermitTelegramChat).not.toHaveBeenCalled()
  })

  it('binds a private chat from a deep-link start token and replies with the current status', async () => {
    bindPermitTelegramChat.mockResolvedValue({ id: 'permit-1', status: 'pending', full_name: 'Ali' })
    const token = 'abcdefghijklmnopqrstuvwxyz_1234567890'

    const response = await POST(request({
      message: { text: `/start ${token}`, chat: { id: 123456, type: 'private' } },
    }))

    expect(response.status).toBe(200)
    expect(bindPermitTelegramChat).toHaveBeenCalledWith(token, 123456)
    expect(sendTelegramChatMessage).toHaveBeenCalledWith('123456', '<b>Holat</b>', expect.any(Object))
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ last_notified_status: 'pending' }))
  })

  it('does not bind a group chat', async () => {
    const response = await POST(request({
      message: { text: '/start abcdefghijklmnopqrstuv', chat: { id: -1001, type: 'supergroup' } },
    }))
    expect(response.status).toBe(200)
    expect(bindPermitTelegramChat).not.toHaveBeenCalled()
  })
})
