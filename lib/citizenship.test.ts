import { describe, expect, it } from 'vitest'
import { citizenshipOf, isForeignCountry } from './citizenship'

describe('citizenshipOf', () => {
  it('treats empty country as an Uzbek citizen', () => {
    expect(citizenshipOf(null)).toBe('uzbek')
    expect(citizenshipOf('  ')).toBe('uzbek')
  })

  it.each([
    "O'zbekiston", 'Oʻzbekiston', 'O’zbekiston', 'Uzbekistan', 'Ozbkeiston',
    'OʻZBEKISTON', 'Qoraqalpogʻiston Respublikasi', 'Рес Каракалпакстан',
  ])('treats %s as Uzbek', (country) => {
    expect(isForeignCountry(country)).toBe(false)
  })

  it.each(['Turkmaniston', 'Türkmenistan', 'TURKMENISTAN', 'Tutkmenistan', 'Azerbaijan', 'Japan'])(
    'treats %s as foreign', (country) => {
      expect(citizenshipOf(country)).toBe('foreign')
    })
})
