import { describe, expect, it } from 'vitest'

process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test'
const { parseUserAgent } = await import('./auth-devices')

describe('parseUserAgent', () => {
  it('Windows Chrome', () => {
    const r = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36')
    expect(r).toMatchObject({ browser: 'Chrome', os: 'Windows', device: 'Windows kompyuter' })
  })
  it('Android Chrome phone', () => {
    const r = parseUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')
    expect(r).toMatchObject({ browser: 'Chrome', os: 'Android', device: 'Android telefon' })
  })
  it('iPhone Safari', () => {
    const r = parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1 Version/17.0 Mobile/15E148 Safari/604.1')
    expect(r).toMatchObject({ browser: 'Safari', os: 'iOS', device: 'iPhone' })
  })
  it('Edge is not misread as Chrome', () => {
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537 Edg/130').browser).toBe('Edge')
  })
  it('empty / null', () => {
    expect(parseUserAgent('').device).toBe('Noma‘lum qurilma')
    expect(parseUserAgent(null).browser).toBe('—')
  })
})
