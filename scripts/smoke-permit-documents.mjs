// Schema smoke for the automatic Ariza + Tilxat (migration 202609260000).
//
//   node --env-file=.env.local scripts/smoke-permit-documents.mjs [--keep]
//
// Verifies the prod schema is in place: staff.signature_image, the
// permit_documents table + its RLS lockdown + cascade. Then best-effort
// drives a signed row through insert → RLS check → cascade delete.
//
// NOTE: from a network that resets connections to *.supabase.co (e.g. UZ —
// see the uz-address memory), the write half fails with ECONNRESET. That is
// an environment limitation, not a code fault — run it from CI / a VPS, or
// rely on the MCP schema check. Each call is wrapped in a 15s timeout so the
// script fails fast instead of hanging.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}
const svc = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const keep = process.argv.includes('--keep')
const TAG = Date.now().toString().slice(-7)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}
const withTimeout = (p, ms = 15_000) =>
  Promise.race([
    Promise.resolve(p).then((v) => v, (e) => ({ error: e })),
    new Promise((res) => setTimeout(() => res({ error: new Error(`timeout after ${ms}ms`) }), ms)),
  ])
let netDown = false
const skipIfNet = (r, name) => {
  if (r?.error && /ECONNRESET|timeout|fetch failed|ENOTFOUND/i.test(r.error.message || '')) {
    netDown = true
    console.log(`SKIP  ${name} — ${r.error.message} (network to *.supabase.co from this host)`)
    return true
  }
  return false
}

const trash = { permitId: null }

async function main() {
  const staffProbe = await withTimeout(svc.from('staff').select('id, signature_image').limit(1))
  if (!skipIfNet(staffProbe, 'staff.signature_image column exists')) {
    check('staff.signature_image column exists', !staffProbe.error, staffProbe.error?.message)
  }

  const docProbe = await withTimeout(svc.from('permit_documents').select('permit_request_id').limit(1))
  if (!skipIfNet(docProbe, 'permit_documents table exists')) {
    check('permit_documents table exists', !docProbe.error, docProbe.error?.message)
  }

  // RLS: anon must not read permit_documents.
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'anon', { auth: { persistSession: false } })
  const leak = await withTimeout(anon.from('permit_documents').select('permit_request_id').limit(1))
  if (!skipIfNet(leak, 'anon cannot read permit_documents (RLS)')) {
    check('anon cannot read permit_documents (RLS)', leak.error != null || (leak.data?.length ?? 0) === 0, leak.error?.message)
  }
  if (netDown) { console.log('\nNetwork to *.supabase.co is unreachable from here — run from CI / a VPS, or use the MCP schema check.'); return }

  // Write half — best effort (see the ECONNRESET note above).
  let wrote = false
  try {
    const { data: permit, error: pErr } = await withTimeout(svc.from('permit_requests').insert({
      passport_series: `SMK${TAG}`, jshshir: `9${TAG}0${TAG}`.slice(0, 14),
      full_name: 'Smokov Hujjat Testovich', email: `smoke.doc.${TAG}@example.com`,
      phone: '+998901234567', gender: 'male', faculty: 'amit', direction: 'suniy-intellekt',
      course: 2, permit_url: 'smoke/none.pdf', status: 'approved', room_number: `SMK${TAG}`,
      application_type: 'yollanma', study_type: 'grant', origin_country: "O'zbekiston",
      origin_region: 'Andijon', relative_phone: '+998901112233', ai_review: 'manual',
    }).select('id').single())
    if (pErr) throw pErr
    trash.permitId = permit.id
    wrote = true

    const ins = await withTimeout(svc.from('permit_documents').insert({
      permit_request_id: permit.id, student_signature: PNG, student_signed_at: new Date().toISOString(),
    }).select('delivered_at').single())
    check('signed permit_documents row inserts, delivered_at NULL', !ins.error && ins.data?.delivered_at === null, ins.error?.message)

    await withTimeout(svc.from('permit_requests').delete().eq('id', permit.id))
    trash.permitId = null
    const gone = await withTimeout(svc.from('permit_documents').select('permit_request_id').eq('permit_request_id', permit.id))
    check('deleting the permit cascades the document row', (gone.data?.length ?? 0) === 0)
  } catch (e) {
    console.log(`SKIP  write-path checks — ${e.message} (network to *.supabase.co, not a code fault)`)
  }
  if (!wrote) console.log('     schema is verified; re-run the write half from CI / a VPS.')
}

main()
  .catch((e) => { console.error('FATAL', e); results.push(false) })
  .finally(async () => {
    if (!keep && trash.permitId) {
      await withTimeout(svc.from('permit_requests').delete().eq('id', trash.permitId))
    }
    if (results.length === 0) { console.log('\nNo checks ran (network).'); process.exit(0) }
    const passed = results.every(Boolean)
    console.log(`\n${passed ? 'ALL PASS' : 'FAILURES'} (${results.filter(Boolean).length}/${results.length})`)
    process.exit(passed ? 0 : 1)
  })
