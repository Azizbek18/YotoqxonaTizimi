import { describe, expect, it } from 'vitest'
import { resolveDocsMode } from './eligibility'

describe('resolveDocsMode', () => {
  it('is "foreign" for any foreign-citizen student, regardless of region', () => {
    expect(resolveDocsMode({ country: 'Turkmaniston', region: null }, [])).toBe('foreign')
    expect(resolveDocsMode({ country: 'Turkmaniston', region: 'Toshkent shahri' }, ['Toshkent shahri'])).toBe('foreign')
  })

  it('is null for a domestic student when no home region is configured yet', () => {
    expect(resolveDocsMode({ country: null, region: 'Andijon viloyati' }, [])).toBeNull()
  })

  it('is null for a domestic student whose region is in the home list', () => {
    expect(
      resolveDocsMode({ country: null, region: 'Toshkent shahri' }, ['Toshkent shahri', 'Toshkent viloyati']),
    ).toBeNull()
  })

  it('is "registration" for a domestic student outside the home region(s)', () => {
    expect(
      resolveDocsMode({ country: null, region: 'Andijon viloyati' }, ['Toshkent shahri', 'Toshkent viloyati']),
    ).toBe('registration')
  })

  it('matches case- and whitespace-insensitively', () => {
    expect(resolveDocsMode({ country: null, region: '  toshkent SHAHRI  ' }, ['Toshkent shahri'])).toBeNull()
  })

  it('is null for a domestic student with no region on file', () => {
    expect(resolveDocsMode({ country: null, region: null }, ['Toshkent shahri'])).toBeNull()
  })
})
