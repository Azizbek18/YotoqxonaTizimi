import { createClient } from '@supabase/supabase-js'

// One-time cleanup: transliterate every Cyrillic name already in the
// database to Latin, so the dekan tables / exports carry one spelling.
// New names are Latinised on input (see lib/transliterate.ts wiring), so
// this only needs to run once against existing data.
//
//   node --env-file=.env.local scripts/latinize-names.mjs            # dry run — lists every change
//   node --env-file=.env.local scripts/latinize-names.mjs --confirm  # apply
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Touches:  users.full_name, users.middle_name, users.father_full_name,
//           users.mother_full_name   and   permit_requests.full_name

const confirm = process.argv.slice(2).includes('--confirm')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

// --- transliteration (kept in sync with lib/transliterate.ts) ---
const UZBEK_MARKERS = /[ўғқҳ]/i
const UZBEK_MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', ғ: 'gʻ', д: 'd', е: 'e', ё: 'yo', ж: 'j',
  з: 'z', и: 'i', й: 'y', к: 'k', қ: 'q', л: 'l', м: 'm', н: 'n', о: 'o',
  ў: 'oʻ', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ҳ: 'h',
  ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: 'ʼ', ы: 'i', ь: '', э: 'e',
  ю: 'yu', я: 'ya',
}
const RUSSIAN_MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'iu', я: 'ia',
}
const hasCyrillic = (t) => /[Ѐ-ӿ]/.test(t)
function cyrillicToLatin(input) {
  const text = String(input ?? '')
  if (!hasCyrillic(text)) return text
  const map = UZBEK_MARKERS.test(text) ? UZBEK_MAP : RUSSIAN_MAP
  let out = ''
  for (const ch of text) {
    const lower = ch.toLowerCase()
    const mapped = map[lower]
    if (mapped === undefined) { out += ch; continue }
    out += (ch !== lower && mapped) ? mapped.charAt(0).toUpperCase() + mapped.slice(1) : mapped
  }
  return out
}

async function processTable(table, columns, keyColumn = 'id') {
  const { data, error } = await supabase.from(table).select([keyColumn, ...columns].join(', '))
  if (error) throw error
  let changed = 0
  for (const row of data ?? []) {
    const patch = {}
    for (const col of columns) {
      const before = row[col]
      if (!before || !hasCyrillic(String(before))) continue
      const after = cyrillicToLatin(before)
      if (after !== before) {
        patch[col] = after
        console.log(`  ${table}.${col}  "${before}"  ->  "${after}"`)
      }
    }
    if (Object.keys(patch).length === 0) continue
    changed++
    if (confirm) {
      const { error: upErr } = await supabase.from(table).update(patch).eq(keyColumn, row[keyColumn])
      if (upErr) console.error(`  ! ${table} ${row[keyColumn]}: ${upErr.message}`)
    }
  }
  return changed
}

const run = async () => {
  console.log(confirm ? '=== APPLYING ===' : '=== DRY RUN (no writes) ===')
  const u = await processTable('users', ['full_name', 'middle_name', 'father_full_name', 'mother_full_name'])
  const p = await processTable('permit_requests', ['full_name'])
  console.log(`\n${u} users rows, ${p} permit_requests rows ${confirm ? 'updated' : 'would change'}.`)
  if (!confirm) console.log('Re-run with --confirm to apply.')
}

run().catch((e) => { console.error(e); process.exit(1) })
