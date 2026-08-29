// Smoke test for the tarbiyachi payment-review flow. Creates a throwaway
// tarbiyachi account + a 'waiting' payment, signs in, exercises
// /api/admin/payments (list / summary / approve) as that tarbiyachi, then
// deletes everything it made. Needs the dev server on :3000.
//   node --env-file=.env.local scripts/smoke-tarbiyachi-payments.mjs
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const svc = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anon = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const BASE = 'http://localhost:3000'

const email = `tmp-tarbiyachi-${Date.now()}@example.com`
const password = 'Test1234!secure'
let authUserId = null
let testPaymentId = null
const results = []
const log = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }

try {
  // --- 1. temp tarbiyachi (auth + staff row) ---
  const created = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error) throw new Error('createUser: ' + created.error.message)
  authUserId = created.data.user.id
  const staffIns = await svc.from('staff').insert({
    id: authUserId, email, full_name: 'TEST Tarbiyachi', role: 'tarbiyachi',
    status: 'active', faculty: 'amit', assigned_floor: 1, assigned_gender: 'male',
  })
  if (staffIns.error) throw new Error('staff insert: ' + staffIns.error.message)
  log('temp tarbiyachi created', true, authUserId)

  // --- 2. a waiting payment in faculty amit ---
  const { data: amitStudent } = await svc.from('users').select('id, full_name').eq('faculty', 'amit').eq('role', 'talaba').limit(1).maybeSingle()
  const studentId = amitStudent?.id ?? '005d251c-5116-4e1e-926f-4cdb97915743'
  const studentName = amitStudent?.full_name ?? 'TEST Student'
  const payIns = await svc.from('tolovlar').insert({
    student_id: studentId, student_name: studentName, faculty: 'amit',
    month: 'Sentabr', year: 2026, amount: 300000, status: 'waiting',
  }).select('id').single()
  if (payIns.error) throw new Error('tolovlar insert: ' + payIns.error.message)
  testPaymentId = payIns.data.id
  log('waiting payment seeded', true, testPaymentId)

  // --- 3. sign in as the tarbiyachi ---
  const signIn = await anon.auth.signInWithPassword({ email, password })
  if (signIn.error) throw new Error('signIn: ' + signIn.error.message)
  const token = signIn.data.session.access_token
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // --- 4. GET /api/admin/payments (list) ---
  const listRes = await fetch(`${BASE}/api/admin/payments`, { headers: authHeaders })
  const listBody = await listRes.json()
  log('GET payments list -> 200', listRes.status === 200, `status=${listRes.status}`)
  const sawSeeded = Array.isArray(listBody.payments) && listBody.payments.some((p) => p.id === testPaymentId)
  log('list contains the seeded waiting payment', sawSeeded, `count=${listBody.payments?.length}`)
  const otherFaculty = (listBody.payments ?? []).filter((p) => p.faculty && p.faculty !== 'amit')
  log('list is faculty-scoped (no non-amit rows)', otherFaculty.length === 0, `leaked=${otherFaculty.length}`)

  // --- 5. GET summary ---
  const sumRes = await fetch(`${BASE}/api/admin/payments?summary=1`, { headers: authHeaders })
  const sumBody = await sumRes.json()
  log('GET summary -> 200 with waitingCount>=1', sumRes.status === 200 && sumBody.waitingCount >= 1, JSON.stringify(sumBody))

  // --- 6. PATCH approve ---
  const patchRes = await fetch(`${BASE}/api/admin/payments`, {
    method: 'PATCH', headers: authHeaders,
    body: JSON.stringify({ ids: [testPaymentId], status: 'approved', message: 'TEST tasdiqlandi' }),
  })
  const patchBody = await patchRes.json().catch(() => ({}))
  log('PATCH approve -> 200', patchRes.status === 200, `status=${patchRes.status} body=${JSON.stringify(patchBody)}`)
  const { data: after } = await svc.from('tolovlar').select('status, admin_message').eq('id', testPaymentId).single()
  log('payment row is now approved', after?.status === 'approved', `status=${after?.status} msg=${after?.admin_message}`)

  // --- 7. negative: no token -> 401 ---
  const noAuthRes = await fetch(`${BASE}/api/admin/payments`)
  log('GET without token -> 401', noAuthRes.status === 401, `status=${noAuthRes.status}`)
} catch (err) {
  log('EXCEPTION', false, err.message)
} finally {
  // --- cleanup ---
  if (testPaymentId) await svc.from('tolovlar').delete().eq('id', testPaymentId)
  if (authUserId) {
    await svc.from('staff').delete().eq('id', authUserId)
    await svc.auth.admin.deleteUser(authUserId)
  }
  console.log('\ncleanup done')
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}
