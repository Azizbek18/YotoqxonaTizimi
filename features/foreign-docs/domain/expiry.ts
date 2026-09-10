// Sof sana mantig'i — barchasi Asia/Tashkent bo'yicha. Server (cron, dekan
// dashboard) ham, client (talaba kartasi) ham shu helperlarga tayanadi,
// shunda "necha kun qoldi" hamma joyda bir xil chiqadi.

import { MILESTONES, POST_EXPIRY_GRACE_DAYS, type ExpiryBucket } from '../types'

const TASHKENT_OFFSET_MINUTES = 5 * 60 // UTC+5, yil bo'yi o'zgarmaydi

/** Bugungi sana Toshkent vaqti bo'yicha — 'YYYY-MM-DD'. */
export function tashkentToday(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + TASHKENT_OFFSET_MINUTES * 60_000)
  return shifted.toISOString().slice(0, 10)
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`)
  const to = Date.parse(`${toIso}T00:00:00Z`)
  return Math.round((to - from) / 86_400_000)
}

/**
 * Muddatga necha kun qolgan. Bugun tugasa 0, kecha tugagan bo'lsa -1.
 * `today` berilmasa Toshkent buguni olinadi.
 */
export function daysLeft(expiresOn: string, today: string = tashkentToday()): number {
  return daysBetween(today, expiresOn)
}

/** Skrinshotdagi guruh kartalari: <0 / 1-3 / 4-10 / 11-30 / 30+. */
export function bucketOf(days: number): ExpiryBucket {
  if (days < 0) return 'expired'
  if (days <= 3) return 'critical'
  if (days <= 10) return 'warning'
  if (days <= 30) return 'soon'
  return 'ok'
}

/**
 * Dekan filtridagi "aniq bosqich" tanlovi. Har bosqich oldingisidan keyingi
 * oralg'ini egallaydi, shunda bir hujjat bir vaqtda faqat bitta bosqichга
 * tushadi.
 *   '30' → (15, 30]   '15' → (10, 15]   '10' → (5, 10]
 *   '5'  → (3, 5]      '3'  → (0, 3]     '0'  → aynan 0
 *   'expired' → < 0
 */
export type MilestoneFilter = '30' | '15' | '10' | '5' | '3' | '0' | 'expired'

export function matchesMilestoneFilter(days: number, filter: MilestoneFilter): boolean {
  switch (filter) {
    case 'expired':
      return days < 0
    case '0':
      return days === 0
    case '3':
      return days > 0 && days <= 3
    case '5':
      return days > 3 && days <= 5
    case '10':
      return days > 5 && days <= 10
    case '15':
      return days > 10 && days <= 15
    case '30':
      return days > 15 && days <= 30
    default:
      return false
  }
}

/**
 * Kunlik cron uchun: bugun qaysi bosqich(lar) "muddati kelgan" va hali
 * yuborilmagan. Chegara kesib o'tish printsipi — bir kun o'tkazib
 * yuborilsa ham bosqich yo'qolmaydi.
 *
 * @returns `{ send, mark }` — `send` bo'lsa talabaga bitta xabar yuboriladi
 *   (matn haqiqiy `days` bo'yicha), `mark` — jurnalда "yuborilgan" deb
 *   belgilanadigan barcha bosqichlar. `days < 0` bo'lganda muddat o'tgandan
 *   keyingi kun (`-1`, `-2`, …) qaytariladi.
 */
export function dueReminder(
  days: number,
  sentMilestones: ReadonlySet<number>,
): { send: boolean; mark: number[]; postExpiryDay: number | null } {
  if (days < 0) {
    const postDay = -days
    if (postDay > POST_EXPIRY_GRACE_DAYS) return { send: false, mark: [], postExpiryDay: null }
    const milestone = -postDay
    if (sentMilestones.has(milestone)) return { send: false, mark: [], postExpiryDay: null }
    return { send: true, mark: [milestone], postExpiryDay: postDay }
  }

  const dueMilestones = MILESTONES.filter((m) => days <= m)
  const unsent = dueMilestones.filter((m) => !sentMilestones.has(m))
  if (unsent.length === 0) return { send: false, mark: [], postExpiryDay: null }
  return { send: true, mark: unsent, postExpiryDay: null }
}
