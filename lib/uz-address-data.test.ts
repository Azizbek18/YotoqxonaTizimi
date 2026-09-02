import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type AddressPayload = {
  regions: Array<{ id: number; name: string }>
  districts: Array<{ id: number; regionId: number; name: string }>
  mahallas: Array<{ districtId: number; name: string }>
}

const payload = JSON.parse(
  readFileSync(resolve(process.cwd(), 'public/data/uz-address.json'), 'utf8'),
) as AddressPayload

describe('bundled Uzbekistan address catalogue', () => {
  it('contains the complete top-level catalogue and a useful MFY dataset', () => {
    expect(payload.regions).toHaveLength(14)
    expect(payload.districts.length).toBeGreaterThanOrEqual(200)
    expect(payload.mahallas.length).toBeGreaterThanOrEqual(9000)
  })

  it('has unique names/ids and no orphan parent references', () => {
    const regionIds = new Set(payload.regions.map((r) => r.id))
    const districtIds = new Set(payload.districts.map((d) => d.id))
    expect(regionIds.size).toBe(payload.regions.length)
    expect(districtIds.size).toBe(payload.districts.length)
    expect(payload.regions.every((r) => r.name.trim())).toBe(true)
    expect(payload.districts.every((d) => regionIds.has(d.regionId) && d.name.trim())).toBe(true)
    expect(payload.mahallas.every((m) => districtIds.has(m.districtId) && m.name.trim())).toBe(true)
  })

  it('keeps every district selectable, even when the source has no MFY row', () => {
    const districtNames = new Set(payload.districts.map((d) => d.name.toLocaleLowerCase('uz')))
    expect(districtNames.size).toBe(payload.districts.length)
    // The form exposes an explicit custom MFY input for these rare source gaps;
    // this assertion prevents regressions to fabricated placeholder MFYs.
    const names = new Set(payload.mahallas.map((m) => m.name.trim().toLocaleLowerCase('uz')))
    expect(names.has('1-mahalla')).toBe(false)
    expect(names.has('2-mahalla')).toBe(false)
    expect(names.has("bog'iston mahallasi")).toBe(false)
  })
})
