import { describe, expect, it } from 'vitest'
import { pickCurrentDoc } from './international'

const doc = (status: 'active' | 'renewing' | 'cancelled', expiresOn: string) => ({ status, expiresOn })

describe('pickCurrentDoc', () => {
  it('returns null for no documents', () => {
    expect(pickCurrentDoc([])).toBeNull()
  })

  it('takes the document that expires last', () => {
    const picked = pickCurrentDoc([doc('active', '2026-03-01'), doc('active', '2027-01-15'), doc('active', '2026-12-31')])
    expect(picked?.expiresOn).toBe('2027-01-15')
  })

  it('prefers a live document over a cancelled one that expires later', () => {
    const picked = pickCurrentDoc([doc('cancelled', '2030-01-01'), doc('renewing', '2026-11-01')])
    expect(picked).toEqual(doc('renewing', '2026-11-01'))
  })

  it('still returns the newest one when every document is cancelled', () => {
    const picked = pickCurrentDoc([doc('cancelled', '2026-01-01'), doc('cancelled', '2026-06-01')])
    expect(picked?.expiresOn).toBe('2026-06-01')
  })

  it('does not mutate the input order', () => {
    const input = [doc('active', '2026-01-01'), doc('active', '2027-01-01')]
    pickCurrentDoc(input)
    expect(input[0].expiresOn).toBe('2026-01-01')
  })
})

import { docHealth, matchesIssue, summarize } from './international'
import type { InternationalDoc, InternationalStudentRow } from '../types'

const intl = (daysLeft: number, status: 'active' | 'renewing' | 'cancelled' = 'active'): InternationalDoc => ({
  id: 'd', number: null, issuedOn: null, expiresOn: '2026-12-31', status,
  registrationBasis: null, address: null, verified: false, daysLeft,
  bucket: daysLeft < 0 ? 'expired' : 'ok',
})
const student = (visa: InternationalDoc | null, registration: InternationalDoc | null): InternationalStudentRow => ({
  studentId: 's', fullName: 'A', faculty: 'amit', country: 'X', course: 1, phone: null, visa, registration,
})

describe('docHealth', () => {
  it('classifies missing, cancelled, expired, soon and ok', () => {
    expect(docHealth(null)).toBe('missing')
    expect(docHealth(intl(100, 'cancelled'))).toBe('missing')
    expect(docHealth(intl(-1))).toBe('expired')
    expect(docHealth(intl(0))).toBe('soon')
    expect(docHealth(intl(30))).toBe('soon')
    expect(docHealth(intl(31))).toBe('ok')
  })
})

describe('matchesIssue / summarize', () => {
  const rows = [
    student(intl(200), intl(200)),   // clean
    student(null, intl(200)),        // visa missing
    student(intl(-5), intl(10)),     // visa expired, registration soon
    student(intl(200), null),        // registration missing
  ]

  it('filters by each issue', () => {
    const ids = (f: Parameters<typeof matchesIssue>[1]) => rows.map((r, i) => (matchesIssue(r, f) ? i : -1)).filter((i) => i >= 0)
    expect(ids('')).toEqual([0, 1, 2, 3])
    expect(ids('any')).toEqual([1, 2, 3])
    expect(ids('visa-missing')).toEqual([1])
    expect(ids('visa-expired')).toEqual([2])
    expect(ids('reg-soon')).toEqual([2])
    expect(ids('reg-missing')).toEqual([3])
  })

  it('counts the same buckets the filters select', () => {
    expect(summarize(rows)).toEqual({
      total: 4,
      anyIssue: 3,
      visa: { missing: 1, expired: 1, soon: 0 },
      registration: { missing: 1, expired: 0, soon: 1 },
    })
  })
})
