// Builds public/data/uz-address.json — Uzbekistan region / district / mahalla
// (MFY) reference data — so the register form never depends on
// raw.githubusercontent.com at runtime (blocked / flaky for UZ users).
//
//   node scripts/build-uz-address.mjs
//
// Sources (both public, SOATO/MHOBT based):
//  - uzinfocom-org/digital-health-ig  → the clean 206-district list
//    (State Committee on Statistics names) + region grouping.
//  - kenjebaev/regions                → ~10,000 MFY / QFY with a district_id,
//    including the urban mahallas the SOATO settlement list is missing.
// The two district lists are reconciled by name (exact → edit-distance ≤ 2
// within the same region); any mahalla whose district can't be matched keeps
// its own district entry so nothing is dropped.
import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
const OUT = join(OUT_DIR, 'uz-address.json')

const UZINFOCOM = 'https://raw.githubusercontent.com/uzinfocom-org/digital-health-ig/main/input/vocabulary'
const KENJEBAEV = 'https://raw.githubusercontent.com/kenjebaev/regions/HEAD/regions.json'

// SSV region code (UZ-AN …) → canonical region name.
const REGION_NAME = {
  'UZ-AN': 'Andijon viloyati', 'UZ-BU': 'Buxoro viloyati', 'UZ-FA': "Farg'ona viloyati",
  'UZ-JI': 'Jizzax viloyati', 'UZ-NG': 'Namangan viloyati', 'UZ-NW': 'Navoiy viloyati',
  'UZ-QA': 'Qashqadaryo viloyati', 'UZ-QR': "Qoraqalpog'iston Respublikasi",
  'UZ-SA': 'Samarqand viloyati', 'UZ-SI': 'Sirdaryo viloyati', 'UZ-SU': 'Surxondaryo viloyati',
  'UZ-TK': 'Toshkent shahri', 'UZ-TO': 'Toshkent viloyati', 'UZ-XO': 'Xorazm viloyati',
}
const REGION_PREFIX = Object.fromEntries(
  Object.keys(REGION_NAME).map((k) => [k.split('-')[1], k]),
)

const clean = (s) =>
  String(s ?? '')
    .replace(/﻿/g, '')
    .replace(/[‘’ʻʼ`´]/g, "'") // unify every apostrophe/okina to ASCII '
    .replace(/\s+/g, ' ')
    .trim()
const stripJson = (t) => t.replace(/^﻿/, '')

const isCityName = (s) => /shah(ri|ar)|shaxri/i.test(clean(s))

// Loose core of a district name (spelling-tolerant), without the
// tumani / shahri marker — that's compared separately.
const dcore = (s) =>
  clean(s)
    .toLowerCase()
    .replace(/\b(tumani|shahri|shaxri|shahar|tuman|nomli|nomidagi)\b/g, '')
    .replace(/\bsh\.?\s*/g, 'sharof ')       // "Sh.Rashidov" → "sharof rashidov"
    .replace(/\bm\.?\s*ulug/g, 'mirzoulug')  // "M.Ulug'bek" → "mirzo ulug'bek"
    .replace(/[ʻʼ'`´.\- ]/g, '')

function editDistance(a, b) {
  const m = a.length, n = b.length
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
  return d[m][n]
}

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return JSON.parse(stripJson(await res.text()))
}

const [ssv, kenje] = await Promise.all([
  getJson(`${UZINFOCOM}/CodeSystem-ssv-administrative-territory-cs.json`),
  getJson(KENJEBAEV),
])

// ---- regions (14) ----
const regions = Object.entries(REGION_NAME)
  .map(([, name], i) => ({ id: i + 1, name }))
  .sort((a, b) => a.name.localeCompare(b.name, 'uz'))
const regionIdByName = new Map(regions.map((r) => [r.name, r.id]))

// ---- districts (from the SSV / uzinfocom clean list) ----
let nextDistrictId = 1
const districts = []
for (const c of ssv.concept) {
  const code = String(c.code)
  const m = code.match(/^([A-Z]{2})-\d+$/) // "AN-202" — a district; "UZ-AN" is a region
  if (!m) continue
  const regionKey = REGION_PREFIX[m[1]]
  if (!regionKey) continue
  districts.push({
    id: nextDistrictId++,
    regionId: regionIdByName.get(REGION_NAME[regionKey]),
    name: clean(c.display),
  })
}

// index districts by region for fuzzy matching
const districtsByRegion = new Map()
for (const d of districts) {
  if (!districtsByRegion.has(d.regionId)) districtsByRegion.set(d.regionId, [])
  districtsByRegion.get(d.regionId).push(d)
}

// ---- kenjebaev region id → our region id (spelling-tolerant) ----
const rkey = (s) => clean(s).toLowerCase().replace(/\bviloyati|respublikasi\b/g, '').replace(/[ʻʼ'`´ ]/g, '')
const ourRegionKeys = regions.map((r) => ({ id: r.id, k: rkey(r.name) }))
const kRegionToOurs = new Map()
for (const kr of kenje.regions) {
  const tk = rkey(kr.name)
  let hit = ourRegionKeys.find((o) => o.k === tk)
  if (!hit) {
    let best = null, bd = Infinity
    for (const o of ourRegionKeys) {
      const d = editDistance(o.k, tk)
      if (d < bd) { bd = d; best = o }
    }
    if (best && bd <= 3) hit = best
  }
  if (hit) kRegionToOurs.set(kr.id, hit.id)
}
const matchCache = new Map()

function resolveDistrict(kDistrict) {
  if (matchCache.has(kDistrict.id)) return matchCache.get(kDistrict.id)
  const regionId = kRegionToOurs.get(kDistrict.region_id)
  const pool = (regionId && districtsByRegion.get(regionId)) || []

  const targetCore = dcore(kDistrict.name)
  const targetCity = isCityName(kDistrict.name)
  // Prefer candidates of the same kind (tuman vs shahar); a district in a
  // region always resolves to *some* district in that region — never a
  // duplicate — so a city's mahallas can't leak into the same-named tuman.
  const sameKind = pool.filter((d) => isCityName(d.name) === targetCity)
  const tiers = [sameKind, pool]

  let hit = null
  for (const tier of tiers) {
    hit = tier.find((d) => dcore(d.name) === targetCore)
    if (hit) break
    let best = null, bestDist = Infinity
    for (const d of tier) {
      const dist = editDistance(dcore(d.name), targetCore)
      if (dist < bestDist) { bestDist = dist; best = d }
    }
    // within a region, the closest name is almost always right
    if (best && bestDist <= Math.max(2, Math.ceil(targetCore.length * 0.34))) { hit = best; break }
  }
  if (!hit && pool.length) hit = pool[0]

  if (!hit) {
    // Region itself couldn't be resolved — keep the mahalla under a new entry.
    hit = { id: nextDistrictId++, regionId: regionId ?? regions[0].id, name: clean(kDistrict.name) }
    districts.push(hit)
    if (!districtsByRegion.has(hit.regionId)) districtsByRegion.set(hit.regionId, [])
    districtsByRegion.get(hit.regionId).push(hit)
  }
  matchCache.set(kDistrict.id, hit.id)
  return hit.id
}

const kDistrictById = new Map(kenje.districts.map((d) => [d.id, d]))

// ---- mahallas (MFY) ----
const seen = new Set()
const mahallas = []
for (const q of kenje.quarters) {
  const kd = kDistrictById.get(q.district_id)
  if (!kd) continue
  const districtId = resolveDistrict(kd)
  let name = clean(q.name)
    .replace(/\s*(MFY|mahallasi|mahalla)\s*$/i, '')
    .replace(/\s*ovul fuqarolar yig.?ini\s*$/i, ' (ovul)')
    .replace(/\s*fuqarolar yig.?ini\s*$/i, '')
    
    .trim()
  if (!name) continue
  const k = `${districtId}::${name.toLowerCase()}`
  if (seen.has(k)) continue
  seen.add(k)
  mahallas.push({ districtId, name })
}

districts.sort((a, b) => a.name.localeCompare(b.name, 'uz'))
mahallas.sort((a, b) => a.name.localeCompare(b.name, 'uz'))

const withMahallas = new Set(mahallas.map((m) => m.districtId))
const payload = {
  generatedAt: new Date().toISOString(),
  source: 'uzinfocom-org/digital-health-ig + kenjebaev/regions',
  regions,
  districts,
  mahallas,
}
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(payload))

const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(0)
console.log(`wrote ${OUT}`)
console.log(`regions ${regions.length} · districts ${districts.length} · mahallas ${mahallas.length} · ${kb} KB`)
console.log(`districts with mahalla data: ${withMahallas.size} / ${districts.length}`)
const empty = districts.filter((d) => !withMahallas.has(d.id))
if (empty.length) console.log('  no mahallas:', empty.map((d) => d.name).join(', '))
