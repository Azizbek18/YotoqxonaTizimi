'use client'

// Uzbekistan region / district / mahalla (MFY) reference data, served from
// our own origin (public/data/uz-address.json) — never
// raw.githubusercontent.com, which is unreliable / blocked for many UZ
// users. Regenerate with `node scripts/build-uz-address.mjs`.

export type UzRegion = { id: number; name: string }
export type UzDistrict = { id: number; regionId: number; name: string }
export type UzMahalla = { districtId: number; name: string }
export type UzAddressData = { regions: UzRegion[]; districts: UzDistrict[]; mahallas: UzMahalla[] }

// A tiny inline fallback for the (rare) case the static file itself can't be
// read — the student can still pick a region and type the rest.
const FALLBACK: UzAddressData = {
  regions: [
    'Andijon viloyati', 'Buxoro viloyati', "Farg'ona viloyati", 'Jizzax viloyati',
    'Namangan viloyati', 'Navoiy viloyati', 'Qashqadaryo viloyati',
    "Qoraqalpog'iston Respublikasi", 'Samarqand viloyati', 'Sirdaryo viloyati',
    'Surxondaryo viloyati', 'Toshkent shahri', 'Toshkent viloyati', 'Xorazm viloyati',
  ].map((name, i) => ({ id: i + 1, name })),
  districts: [],
  mahallas: [],
}

export function normalizeName(value: string): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

const key = (value: string) => normalizeName(value).toLowerCase()

let cache: Promise<UzAddressData> | null = null

export function loadUzAddress(): Promise<UzAddressData> {
  if (cache) return cache
  cache = fetch('/data/uz-address.json', { cache: 'force-cache' })
    .then((r) => {
      if (!r.ok) throw new Error(`uz-address ${r.status}`)
      return r.json()
    })
    .then((d: UzAddressData) => ({
      regions: (d.regions ?? []).map((x) => ({ ...x, name: normalizeName(x.name) })),
      districts: (d.districts ?? []).map((x) => ({ ...x, name: normalizeName(x.name) })),
      mahallas: (d.mahallas ?? []).map((x) => ({ ...x, name: normalizeName(x.name) })),
    }))
    .catch((err) => {
      console.error('uz-address load failed, using fallback:', err)
      cache = null // let a later mount retry
      return FALLBACK
    })
  return cache
}

export function districtsOfRegion(data: UzAddressData, regionName: string): UzDistrict[] {
  const region = data.regions.find((r) => key(r.name) === key(regionName))
  if (!region) return []
  return data.districts.filter((d) => d.regionId === region.id)
}

export function mahallasOfDistrict(
  data: UzAddressData,
  regionName: string,
  districtName: string,
): UzMahalla[] {
  const district = districtsOfRegion(data, regionName)
    .find((d) => key(d.name) === key(districtName))
  if (!district) return []
  return data.mahallas.filter((m) => m.districtId === district.id)
}
