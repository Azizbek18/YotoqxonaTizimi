import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { sendTelegramAdminMessage } = await import('./telegram')

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
