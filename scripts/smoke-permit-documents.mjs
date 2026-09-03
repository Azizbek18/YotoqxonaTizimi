// Schema + delivery-path smoke for the automatic Ariza + Tilxat.
//
//   node --env-file=.env.local scripts/smoke-permit-documents.mjs [--keep]
//
// Needs Supabase SERVICE_ROLE env + the 202609260000_permit_documents
// migration applied. Verifies the schema, then drives the real HTTP delivery
// by creating a throwaway approved permit with a room and a signed
// permit_documents row, POSTing to an internal re-deliver trigger is not
// exposed — so instead it asserts the pieces the server needs are in place
// and that a fresh row starts undelivered. The full end-to-end (submit ->
// approve -> assign room -> Telegram/email) is covered by e2e + the
// lib/permit-documents.test.ts decision matrix.
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
const trash = { permitId: null }

async function main() {
  // 1. staff.signature_image column exists.
  const staffProbe = await svc.from('staff').select('id, signature_image').limit(1)
  check('staff.signature_image column exists', !staffProbe.error, staffProbe.error?.message)

  // 2. permit_documents table exists and is service-role reachable.
  const docProbe = await svc.from('permit_documents').select('permit_request_id').limit(1)
  check('permit_documents table exists', !docProbe.error, docProbe.error?.message)

  // 3. A signed row can be inserted and starts undelivered.
  const { data: permit, error: pErr } = await svc.from('permit_requests').insert({
    passport_series: `SMK${TAG}`, jshshir: `9${TAG}0${TAG}`.slice(0, 14),
    full_name: 'Smokov Hujjat Testovich', email: `smoke.doc.${TAG}@example.com`,
    phone: '+998901234567', gender: 'male', faculty: 'amit', direction: 'suniy-intellekt',
    course: 2, permit_url: 'smoke/none.pdf', status: 'approved', room_number: `SMK${TAG}`,
    application_type: 'yollanma', study_type: 'grant', origin_country: "O'zbekiston",
    origin_region: 'Andijon', relative_phone: '+998901112233', ai_review: 'manual',
  }).select('id').single()
  if (pErr) throw pErr
  trash.permitId = permit.id

  const ins = await svc.from('permit_documents').insert({
    permit_request_id: permit.id, student_signature: PNG, student_signed_at: new Date().toISOString(),
  }).select('delivered_at').single()
  check('signed permit_documents row inserts, delivered_at NULL', !ins.error && ins.data.delivered_at === null, ins.error?.message)

  // 4. RLS: anon cannot read permit_documents.
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'anon', { auth: { persistSession: false } })
  const leak = await anon.from('permit_documents').select('permit_request_id').limit(1)
  check('anon cannot read permit_documents (RLS)', leak.error != null || (leak.data?.length ?? 0) === 0)

  // 5. ON DELETE CASCADE from permit_requests.
  await svc.from('permit_requests').delete().eq('id', permit.id)
  trash.permitId = null
  const gone = await svc.from('permit_documents').select('permit_request_id').eq('permit_request_id', permit.id)
  check('deleting the permit cascades the document row', (gone.data?.length ?? 0) === 0)
}

main()
  .catch((e) => { console.error('FATAL', e); results.push(false) })
  .finally(async () => {
    if (!keep && trash.permitId) await svc.from('permit_requests').delete().eq('id', trash.permitId).catch(() => {})
    const passed = results.length > 0 && results.every(Boolean)
    console.log(`\n${passed ? 'ALL PASS' : 'FAILURES'} (${results.filter(Boolean).length}/${results.length})`)
    process.exit(passed ? 0 : 1)
  })
