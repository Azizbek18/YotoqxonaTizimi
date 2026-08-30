import { describe, expect, it } from 'vitest'
import { cyrillicToLatin, hasCyrillicLetters } from './transliterate'

describe('cyrillicToLatin', () => {
  it('leaves a Latin string untouched', () => {
    expect(cyrillicToLatin('Aliyev Vali Anvarovich')).toBe('Aliyev Vali Anvarovich')
    expect(cyrillicToLatin("Sa'dulla Moʻminov")).toBe("Sa'dulla Moʻminov")
  })

  it('uses Uzbek rules when Uzbek-only letters are present', () => {
    expect(cyrillicToLatin('Ўразбоев')).toBe('Oʻrazboev')
    expect(cyrillicToLatin('Ғафуров Хусан')).toBe('Gʻafurov Xusan')
    expect(cyrillicToLatin('Жамол Қодиров')).toBe('Jamol Qodirov')
  })

  it('uses Russian/ICAO rules for a pure Russian name', () => {
    expect(cyrillicToLatin('Иванов Пётр')).toBe('Ivanov Petr')
    expect(cyrillicToLatin('Жуков Михаил')).toBe('Zhukov Mikhail')
    expect(cyrillicToLatin('Щербакова')).toBe('Shcherbakova')
  })

  it('preserves capitalisation of the first converted letter only', () => {
    expect(cyrillicToLatin('ШАРИФ')).toBe('ShARIF')
    expect(cyrillicToLatin('Шариф')).toBe('Sharif')
    expect(cyrillicToLatin('шариф')).toBe('sharif')
  })

  it('keeps spaces, hyphens and Latin letters that are mixed in', () => {
    expect(cyrillicToLatin('Амир-Темур')).toBe('Amir-Temur')
    expect(cyrillicToLatin('Aliyev Пётр')).toBe('Aliyev Petr')
  })

  it('hasCyrillicLetters detects any Cyrillic', () => {
    expect(hasCyrillicLetters('Aliyev')).toBe(false)
    expect(hasCyrillicLetters('Aliyev П')).toBe(true)
    expect(hasCyrillicLetters('')).toBe(false)
  })
})
