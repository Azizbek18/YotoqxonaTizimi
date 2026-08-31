import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: vi.fn() }))
vi.mock('@/lib/telegram', () => ({ sendTelegramChatMessage: vi.fn() }))

const { normalizeDekanChatId, formatNewPermitTelegramMessage } = await import('./dekan-telegram')

describe('normalizeDekanChatId', () => {
  it('accepts a negative supergroup id', () => {
    expect(normalizeDekanChatId(' -1001234567890 ')).toBe('-1001234567890')
  })

  it('accepts an @channel handle', () => {
    expect(normalizeDekanChatId('@dekan_arizalar')).toBe('@dekan_arizalar')
  })

  it('rejects free text, urls and t.me links', () => {
    expect(normalizeDekanChatId('https://t.me/joinchat/abc')).toBe('')
    expect(normalizeDekanChatId('mening guruhim')).toBe('')
    expect(normalizeDekanChatId('')).toBe('')
    expect(normalizeDekanChatId(null)).toBe('')
  })
})

describe('formatNewPermitTelegramMessage', () => {
  it('summarises a new yo‘llanma with the faculty label', () => {
    const message = formatNewPermitTelegramMessage({
      fullName: 'Ali Valiyev',
      faculty: 'amit',
      direction: 'Amaliy matematika',
      course: 2,
      applicationType: 'yollanma',
    })

    expect(message).toContain('Yangi yo‘llanma')
    expect(message).toContain('<b>Ali Valiyev</b>')
    expect(message).toContain('Amaliy matematika va intellektual texnologiyalar')
    expect(message).toContain('2-kurs')
  })

  it('marks a resubmission and an imtiyozli application', () => {
    const message = formatNewPermitTelegramMessage({
      fullName: 'Vali Aliyev',
      faculty: 'biologiya',
      direction: null,
      course: null,
      applicationType: 'imtiyozli',
      resubmitted: true,
    })

    expect(message).toContain('qayta yuborildi')
    expect(message).toContain('Xorijiy/imtiyozli ariza')
  })

  it('escapes applicant-controlled HTML in the name', () => {
    const message = formatNewPermitTelegramMessage({
      fullName: '<b>x</b> & y',
      faculty: 'amit',
      direction: null,
      course: null,
      applicationType: 'yollanma',
    })

    expect(message).toContain('&lt;b&gt;x&lt;/b&gt; &amp; y')
    expect(message).not.toContain('<b>x</b>')
  })
})
