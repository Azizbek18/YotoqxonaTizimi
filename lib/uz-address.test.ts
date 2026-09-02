import { describe, expect, it } from 'vitest'
import { districtsOfRegion, mahallasOfDistrict, normalizeName, type UzAddressData } from './uz-address'

const data: UzAddressData = {
  regions: [
    { id: 1, name: 'Toshkent shahri' },
    { id: 2, name: 'Andijon viloyati' },
  ],
  districts: [
    { id: 10, regionId: 1, name: 'Chilonzor tumani' },
    { id: 11, regionId: 1, name: 'Yunusobod tumani' },
    { id: 20, regionId: 2, name: 'Asaka tumani' },
  ],
  mahallas: [
    { districtId: 20, name: "Qo'rg'ontepa" },
    { districtId: 20, name: 'Paxtaobod' },
    { districtId: 10, name: 'Al-Xorazmiy' },
  ],
}

describe('uz-address helpers', () => {
  it('normalizeName collapses whitespace', () => {
    expect(normalizeName('  Chilonzor   tumani ')).toBe('Chilonzor tumani')
  })

  it('districtsOfRegion filters by the region name (case/space tolerant)', () => {
    expect(districtsOfRegion(data, 'toshkent  shahri').map((d) => d.name))
      .toEqual(['Chilonzor tumani', 'Yunusobod tumani'])
    expect(districtsOfRegion(data, 'Nonexistent')).toEqual([])
  })

  it('mahallasOfDistrict scopes to region + district', () => {
    expect(mahallasOfDistrict(data, 'Andijon viloyati', 'Asaka tumani').map((m) => m.name))
      .toEqual(["Qo'rg'ontepa", 'Paxtaobod'])
    // A district with no mahallas in the dataset → empty, never an error.
    expect(mahallasOfDistrict(data, 'Toshkent shahri', 'Yunusobod tumani')).toEqual([])
  })
})
