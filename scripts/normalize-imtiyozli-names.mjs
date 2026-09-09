import { createClient } from '@supabase/supabase-js'

// One-time cleanup for imtiyozli (foreign) applicant names. The early ariza
// form had a single free-text F.I.Sh field and no "no patronymic" opt-out, so
// permit_requests.full_name is frequently:
//   - glued into one token   "ZairovaGulnaza"   -> "Zairova Gulnaza"
//   - padded with a placeholder  "Ruslanova Merjen XXX"  -> "Ruslanova Merjen"
//   - screamed in capitals   "VEPAYEVA ENESH"   -> "Vepayeva Enesh"
// full_name is printed verbatim onto the signed Ariza + Tilxat (see
// lib/permit-documents.ts), so it needs to read cleanly.
//
//   node --env-file=.env.local scripts/normalize-imtiyozli-names.mjs               # dry run
//   node --env-file=.env.local scripts/normalize-imtiyozli-names.mjs --confirm     # apply to permit_requests
//   node --env-file=.env.local scripts/normalize-imtiyozli-names.mjs --confirm --users   # + already-registered users.full_name
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// New submissions are cleaned on input (app/api/imtiyozli-requests/route.ts),
// and a student re-confirms their F.I.Sh in the editable /register Step2Name —
// so this only needs to run once. Names with no safe split boundary
// ("BABAYEVAGULZIRE") are listed for manual review; those self-heal when the
// student registers (the server accepts the corrected spelling and writes it
// back).

const args = process.argv.slice(2)
const confirm = args.includes('--confirm')
const alsoUsers = args.includes('--users')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

// --- helpers, kept in sync with lib/permit-validation.ts ---
const NAME_WS_RE = /[\s​‌‍⁠﻿]+/gu
const PLACEHOLDER_NAME_TOKEN_RE = /^(?:x{2,}|-+|\.+|_+|yo['ʻʼ`]?q|yoq|yuq|нет)$/iu

const normalizeNameWhitespace = (s) => String(s ?? '').replace(NAME_WS_RE, ' ')

const stripPlaceholderNameTokens = (s) =>
  normalizeNameWhitespace(s).trim().split(' ')
    .filter((t) => t && !PLACEHOLDER_NAME_TOKEN_RE.test(t))
    .join(' ')

const splitGluedName = (s) => String(s ?? '').replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')

const PATRONYMIC_MARKERS = new Set([
  'OGLI', 'UGLI', 'UGHLI', 'OGIL', 'QIZI', 'KIZI', 'QIZ', 'QYZY', 'GYZY', 'GIZI',
  'UILI', 'ULI', 'ULY', 'UULU',
])
const isPatronymicMarker = (token) =>
  PATRONYMIC_MARKERS.has(String(token).toUpperCase().replace(/[^A-ZА-Я]/g, ''))

const toTitleCaseName = (s) =>
  normalizeNameWhitespace(s).trim().split(' ').map((token) => {
    if (!token) return token
    if (isPatronymicMarker(token)) return token.toLowerCase()
    const uniform = token === token.toUpperCase() || token === token.toLowerCase()
    if (!uniform) return token
    const lower = token.toLowerCase()
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }).join(' ')

// full pipeline
function normalizeName(raw) {
  let out = stripPlaceholderNameTokens(raw)
  if (out.split(/\s+/).filter(Boolean).length < 2) out = splitGluedName(out)
  out = toTitleCaseName(out).replace(/\s+/g, ' ').trim()
  return out
}

const run = async () => {
  console.log(confirm ? '=== APPLYING ===\n' : '=== DRY RUN (no writes) ===\n')

  const { data: permits, error } = await supabase
    .from('permit_requests')
    .select('id, status, full_name, email')
    .eq('application_type', 'imtiyozli')
  if (error) throw error

  let changed = 0
  const manual = []
  for (const row of permits ?? []) {
    const before = row.full_name ?? ''
    const after = normalizeName(before)
    if (after === before) continue
    if (after.split(' ').filter(Boolean).length < 2) {
      manual.push(row)
      continue
    }
    changed++
    console.log(`  [${row.status}]  "${before}"  ->  "${after}"`)
    if (confirm) {
      const { error: upErr } = await supabase.from('permit_requests').update({ full_name: after }).eq('id', row.id)
      if (upErr) console.error(`  ! permit_requests ${row.id}: ${upErr.message}`)
    }
  }

  let userChanged = 0
  if (alsoUsers) {
    const registeredEmails = (permits ?? []).filter((p) => p.status === 'registered').map((p) => p.email).filter(Boolean)
    if (registeredEmails.length) {
      const { data: users, error: uErr } = await supabase
        .from('users').select('id, email, full_name').in('email', registeredEmails)
      if (uErr) throw uErr
      console.log('\n--- users.full_name ---')
      for (const u of users ?? []) {
        const before = u.full_name ?? ''
        const after = normalizeName(before)
        if (after === before || after.split(' ').filter(Boolean).length < 2) continue
        userChanged++
        console.log(`  "${before}"  ->  "${after}"`)
        if (confirm) {
          const { error: upErr } = await supabase.from('users').update({ full_name: after }).eq('id', u.id)
          if (upErr) console.error(`  ! users ${u.id}: ${upErr.message}`)
        }
      }
    }
  }

  if (manual.length) {
    console.log('\n--- MANUAL REVIEW NEEDED (no safe split; self-heals at registration) ---')
    for (const row of manual) console.log(`  [${row.status}]  "${row.full_name}"   <${row.email}>`)
  }

  console.log(`\n${changed} permit_requests${alsoUsers ? `, ${userChanged} users` : ''} ${confirm ? 'updated' : 'would change'}; ${manual.length} need manual review.`)
  if (!confirm) console.log('Re-run with --confirm to apply.')
}

run().catch((e) => { console.error(e); process.exit(1) })
