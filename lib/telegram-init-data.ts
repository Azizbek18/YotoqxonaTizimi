import 'server-only'
import { createHmac } from 'crypto'
import { safeEqual } from '@/lib/security'

export type TelegramInitData = { userId: number; authDate: number }

/**
 * Validates a Telegram Mini App `initData` string
 * (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
 *
 * Returns null on ANY problem — bad/missing hash, malformed user, or an
 * `auth_date` older than `maxAgeSeconds` (limits replay of a leaked string).
 * The hash proves Telegram issued the data for that user; it does not by
 * itself prove the user is one of ours — the caller still maps the id to a
 * linked student.
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  { maxAgeSeconds, now = Date.now() }: { maxAgeSeconds: number; now?: number },
): TelegramInitData | null {
  if (!initData || initData.length > 4096 || !botToken) return null

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) return null

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex')
  if (!safeEqual(expected, hash)) return null

  const authDate = Number(params.get('auth_date'))
  if (!Number.isSafeInteger(authDate) || authDate <= 0) return null
  const ageSeconds = Math.floor(now / 1000) - authDate
  // A small negative tolerance covers clock skew; far-future dates are rejected.
  if (ageSeconds > maxAgeSeconds || ageSeconds < -60) return null

  let userId: unknown
  try {
    userId = (JSON.parse(params.get('user') ?? '') as { id?: unknown }).id
  } catch {
    return null
  }
  if (typeof userId !== 'number' || !Number.isSafeInteger(userId) || userId <= 0) return null

  return { userId, authDate }
}
