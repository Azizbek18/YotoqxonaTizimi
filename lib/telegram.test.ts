import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { sendTelegramAdminMessage, sendTelegramPhoto } = await import('./telegram')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Telegram administrator messages', () => {
  it('never treats the legacy student-bot chat id as an administrator', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'student-bot-token')
    vi.stubEnv('TELEGRAM_CHAT_ID', '6386977575')
    vi.stubEnv('TELEGRAM_ADMIN_CHAT_ID', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendTelegramAdminMessage('internal AI error')).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends only when a dedicated administrator chat is configured', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'student-bot-token')
    vi.stubEnv('TELEGRAM_CHAT_ID', 'student-chat')
    vi.stubEnv('TELEGRAM_ADMIN_CHAT_ID', 'admin-chat')
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendTelegramAdminMessage('internal AI error')).resolves.toBe(true)
    const request = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(request[1].body)).chat_id).toBe('admin-chat')
  })
})

describe('sendTelegramPhoto', () => {
  it('returns false without a bot token and never calls fetch', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendTelegramPhoto('123', 'https://cdn/x.jpg', 'salom')).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts the photo URL + caption to the sendPhoto endpoint', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'bot-token')
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      sendTelegramPhoto('123', 'https://cdn/x.jpg', '<b>hi</b>', { parseMode: 'HTML' }),
    ).resolves.toBe(true)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/sendPhoto')
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({ chat_id: '123', photo: 'https://cdn/x.jpg', caption: '<b>hi</b>', parse_mode: 'HTML' })
  })
})
