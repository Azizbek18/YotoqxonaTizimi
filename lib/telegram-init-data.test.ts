import { createHmac } from 'crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { verifyTelegramInitData } = await import('./telegram-init-data')

const BOT_TOKEN = '123456:TEST-bot-token'
const NOW = 1_800_000_000_000

function sign(fields: Record<string, string>, token = BOT_TOKEN) {
  const check = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  const hash = createHmac('sha256', secret).update(check).digest('hex')
  return new URLSearchParams({ ...fields, hash }).toString()
}

const fresh = (extra: Record<string, string> = {}) => ({
  auth_date: String(Math.floor(NOW / 1000) - 30),
  query_id: 'AAH',
  user: JSON.stringify({ id: 5129767933, first_name: 'Ali' }),
  ...extra,
})

describe('verifyTelegramInitData', () => {
  it('accepts correctly signed, fresh data and returns the Telegram user id', () => {
    expect(verifyTelegramInitData(sign(fresh()), BOT_TOKEN, { maxAgeSeconds: 3600, now: NOW }))
      .toEqual({ userId: 5129767933, authDate: Math.floor(NOW / 1000) - 30 })
  })

  it('rejects data signed with another bot token', () => {
    expect(verifyTelegramInitData(sign(fresh(), 'other:token'), BOT_TOKEN, { maxAgeSeconds: 3600, now: NOW })).toBeNull()
  })

  it('rejects tampered fields (swapped user id)', () => {
    const tampered = sign(fresh()).replace(encodeURIComponent('5129767933'), encodeURIComponent('1'))
    expect(verifyTelegramInitData(tampered, BOT_TOKEN, { maxAgeSeconds: 3600, now: NOW })).toBeNull()
  })

  it('rejects expired data', () => {
    const old = sign(fresh({ auth_date: String(Math.floor(NOW / 1000) - 7200) }))
    expect(verifyTelegramInitData(old, BOT_TOKEN, { maxAgeSeconds: 3600, now: NOW })).toBeNull()
  })

  it('rejects far-future auth_date', () => {
    const future = sign(fresh({ auth_date: String(Math.floor(NOW / 1000) + 3600) }))
    expect(verifyTelegramInitData(future, BOT_TOKEN, { maxAgeSeconds: 3600, now: NOW })).toBeNull()
  })

  it('rejects a missing hash, a malformed user and empty input', () => {
    expect(verifyTelegramInitData(new URLSearchParams(fresh()).toString(), BOT_TOKEN, { maxAgeSeconds: 3600, now: NOW })).toBeNull()
    expect(verifyTelegramInitData(sign(fresh({ user: 'not-json' })), BOT_TOKEN, { maxAgeSeconds: 3600, now: NOW })).toBeNull()
    expect(verifyTelegramInitData('', BOT_TOKEN, { maxAgeSeconds: 3600, now: NOW })).toBeNull()
  })
})
