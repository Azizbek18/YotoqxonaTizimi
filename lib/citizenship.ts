// `users.country` is free text that only the imtiyozli (xorijiy/imtiyozli)
// flow fills in, and O'zbekiston citizens routinely type it too, in a dozen
// spellings ("Oʻzbekiston", "Uzbekistan", "Ozbkeiston", "Qoraqalpogʻiston"…).
// So "has a country" does NOT mean foreign — only a country that isn't
// Uzbekistan (or Qoraqalpogʻiston, its autonomous republic) does. Empty means
// an ordinary yo'llanma student, i.e. a citizen.
const UZBEKISTAN_COUNTRY = /(z.?b[eck]|uzb|kalp|kolp|qalp|qolp|каракалп)/i

export type Citizenship = 'foreign' | 'uzbek'

export function isForeignCountry(country: string | null | undefined): boolean {
  const value = (country ?? '').trim()
  if (!value) return false
  return !UZBEKISTAN_COUNTRY.test(value)
}

export function citizenshipOf(country: string | null | undefined): Citizenship {
  return isForeignCountry(country) ? 'foreign' : 'uzbek'
}
