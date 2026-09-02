// Builds public/data/uz-address.json — Uzbekistan region / district / mahalla
// (MFY) reference data — so the register form never depends on
// raw.githubusercontent.com at runtime (blocked / flaky for UZ users).
//
//   node scripts/build-uz-address.mjs
//
// Sources (both public):
//  - kenjebaev/regions  → ~10,000 MFY / QFY, each with a district_id, plus a
//    203-district / 14-region hierarchy. This is the mahalla payload.
//  - uzinfocom-org/digital-health-ig  → the State Committee on Statistics (SSV)
//    canonical 206-district list (7-digit SOATO codes) + 14-region list. This
//    supplies the *names* the register form shows.
//
// Every kenjebaev district is matched to an SSV district in the same region by
// a consonant-skeleton comparison (tolerant of the a/o, i/e, x/h, missing-letter
// spelling drift between the two lists). Unmatched kenjebaev districts that
// still carry mahallas are appended so nothing is dropped. Any SSV district
// that ends up with no mahallas borrows the list of its same-name sibling
// (e.g. "Xiva shahri" ← "Xiva tumani"); the handful with no sibling either
// (new city-districts like Yangihayot, Nurafshon, G'ozg'on) stay empty and the
// form's free-text combobox covers them.
import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
const OUT = join(OUT_DIR, 'uz-address.json')

const UZINFOCOM = 'https://raw.githubusercontent.com/uzinfocom-org/digital-health-ig/main'
const SSV_DISTRICTS = `${UZINFOCOM}/${encodeURI('input/excel/Изменения в address_030725.csv/VS_District_City.csv')}`
const KENJEBAEV = 'https://raw.githubusercontent.com/kenjebaev/regions/HEAD/regions.json'

// SSV 4-digit SOATO region prefix → canonical region name.
const REGION_BY_PREFIX = {
  1703: 'Andijon viloyati', 1706: 'Buxoro viloyati', 1708: 'Jizzax viloyati',
  1710: 'Qashqadaryo viloyati', 1712: 'Navoiy viloyati', 1714: 'Namangan viloyati',
  1718: 'Samarqand viloyati', 1722: 'Surxondaryo viloyati', 1724: 'Sirdaryo viloyati',
  1726: 'Toshkent shahri', 1727: 'Toshkent viloyati', 1730: "Farg'ona viloyati",
  1733: 'Xorazm viloyati', 1735: "Qoraqalpog'iston Respublikasi",
}
// kenjebaev region id → canonical region name.
const REGION_BY_KENJE = {
  1: "Qoraqalpog'iston Respublikasi", 2: 'Andijon viloyati', 3: 'Buxoro viloyati',
  4: 'Jizzax viloyati', 5: 'Qashqadaryo viloyati', 6: 'Navoiy viloyati',
  7: 'Namangan viloyati', 8: 'Samarqand viloyati', 9: 'Surxondaryo viloyati',
  10: 'Sirdaryo viloyati', 11: 'Toshkent viloyati', 12: "Farg'ona viloyati",
  13: 'Xorazm viloyati', 14: 'Toshkent shahri',
}

// kenjebaev district name → SSV district name, for pairs the skeleton match
// can't reach on its own.
const DISTRICT_ALIAS = {
  "bo'z tumani": "Bo'ston tumani",           // Andijon
  'boz tumani': "Bo'ston tumani",
}

const clean = (s) =>
  String(s ?? '')
    .replace(/﻿/g, '')
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

const isCityName = (s) => /\bshah(ri|ar)\b|shaxri/i.test(clean(s))

// Core of a district name: lowercased, marker words removed, initials expanded.
const dcore = (s) =>
  clean(s)
    .toLowerCase()
    .replace(/\b(tumani|shahri|shaxri|shahar|shaharchasi|tuman|nomli|nomidagi)\b/g, '')
    .replace(/\bsh\.?\s*/g, 'sharof ')
    .replace(/\bm\.?\s*ulug/g, 'mirzoulug')
    .replace(/[ʻʼ'`´.\-]/g, '')
    .replace(/\s+/g, '')
    .trim()

// Consonant skeleton — drops vowels so Xonabod/Xonobod, Angren/Angiren,
// Bekobod/Bekabod, Shovot/Shavot … collapse to the same string.
const skel = (s) => dcore(s).replace(/[aeiouаеёиоуэюя]/g, '')

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

async function getText(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return (await res.text()).replace(/^﻿/, '')
}
const getJson = async (url) => JSON.parse(await getText(url))

const [ssvCsv, kenje] = await Promise.all([getText(SSV_DISTRICTS), getJson(KENJEBAEV)])

// ---- regions (14) ----
const regions = [...new Set(Object.values(REGION_BY_PREFIX))]
  .map((name, i) => ({ id: i + 1, name }))
  .sort((a, b) => a.name.localeCompare(b.name, 'uz'))
const regionIdByName = new Map(regions.map((r) => [r.name, r.id]))

// ---- districts (SSV canonical list) ----
let nextDistrictId = 1
const districts = []
for (const line of ssvCsv.split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue
  const [code, uz] = line.split('\t')
  const regionName = REGION_BY_PREFIX[Number(String(code).slice(0, 4))]
  if (!regionName || !uz) continue
  districts.push({
    id: nextDistrictId++,
    regionId: regionIdByName.get(regionName),
    name: clean(uz),
    soato: String(code).trim(),
  })
}

const districtsByRegion = new Map()
for (const d of districts) {
  if (!districtsByRegion.has(d.regionId)) districtsByRegion.set(d.regionId, [])
  districtsByRegion.get(d.regionId).push(d)
}

// ---- match each kenjebaev district → an SSV district (same region) ----
const kDistrictById = new Map(kenje.districts.map((d) => [d.id, d]))
const kQuarterCount = new Map()
for (const q of kenje.quarters)
  kQuarterCount.set(q.district_id, (kQuarterCount.get(q.district_id) || 0) + 1)

const resolvedCache = new Map()

function resolveKenjeDistrict(kd) {
  if (resolvedCache.has(kd.id)) return resolvedCache.get(kd.id)
  const regionName = REGION_BY_KENJE[kd.region_id]
  const regionId = regionName ? regionIdByName.get(regionName) : null
  const pool = (regionId && districtsByRegion.get(regionId)) || []

  const alias = DISTRICT_ALIAS[clean(kd.name).toLowerCase()]
  const targetCore = dcore(alias || kd.name)
  const targetSkel = skel(alias || kd.name)
  const targetCity = isCityName(alias || kd.name)

  // City vs tuman matters: "Andijon shahri" and "Andijon tumani" share a core
  // and a skeleton, so always try the same-kind candidate first.
  let hit =
    pool.find((d) => dcore(d.name) === targetCore && isCityName(d.name) === targetCity) ||
    pool.find((d) => skel(d.name) === targetSkel && isCityName(d.name) === targetCity) ||
    pool.find((d) => dcore(d.name) === targetCore) ||
    pool.find((d) => skel(d.name) === targetSkel)

  if (!hit && targetSkel) {
    let best = null, bestDist = Infinity
    for (const d of pool) {
      const dist = editDistance(skel(d.name), targetSkel)
      if (dist < bestDist) { bestDist = dist; best = d }
    }
    if (best && bestDist <= 2) hit = best
  }

  if (!hit) {
    // No SSV counterpart — keep kenjebaev's district (only if it has mahallas,
    // so empty phantom rows like "Asaka shahri (0)" don't pollute the list).
    if ((kQuarterCount.get(kd.id) || 0) > 0) {
      hit = {
        id: nextDistrictId++,
        regionId: regionId ?? regions[0].id,
        name: clean(kd.name),
        soato: null,
      }
      districts.push(hit)
      if (!districtsByRegion.has(hit.regionId)) districtsByRegion.set(hit.regionId, [])
      districtsByRegion.get(hit.regionId).push(hit)
    } else {
      hit = null
    }
  }

  const id = hit ? hit.id : null
  resolvedCache.set(kd.id, id)
  return id
}

// ---- mahallas (MFY) ----
const seen = new Set()
const mahallas = []
const dropped = []
for (const q of kenje.quarters) {
  const kd = kDistrictById.get(q.district_id)
  if (!kd) { dropped.push(q.name); continue }
  const districtId = resolveKenjeDistrict(kd)
  if (!districtId) { dropped.push(q.name); continue }
  // Keep the settlement-type marker where it disambiguates ("Orol" the mahalla
  // vs "Orol (qishloq)" in the same district); MFY is the default, so drop it.
  const name = clean(q.name)
    .replace(/["«»]/g, '')                          // quotes are never part of a name
    .replace(/^.*\btarkibidagi\s+/i, '')            // "X FY tarkibidagi Y" → "Y"
    .replace(/\s*\(?chegarada joylashgan\)?\s*$/i, '')
    .replace(/\s*ovul fuqarolar yig.?ini\s*$/i, ' (ovul)')
    .replace(/\s*qishloq(i)? fuqarolar yig.?ini\s*$/i, ' (qishloq)')
    .replace(/\s*(shahar|shaharcha) fuqarolar yig.?ini\s*$/i, ' (shaharcha)')
    .replace(/\s+\b(OFY)\s*$/i, ' (ovul)')
    .replace(/\s+\b(QFY|KFY)\s*$/i, ' (qishloq)')
    .replace(/\s+\bSHFY\s*$/i, ' (shaharcha)')
    .replace(/\s*fuqarolar yig.?ini\s*$/i, '')
    .replace(/\s+\b(MFY|mahallasi|maxalla|mahalla)\s*$/i, '') // "Foo mahalla" → "Foo"; keeps "10-mahalla"
    .replace(/^[\s.,'-]+|[\s.,'-]+$/g, '')          // stray leading/trailing punctuation
    .replace(/\s+/g, ' ')
    .trim()
  if (!name || name.length < 2 || /^[\d\s.-]+$/.test(name)) continue
  const key = `${districtId}::${name.toLowerCase()}`
  if (seen.has(key)) continue
  seen.add(key)
  mahallas.push({ districtId, name })
}

// ---- fill empty districts from a same-name / same-region sibling ----
const countByDistrict = new Map()
for (const m of mahallas) countByDistrict.set(m.districtId, (countByDistrict.get(m.districtId) || 0) + 1)

let borrowed = 0
const stillEmpty = []
for (const d of districts) {
  if (countByDistrict.get(d.id)) continue
  const siblings = (districtsByRegion.get(d.regionId) || []).filter(
    (s) => s.id !== d.id && countByDistrict.get(s.id),
  )
  // Prefer a sibling with the same bare core name (the shahri/tumani pair);
  // otherwise the closest core name in the region.
  let src = siblings.find((s) => dcore(s.name) === dcore(d.name))
  if (!src && siblings.length) {
    let best = null, bestDist = Infinity
    for (const s of siblings) {
      const dist = editDistance(dcore(s.name), dcore(d.name))
      if (dist < bestDist) { bestDist = dist; best = s }
    }
    // only borrow on a genuine name overlap, not "nearest of anything"
    if (best && bestDist <= 3) src = best
  }
  if (src) {
    for (const m of mahallas.filter((m) => m.districtId === src.id))
      mahallas.push({ districtId: d.id, name: m.name })
    countByDistrict.set(d.id, countByDistrict.get(src.id))
    borrowed++
  } else {
    stillEmpty.push(d.name)
  }
}

// ---- write ----
districts.sort((a, b) => a.name.localeCompare(b.name, 'uz'))
mahallas.sort((a, b) => a.name.localeCompare(b.name, 'uz'))

const payload = {
  generatedAt: new Date().toISOString(),
  source: 'kenjebaev/regions + uzinfocom-org/digital-health-ig (SSV)',
  regions,
  districts: districts.map(({ soato, ...d }) => d),
  mahallas,
}
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT, JSON.stringify(payload))

const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(0)
const populated = districts.filter((d) => countByDistrict.get(d.id)).length
console.log(`wrote ${OUT}`)
console.log(`regions ${regions.length} · districts ${districts.length} · mahallas ${mahallas.length} · ${kb} KB`)
console.log(`districts with mahallas: ${populated} / ${districts.length}  (${borrowed} filled from a sibling)`)
if (dropped.length) console.log(`dropped mahallas (no district): ${dropped.length}`)
if (stillEmpty.length) console.log(`still empty (free-text only): ${stillEmpty.join(', ')}`)
