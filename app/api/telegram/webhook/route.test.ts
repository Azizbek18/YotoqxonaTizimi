import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const bindPermitTelegramChat = vi.fn()
const formatPermitTelegramMessage = vi.fn(() => '<b>Holat</b>')
const sendTelegramChatMessage = vi.fn(async () => true)
const sendPermitTelegramLinkedEmail = vi.fn(async () => undefined)
const deliverPermitDocumentsSafely = vi.fn(async () => undefined)
const eq = vi.fn(async () => ({ error: null }))
const update = vi.fn(() => ({ eq }))
vi.mock('@/lib/permit-telegram', () => ({ bindPermitTelegramChat, formatPermitTelegramMessage }))
vi.mock('@/lib/telegram', () => ({ sendTelegramChatMessage }))
vi.mock('@/lib/email', () => ({ sendPermitTelegramLinkedEmail }))
vi.mock('@/lib/permit-documents', () => ({ deliverPermitDocumentsSafely }))
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

  it('emails the on-file inbox when a chat claims an APPROVED permit (a stranger could not do it silently)', async () => {
    bindPermitTelegramChat.mockResolvedValue({ id: 'permit-2', status: 'approved', full_name: 'Vali', email: 'vali@example.com' })
    const token = 'abcdefghijklmnopqrstuvwxyz_1234567890'

    const response = await POST(request({
      message: { text: `/start ${token}`, chat: { id: 777, type: 'private' } },
    }))

    expect(response.status).toBe(200)
    expect(deliverPermitDocumentsSafely).toHaveBeenCalledWith('permit-2')
    expect(sendPermitTelegramLinkedEmail).toHaveBeenCalledWith('vali@example.com', 'Vali')
  })

  it('does not email anyone when the claimed permit is not approved yet', async () => {
    bindPermitTelegramChat.mockResolvedValue({ id: 'permit-3', status: 'pending', full_name: 'Ali', email: 'ali@example.com' })
    const token = 'abcdefghijklmnopqrstuvwxyz_1234567890'
    await POST(request({ message: { text: `/start ${token}`, chat: { id: 778, type: 'private' } } }))
    expect(sendPermitTelegramLinkedEmail).not.toHaveBeenCalled()
  })

  it('does not subscribe a plain /start chat to any student notifications', async () => {
    const response = await POST(request({
      message: { text: '/start', chat: { id: 6386977575, type: 'private' } },
    }))

    expect(response.status).toBe(200)
    expect(bindPermitTelegramChat).not.toHaveBeenCalled()
    expect(sendTelegramChatMessage).toHaveBeenCalledTimes(1)
    const plainStartCall = sendTelegramChatMessage.mock.calls[0] as unknown as [string, string]
    expect(plainStartCall[1]).toMatch(/Arizangiz yuborilgandan keyin/i)
    expect(plainStartCall[1]).not.toMatch(/Groq|API error|rate limit/i)
  })

  it('does not bind a group chat', async () => {
    const response = await POST(request({
      message: { text: '/start abcdefghijklmnopqrstuv', chat: { id: -1001, type: 'supergroup' } },
    }))
    expect(response.status).toBe(200)
    expect(bindPermitTelegramChat).not.toHaveBeenCalled()
  })
})
