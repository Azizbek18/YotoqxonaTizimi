import { describe, expect, it } from 'vitest'
import { getSafePushEndpoint } from './push-endpoint'

describe('browser push endpoint allowlist', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/token',
    'https://updates.push.services.mozilla.com/wpush/v2/token',
    'https://web.push.apple.com/token',
    'https://wns2-db5p.notify.windows.com/w/?token=opaque%2Btoken',
  ])('accepts provider endpoints without changing opaque tokens: %s', (endpoint) => {
    expect(getSafePushEndpoint(endpoint)).toBe(endpoint)
  })

  it.each([
    'https://127.0.0.1/private', 'https://[::1]/private', 'https://169.254.169.254/metadata',
    'https://2130706433/private', 'https://localhost/private', 'https://internal.example.com/',
    'http://fcm.googleapis.com/token', 'https://fcm.googleapis.com:8443/token',
    'https://fcm.googleapis.com.evil.example/token', 'https://evilpush.apple.com/token',
    'https://push.apple.com.evil.example/token', 'https://evilnotify.windows.com/token',
    'https://fcm.googleapis.com@127.0.0.1/token', 'https://user:pass@fcm.googleapis.com/token',
    'https://fcm.googleapis.com\\@127.0.0.1/token', 'https://fcm.googleapis.com/token#fragment',
    'https://fcm.googleapis.com\n.evil.example/token', 'https://fcm.googleapis.com./token',
    'file:///etc/passwd', 'not-a-url', '', null, {},
  ])('rejects unsafe or misleading URLs: %s', (endpoint) => {
    expect(getSafePushEndpoint(endpoint)).toBeNull()
  })

  it('rejects oversized endpoints', () => {
    expect(getSafePushEndpoint(`https://fcm.googleapis.com/${'x'.repeat(4096)}`)).toBeNull()
  })

  it('returns a canonical URL for the HTTP client', () => {
    expect(getSafePushEndpoint('https://FCM.GOOGLEAPIS.COM:443/token'))
      .toBe('https://fcm.googleapis.com/token')
  })
})
