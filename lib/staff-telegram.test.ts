import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: () => ({}) }))
vi.mock('@/lib/telegram', () => ({ sendTelegramChatMessage: vi.fn() }))

import { normalizeStaffChatId } from './staff-telegram'

describe('normalizeStaffChatId', () => {
  it('accepts a positive personal chat id', () => {
    expect(normalizeStaffChatId('123456789')).toBe('123456789')
  })

  it('accepts a negative group id and a @handle', () => {
    expect(normalizeStaffChatId('-1001234567890')).toBe('-1001234567890')
    expect(normalizeStaffChatId('@dorm_alerts')).toBe('@dorm_alerts')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeStaffChatId('  777  ')).toBe('777')
  })

  it('returns "" for anything the DB CHECK would reject', () => {
    expect(normalizeStaffChatId('not a chat')).toBe('')
    expect(normalizeStaffChatId('@x')).toBe('') // handle too short
    expect(normalizeStaffChatId('')).toBe('')
    expect(normalizeStaffChatId(null)).toBe('')
    expect(normalizeStaffChatId(undefined)).toBe('')
  })
})
