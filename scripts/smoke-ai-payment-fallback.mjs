// End-to-end smoke test for the payment flow when every AI provider is down.
// Creates a throwaway active student, calls both HTTP endpoints with the same
// receipt, verifies the atomic manual-review row, checks replay/tamper/auth
// failures, and removes every auth/database/storage object it created.
//
// Start the app with GROQ_API_KEY, GEMINI_API_KEY and AI_GATEWAY_API_KEY empty,
// then run:
//   npm run smoke:ai-fallback
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const base = process.env.APP_TEST_BASE_URL ?? 'http://127.0.0.1:3000'
if (!url || !serviceKey || !anonKey) throw new Error('Supabase environment variables are missing')

const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`
const email = `tmp-ai-fallback-${stamp}@example.com`
const password = `Tmp-${randomBytes(16).toString('base64url')}!9a`
const passport = `AF${randomBytes(4).toString('hex').toUpperCase()}`
const jshshir = `9${randomBytes(8).readBigUInt64BE().toString().padStart(20, '0').slice(0, 13)}`
const faculty = 'amit'
const month = 'Sentabr'
const year = 2099
const checks = []
let userId = null
let permitId = null
let receiptHash = null

function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition) })
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ''}`)
}

function pngFile(bytes, name = 'receipt.png') {
  return new File([bytes], name, { type: 'image/png' })
}

function paymentForm(bytes, amount, claim) {
  const form = new FormData()
  form.set('file', pngFile(bytes))
  form.set('amount', String(amount))
  form.set('year', String(year))
  form.set('months', JSON.stringify([month]))
  form.set('validatedHash', claim)
  return form
}

try {
  const { data: feeRow, error: feeError } = await service
    .from('app_settings')
    .select('monthly_fee')
    .eq('faculty', faculty)
    .maybeSingle()
  if (feeError) throw feeError
  const amount = Number(feeRow?.monthly_fee ?? 300000)

  const created = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error) throw created.error
  userId = created.data.user.id

  const permit = await service.from('permit_requests').insert({
    passport_series: passport,
    jshshir,
    full_name: 'TEMP AI Fallback Student',
    email,
    phone: '+998000000000',
    gender: 'male',
    faculty,
    direction: 'Axborot tizimlari va texnologiyalari',
    course: 1,
    permit_url: 'smoke/ai-fallback',
    status: 'approved',
  }).select('id').single()
  if (permit.error) throw permit.error
  permitId = permit.data.id

  const profile = await service.from('users').insert({
    id: userId,
    email,
    full_name: 'TEMP AI Fallback Student',
    role: 'talaba',
    status: 'active',
    faculty,
    gender: 'male',
    passport_series: passport,
    jshshir,
  })
  if (profile.error) throw profile.error
  check('temporary active student created', true, userId)

  const signedIn = await anon.auth.signInWithPassword({ email, password })
  if (signedIn.error) throw signedIn.error
  const token = signedIn.data.session.access_token
  const headers = { Authorization: `Bearer ${token}` }

  const receipt = new Uint8Array(64)
  receipt.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  receipt.set(randomBytes(56), 8)

  const precheckForm = new FormData()
  precheckForm.set('file', pngFile(receipt))
  precheckForm.set('amount', String(amount))
  const precheckResponse = await fetch(`${base}/api/ai/tekshiruv`, {
    method: 'POST', headers, body: precheckForm,
  })
  const precheck = await precheckResponse.json()
  check('AI-down precheck returns 200', precheckResponse.status === 200, `status=${precheckResponse.status}`)
  check('precheck returns a manual-review claim', precheck.aiSkipped === true && precheck.valid === true && typeof precheck.claim === 'string')
  check('manual precheck has no invented transaction id', precheck.transaction_id === null)
  receiptHash = precheck.file_hash

  const submitResponse = await fetch(`${base}/api/student/payments`, {
    method: 'POST', headers, body: paymentForm(receipt, amount, precheck.claim),
  })
  const submit = await submitResponse.json()
  check('manual payment submission returns 201', submitResponse.status === 201, `status=${submitResponse.status} body=${JSON.stringify(submit)}`)
  check('one payment record is returned', Array.isArray(submit.records) && submit.records.length === 1)

  const { data: rows, error: rowError } = await service
    .from('tolovlar')
    .select('id, ai_review, transaction_id, receipt_hash, status')
    .eq('student_id', userId)
  if (rowError) throw rowError
  check('database row is atomically marked manual', rows?.length === 1 && rows[0].ai_review === 'manual')
  check('manual row stores no transaction id', rows?.[0]?.transaction_id === null)
  check('manual row keeps the exact receipt hash', rows?.[0]?.receipt_hash === receiptHash)

  const txReservation = await service
    .from('payment_receipt_transactions')
    .select('receipt_hash')
    .eq('receipt_hash', receiptHash)
  if (txReservation.error) throw txReservation.error
  check('manual receipt does not reserve a fabricated transaction id', txReservation.data.length === 0)

  const replayResponse = await fetch(`${base}/api/student/payments`, {
    method: 'POST', headers, body: paymentForm(receipt, amount, precheck.claim),
  })
  check('exact receipt replay is rejected', replayResponse.status === 409, `status=${replayResponse.status}`)

  const tampered = new Uint8Array(receipt)
  tampered[tampered.length - 1] ^= 0xff
  const tamperResponse = await fetch(`${base}/api/student/payments`, {
    method: 'POST', headers, body: paymentForm(tampered, amount, precheck.claim),
  })
  check('claim cannot be reused with a different file', tamperResponse.status === 400, `status=${tamperResponse.status}`)

  const unauthenticatedResponse = await fetch(`${base}/api/student/payments`, {
    method: 'POST', body: paymentForm(tampered, amount, precheck.claim),
  })
  check('unauthenticated payment submission is rejected', unauthenticatedResponse.status === 401, `status=${unauthenticatedResponse.status}`)
} catch (error) {
  console.error('FAIL  smoke test exception —', error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  if (userId) {
    const uploads = await service
      .from('payment_receipt_uploads')
      .select('object_path')
      .eq('student_id', userId)
    const paths = (uploads.data ?? []).map((row) => row.object_path).filter(Boolean)
    if (paths.length > 0) await service.storage.from('receipts').remove(paths)
    await service.from('tolovlar').delete().eq('student_id', userId)
    await service.from('payment_receipt_uploads').delete().eq('student_id', userId)
    await service.from('users').delete().eq('id', userId)
  }
  if (permitId) await service.from('permit_requests').delete().eq('id', permitId)
  if (userId) await service.auth.admin.deleteUser(userId)
  console.log('cleanup done')
  const passed = checks.filter((item) => item.ok).length
  console.log(`${passed}/${checks.length} checks passed`)
}
