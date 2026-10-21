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
