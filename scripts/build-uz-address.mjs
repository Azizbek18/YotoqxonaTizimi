// Fetches the Uzbekistan region / district / settlement reference data once
// and writes it into public/ so the register form never depends on
// raw.githubusercontent.com at runtime (blocked / flaky for UZ users).
//
//   node scripts/build-uz-address.mjs
//
// Source: github.com/MIMAXUZ/uzbekistan-regions-data (SOATO-based).
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const BASE = 'https://raw.githubusercontent.com/MIMAXUZ/uzbekistan-regions-data/master/JSON'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'uz-address.json')

// The upstream district list carries a placeholder header row.
const DROP_DISTRICTS = new Set(['Toshkent shahrining tumanlari'])

const clean = (s) => String(s ?? '').replace(/﻿/, '').replace(/\s+/g, ' ').trim()

async function get(name) {
  const res = await fetch(`${BASE}/${name}.json`)
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`)
  return JSON.parse((await res.text()).replace(/^﻿/, ''))
}

const [regionsRaw, districtsRaw, villagesRaw] = await Promise.all([
  get('regions'), get('districts'), get('villages'),
])

const regions = regionsRaw
  .map((r) => ({ id: r.id, name: clean(r.name_uz) }))
  .filter((r) => r.name)
  .sort((a, b) => a.name.localeCompare(b.name, 'uz'))

const districts = districtsRaw
  .map((d) => ({ id: d.id, regionId: d.region_id, name: clean(d.name_uz) }))
  .filter((d) => d.name && !DROP_DISTRICTS.has(d.name))
  .sort((a, b) => a.name.localeCompare(b.name, 'uz'))

const villages = villagesRaw
  .map((v) => ({ id: v.id, districtId: v.district_id, name: clean(v.name_uz) }))
  .filter((v) => v.name)
  .sort((a, b) => a.name.localeCompare(b.name, 'uz'))

const payload = { generatedAt: new Date().toISOString(), regions, districts, villages }
writeFileSync(OUT, JSON.stringify(payload))

const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(0)
console.log(`wrote ${OUT}`)
console.log(`regions ${regions.length} · districts ${districts.length} · villages ${villages.length} · ${kb} KB`)
