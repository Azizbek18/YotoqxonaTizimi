// End-to-end smoke test for the ariza electronic signature.
//
//   node --env-file=.env.local scripts/smoke-ariza-signature.mjs [--keep]
//
// Needs a dev server on http://127.0.0.1:3000 + Supabase env vars. Creates a
// throwaway student, drives the real HTTP flow (draft -> sign -> submit ->
// receipt -> public verify), proves the signature row is append-only and a
// signed ariza can't be deleted, then removes everything.
import { createClient } from '@supabase/supabase-js'

const BASE = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const svc = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const keep = process.argv.includes('--keep')
const NUM = Date.now().toString().slice(-7)
const PW = 'Smoke1234!x'
const NAME = 'Smokov Talaba Signaturayevich'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

const trash = { authId: null, permitId: null, staffId: null, arizaId: null }

async function token(email) {
  const c = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await c.auth.signInWithPassword({ email, password: PW })
  if (error) throw new Error(`signIn ${email}: ${error.message}`)
  return data.session.access_token
}

const api = (tok) => async (path, init = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  let body = null
  try { body = await res.json() } catch { /* */ }
  return { status: res.status, body }
}

try {
  try { await fetch(`${BASE}/api/ariza-signature/verify?code=x`) }
  catch { throw new Error(`no dev server at ${BASE}`) }

  // ---- student ----
  const email = `smoke-sig-stu-${NUM}@example.com`
  const passport = `SG${NUM.slice(-5)}1`
  const jshshir = `9${NUM}0000`.slice(0, 14)
  const u = await svc.auth.admin.createUser({ email, password: PW, email_confirm: true })
  if (u.error) throw new Error(u.error.message)
  trash.authId = u.data.user.id
  const perm = await svc.from('permit_requests').insert({
    passport_series: passport, jshshir, full_name: NAME, email, phone: '+998000000000',
    gender: 'male', faculty: 'fizika', direction: 'Fizika', course: 1,
    permit_url: 'smoke/none', status: 'approved',
  }).select('id').single()
  if (perm.error) throw new Error(perm.error.message)
  trash.permitId = perm.data.id
  const ins = await svc.from('users').insert({
    id: trash.authId, email, full_name: NAME, role: 'talaba', status: 'active',
    faculty: 'fizika', direction: 'Fizika', course: 1, gender: 'male',
    passport_series: passport, jshshir,
  })
  if (ins.error) throw new Error(ins.error.message)

  const staffEmail = `smoke-sig-dekan-${NUM}@example.com`
  const st = await svc.auth.admin.createUser({ email: staffEmail, password: PW, email_confirm: true })
  trash.staffId = st.data.user.id
  await svc.from('staff').insert({ id: trash.staffId, email: staffEmail, full_name: 'SMOKE dekan', role: 'dekan', status: 'active', faculty: 'fizika' })

  const asStudent = api(await token(email))
  const asDekan = api(await token(staffEmail))
  const asPublic = api(null)

  // ---- 1. create a draft ariza ----
  let r = await asStudent('/api/student/applications', {
    method: 'POST',
    body: JSON.stringify({ type: 'ariza', title: 'Smoke ariza', reason: 'sabab', text: 'Ariza matni — asl', status: 'draft' }),
  })
  trash.arizaId = r.body?.application?.id
  check('draft ariza created', r.status === 200 && !!trash.arizaId && r.body.application.status === 'draft', JSON.stringify(r.body?.application?.status))

  // ---- 2. submit without a signature → 400 ----
  r = await asStudent('/api/student/applications', { method: 'PATCH', body: JSON.stringify({ id: trash.arizaId }) })
  check('submit without signature is rejected', r.status === 400, `status=${r.status}`)

  // ---- 3. wrong name → 400 ----
  r = await asStudent('/api/student/applications', {
    method: 'PATCH',
    body: JSON.stringify({ id: trash.arizaId, signature: { typedName: 'Boshqa Odam Boshqayev', attested: true } }),
  })
  check('submit with a mismatched name is rejected', r.status === 400, `status=${r.status}`)

  // ---- 4. correct signature → 200 + receipt ----
  r = await asStudent('/api/student/applications', {
    method: 'PATCH',
    body: JSON.stringify({ id: trash.arizaId, signature: { typedName: '  smokov   talaba  signaturayevich ', attested: true } }),
  })
  const code = r.body?.receipt?.verifyCode
  check('signed + submitted, receipt issued', r.status === 200 && r.body.application.status === 'pending' && /^YT-/.test(code || ''), `code=${code}`)

  // ---- 5. receipt endpoint ----
  r = await asStudent(`/api/student/applications/receipt?id=${trash.arizaId}`)
  check('receipt endpoint returns the same code', r.body?.receipt?.verifyCode === code, JSON.stringify(r.body?.receipt?.verifyCode))

  // ---- 6. public verify ----
  r = await asPublic(`/api/ariza-signature/verify?code=${encodeURIComponent(code)}`)
  check('public verify: valid + correct signer', r.body?.valid === true && r.body?.signedBy === NAME, JSON.stringify(r.body))

  r = await asPublic('/api/ariza-signature/verify?code=YT-ZZZZ-ZZZZ')
  check('public verify: unknown code → { valid:false }', r.body?.valid === false, JSON.stringify(r.body))

  // ---- 7. signature row is append-only ----
  const upd = await svc.from('ariza_signatures').update({ content_hash: 'tampered' }).eq('ariza_id', trash.arizaId)
  check('ariza_signatures rejects UPDATE (append-only)', !!upd.error, upd.error?.message ?? 'NO ERROR — trigger missing!')

  // ---- 8. a signed ariza can't be deleted by the student ----
  r = await asStudent(`/api/student/applications?id=${trash.arizaId}`, { method: 'DELETE' })
  check('signed ariza cannot be deleted (404)', r.status === 404, `status=${r.status}`)
  const still = await svc.from('arizalar').select('id').eq('id', trash.arizaId).maybeSingle()
  check('...and it is still in the database', !!still.data)

  // ---- 9. staff sees the signature evidence ----
  r = await asDekan(`/api/staff/ariza-signature?arizaId=${trash.arizaId}`)
  check('staff signature endpoint: signed + valid', r.body?.signed === true && r.body?.signature?.valid === true, JSON.stringify(r.body?.signature))

  // ---- 10. tamper the ariza text directly — snapshot still verifies (frozen) ----
  await svc.from('arizalar').update({ text: 'HACKED — men bunaqa yozmaganman' }).eq('id', trash.arizaId)
  r = await asPublic(`/api/ariza-signature/verify?code=${encodeURIComponent(code)}`)
  check('editing arizalar.text does not forge the signed snapshot', r.body?.valid === true, 'snapshot is the frozen source of truth')

  // ---- 11. formal composer: one-step compose + hand-drawn signature ----
  r = await asStudent('/api/student/applications/context')
  check('ariza context prefill', r.status === 200 && typeof r.body?.facultyLabel === 'string', JSON.stringify(r.body))

  const PNG = 'data:image/png;base64,' + Buffer.from('smoke-signature-strokes').toString('base64')
  r = await asStudent('/api/student/applications/formal', {
    method: 'POST',
    body: JSON.stringify({
      kind: 'tushuntirish', recipient: 'prorektor', title: 'Kechikish (smoke)',
      fullName: NAME, ttjNumber: '12', room: '305',
      incidentText: 'Bugun do‘stlarim bilan tug‘ilgan kunni nishonlab, yotoqxonaga kech qaytdim.',
      signature: { attested: true, image: PNG },
    }),
  })
  const fCode = r.body?.receipt?.verifyCode
  const fId = r.body?.application?.id
  trash.formalId = fId
  check('formal ariza: composed + signed + pending', r.status === 200 && r.body?.application?.status === 'pending' && /^YT-/.test(fCode || ''), JSON.stringify(r.body?.error || fCode))

  const ftext = (await svc.from('arizalar').select('text').eq('id', fId).maybeSingle()).data?.text ?? ''
  check('formal text is the UzMU template', ftext.includes('12-sonli talabalar turar joyining 305-xonasida') && ftext.includes('T U S H U N T I R I S H'), ftext.slice(0, 80))

  r = await asPublic(`/api/ariza-signature/verify?code=${encodeURIComponent(fCode)}`)
  check('formal verify: valid + signature image returned', r.body?.valid === true && typeof r.body?.signatureImage === 'string', JSON.stringify({ valid: r.body?.valid, img: !!r.body?.signatureImage }))

  r = await asStudent(`/api/student/applications/document?id=${fId}`)
  check('document endpoint returns formal fields + image', r.body?.formal?.recipient === 'prorektor' && r.body?.signatureImage === PNG, JSON.stringify(r.body?.formal))

  r = await asDekan(`/api/staff/ariza-signature?arizaId=${fId}&document=1`)
  check('staff document endpoint', r.body?.formal?.recipient === 'prorektor', JSON.stringify(r.body?.error || 'ok'))

  // ---- 12. student Telegram link issue ----
  r = await asStudent('/api/student/telegram-link', { method: 'POST' })
  check('telegram link: unlinked + deep link (or not configured)',
    r.status === 200 && (r.body?.linked === false),
    JSON.stringify(r.body))
} catch (err) {
  check('EXCEPTION', false, err.message)
} finally {
  if (!keep) {
    if (trash.arizaId) await svc.from('ariza_signatures').delete().eq('ariza_id', trash.arizaId)
    if (trash.formalId) await svc.from('ariza_signatures').delete().eq('ariza_id', trash.formalId)
    if (trash.arizaId) await svc.from('arizalar').delete().eq('id', trash.arizaId)
    if (trash.formalId) await svc.from('arizalar').delete().eq('id', trash.formalId)
    if (trash.authId) await svc.from('student_telegram_links').delete().eq('student_id', trash.authId)
    if (trash.authId) await svc.from('arizalar').delete().eq('student_id', trash.authId)
    if (trash.authId) await svc.from('users').delete().eq('id', trash.authId)
    if (trash.permitId) await svc.from('permit_requests').delete().eq('id', trash.permitId)
    if (trash.staffId) await svc.from('staff').delete().eq('id', trash.staffId)
    for (const id of [trash.authId, trash.staffId]) if (id) await svc.auth.admin.deleteUser(id).catch(() => {})
    console.log('\ncleanup done')
  }
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}
