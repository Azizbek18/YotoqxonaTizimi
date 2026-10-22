// Xalqaro bo'lim ko'rinishi uchun sof yordamchilar.

import type { DocStatus, InternationalDoc, InternationalStudentRow } from '../types'

type Pickable = { status: DocStatus; expiresOn: string }

/**
 * Bir talabaning bir turdagi hujjatlari ichidan "joriy"sini tanlaydi:
 * bekor qilinmaganlar ustun, ular ichida muddati eng kech tugaydigani.
 * Hammasi bekor qilingan bo'lsa ham eng yangisi qaytadi (talaba hujjatsiz
 * emas, shunchaki bekor qilingan hujjati bor). Bo'sh ro'yxat → null.
 */
export function pickCurrentDoc<T extends Pickable>(docs: readonly T[]): T | null {
  if (docs.length === 0) return null
  return [...docs].sort((a, b) => {
    const aLive = a.status === 'cancelled' ? 0 : 1
    const bLive = b.status === 'cancelled' ? 0 : 1
    if (aLive !== bLive) return bLive - aLive
    return a.expiresOn < b.expiresOn ? 1 : a.expiresOn > b.expiresOn ? -1 : 0
  })[0]
}

/**
 * `users.country` — erkin matn. O'zbekiston fuqarolari ham uni "O'zbekiston",
 * "Oʻzbekiston", "Qoraqalpogʻiston" kabi turlicha yozib qo'ygan (bazada ~110 ta),
 * ular xalqaro bo'lim uchun xorijiy talaba EMAS. Diakritika, tutuq belgisi va
 * katta-kichik harf farqini olib tashlab, o'zbek / qoraqalpoq yozilishlarini
 * aniqlaymiz. Bo'sh qiymat (mamlakat kiritilmagan) false qaytaradi.
 */
export function isUzbekCountry(country: string | null | undefined): boolean {
  if (!country) return false
  const letters = country
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-zа-яё]/g, '')
  if (!letters) return false
  // o'zbek / uzbek (+ imlo xatolari: "ozbkeiston", "ozbekistkn")
  if (/^(o?z|u)b(e|k)/.test(letters) || /^uzbek/.test(letters)) return true
  // Qoraqalpog'iston / Qaraqalpaqstan / Каракалпакстан ("Рес" prefiksi bilan ham)
  if (/(qora|qara|kara|каракалп|қорақалп)/.test(letters) && /(qalp|qolp|калп)/.test(letters)) return true
  return false
}

/** Hujjat holati: kiritilmagan (yoki bekor qilingan) / muddati o'tgan / 30 kun ichida / amalda. */
export type DocHealth = 'missing' | 'expired' | 'soon' | 'ok'

export const SOON_DAYS = 30

export function docHealth(doc: InternationalDoc | null): DocHealth {
  if (!doc || doc.status === 'cancelled') return 'missing'
  if (doc.daysLeft < 0) return 'expired'
  if (doc.daysLeft <= SOON_DAYS) return 'soon'
  return 'ok'
}

export type IssueFilter =
  | ''
  | 'any'
  /** Viza yoki propiskasidan biri muddati o'tgan talabalar. */
  | 'expired'
  /** Hujjati 30 kun ichida tugaydigan (va muddati o'tmagan) talabalar. */
  | 'soon'
  | 'visa-expired'
  | 'visa-soon'
  | 'visa-missing'
  | 'reg-expired'
  | 'reg-soon'
  | 'reg-missing'

export function matchesIssue(row: InternationalStudentRow, filter: IssueFilter): boolean {
  const visa = docHealth(row.visa)
  const reg = docHealth(row.registration)
  switch (filter) {
    case '':
      return true
    case 'any':
      return visa !== 'ok' || reg !== 'ok'
    case 'expired':
      return visa === 'expired' || reg === 'expired'
    case 'soon':
      return visa !== 'expired' && reg !== 'expired' && (visa === 'soon' || reg === 'soon')
    case 'visa-expired':
      return visa === 'expired'
    case 'visa-soon':
      return visa === 'soon'
    case 'visa-missing':
      return visa === 'missing'
    case 'reg-expired':
      return reg === 'expired'
    case 'reg-soon':
      return reg === 'soon'
    case 'reg-missing':
      return reg === 'missing'
  }
}

export type OverviewSummary = {
  total: number
  anyIssue: number
  visa: Record<Exclude<DocHealth, 'ok'>, number>
  registration: Record<Exclude<DocHealth, 'ok'>, number>
}

export function summarize(rows: readonly InternationalStudentRow[]): OverviewSummary {
  const summary: OverviewSummary = {
    total: rows.length,
    anyIssue: 0,
    visa: { missing: 0, expired: 0, soon: 0 },
    registration: { missing: 0, expired: 0, soon: 0 },
  }
  for (const row of rows) {
    const visa = docHealth(row.visa)
    const reg = docHealth(row.registration)
    if (visa !== 'ok') summary.visa[visa] += 1
    if (reg !== 'ok') summary.registration[reg] += 1
    if (visa !== 'ok' || reg !== 'ok') summary.anyIssue += 1
  }
  return summary
}

// [naqsh, nom, ISO-2 kod]
const COUNTRY_RULES: Array<[RegExp, string, string]> = [
  [/^turk(ey|iy|iya|iye)$/, 'Turkiya', 'TR'],
  // turkmaniston / turkmenistan / turmaniston / tukmaniston / turkaniston ...
  // ("tu" + r/k/t sharti "Tunisia" kabi boshqa davlatlarni ushlamasligi uchun)
  [/^tu[rkt][a-z]*(m[aei]n|nan|nis)/, 'Turkmaniston', 'TM'],
  [/^az.{0,2}rb/, 'Ozarbayjon', 'AZ'],
  [/^(yapon|japan)/, 'Yaponiya', 'JP'],
  [/^(xitoy|kitay|china)/, 'Xitoy', 'CN'],
  [/^(toj|taj)/, 'Tojikiston', 'TJ'],
  [/^(qirg|kyrgyz|kirgiz)/, 'Qirgʻiziston', 'KG'],
  [/^(qozoq|qazaq|kazakh)/, 'Qozogʻiston', 'KZ'],
  [/^(rossiy|russia)/, 'Rossiya', 'RU'],
  [/^afg/, 'Afgʻoniston', 'AF'],
  [/^(hind|india)/, 'Hindiston', 'IN'],
  [/^(pakis|pokis)/, 'Pokiston', 'PK'],
  [/^(janubiykore|southkore|koreya)/, 'Koreya', 'KR'],
]

function countryLetters(country: string): string {
  return country
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-zа-яё]/g, '')
}

/**
 * `users.country` erkin matn: bir davlat "Turkmaniston", "TURKMENISTAN",
 * "Türkmenistan", "Turmaniston" kabi o'nlab yozilishda uchraydi, "Japan" va
 * "Yaponiya" ham alohida. Filtr va qidiruv bitta nomni ko'rsatishi uchun ma'lum
 * davlatlarni yagona nomga keltiramiz; noma'lumi bo'sh joylari tozalangan,
 * bosh harfli holda qoladi. Bo'sh qiymat null qaytaradi.
 */
export function canonicalCountry(country: string | null | undefined): string | null {
  if (!country) return null
  const cleaned = country.replace(/^\s*masalan\s*:\s*/i, '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return null
  const letters = countryLetters(cleaned)
  for (const [pattern, name] of COUNTRY_RULES) if (pattern.test(letters)) return name
  const lower = cleaned.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/**
 * Davlat nomi uchun ISO-2 kod (belgi sifatida ko'rsatiladi). Emoji bayroq
 * Windows'da harflar bo'lib ko'rinadi, shuning uchun kod bilan ishlaymiz.
 * Noma'lum davlat uchun null.
 */
export function countryCode(country: string | null | undefined): string | null {
  const name = canonicalCountry(country)
  if (!name) return null
  return COUNTRY_RULES.find(([, ruleName]) => ruleName === name)?.[2] ?? null
}
