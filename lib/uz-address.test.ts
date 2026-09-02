import { describe, expect, it } from 'vitest'
import { districtsOfRegion, normalizeName, villagesOfDistrict, type UzAddressData } from './uz-address'

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
  villages: [
    { id: 100, districtId: 20, name: "Qo'rg'ontepa" },
    { id: 101, districtId: 20, name: 'Paxtaobod' },
    { id: 102, districtId: 10, name: 'Katta Yigit' },
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

  it('villagesOfDistrict scopes to region + district', () => {
    expect(villagesOfDistrict(data, 'Andijon viloyati', 'Asaka tumani').map((v) => v.name))
      .toEqual(["Qo'rg'ontepa", 'Paxtaobod'])
    // Urban district with no villages in the dataset → empty, never an error.
    expect(villagesOfDistrict(data, 'Toshkent shahri', 'Yunusobod tumani')).toEqual([])
  })
})
