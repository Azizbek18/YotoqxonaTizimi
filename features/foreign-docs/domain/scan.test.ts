import { describe, expect, it } from 'vitest'
import { parseScanResult } from './scan'

describe('parseScanResult', () => {
  it('keeps valid fields', () => {
    expect(parseScanResult('{"number":"E123","issuedOn":"2026-01-05","expiresOn":"2027-01-04","address":"x"}', 'registration'))
      .toEqual({ number: 'E123', issuedOn: '2026-01-05', expiresOn: '2027-01-04', address: 'x' })
  })

  it('nulls out junk dates and the literal "null"', () => {
    expect(parseScanResult('{"number":"null","issuedOn":"05.01.2026","expiresOn":"9999-01-01"}', 'visa')).toBeNull()
  })

  it('strips markdown fences and ignores address for a visa', () => {
    expect(parseScanResult('```json\n{"number":"A1","expiresOn":"2027-02-02","address":"Tashkent"}\n```', 'visa'))
      .toEqual({ number: 'A1', issuedOn: null, expiresOn: '2027-02-02', address: null })
  })

  it('drops an expiry that precedes the issue date', () => {
    expect(parseScanResult('{"issuedOn":"2026-05-01","expiresOn":"2026-01-01","number":"7"}', 'lease'))
      .toEqual({ number: '7', issuedOn: '2026-05-01', expiresOn: null, address: null })
  })

  it('returns null for non-JSON', () => {
    expect(parseScanResult('sorry', 'visa')).toBeNull()
  })
})
