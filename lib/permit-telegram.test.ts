import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: vi.fn() }))
vi.mock('@/lib/telegram', () => ({ sendTelegramChatMessage: vi.fn() }))

const { formatPermitTelegramMessage } = await import('./permit-telegram')

describe('permit Telegram messages', () => {
  it('formats a clear approval response', () => {
    const message = formatPermitTelegramMessage({
      full_name: 'Ali Valiyev',
      status: 'approved',
      reject_reason: null,
      room_number: '204',
      application_type: 'yollanma',
    })

    expect(message).toContain('Arizangiz tasdiqlandi')
    expect(message).toContain('<b>204</b>')
    expect(message).toContain('ro‘yxatdan o‘tishingiz mumkin')
  })

  it('escapes applicant-controlled HTML in rejection messages', () => {
    const message = formatPermitTelegramMessage({
      full_name: '<Ali & Vali>',
      status: 'rejected',
      reject_reason: '<script>x</script> & qayta yuklang',
      room_number: null,
      application_type: 'imtiyozli',
    })

    expect(message).toContain('&lt;Ali &amp; Vali&gt;')
    expect(message).toContain('&lt;script&gt;x&lt;/script&gt; &amp; qayta yuklang')
    expect(message).not.toContain('<script>')
  })
})
