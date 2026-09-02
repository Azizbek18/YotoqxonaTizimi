// End-to-end smoke test for blacklist enforcement (commit 31614b6).
//
//   node --env-file=.env.local scripts/smoke-blacklist.mjs
//   SMOKE_BASE_URL=https://www.meningyotoqxonam.uz node --env-file=.env.local scripts/smoke-blacklist.mjs
//
// Creates a throwaway active student, proves the student APIs work, sets
// users.blacklisted = true, proves every MUTATING/read student API now 403s
// with code BLACKLISTED while the read-only profile GET still returns 200,
// then deletes everything.
import { createClient } from '@supabase/supabase-js'

const BASE = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const svc = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const NUM = Date.now().toString().slice(-7)
const PW = 'Smoke1234!x'
const NAME = 'Blackov Talaba Listovich'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

const trash = { authId: null, permitId: null }

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
  catch { throw new Error(`no server at ${BASE}`) }

  const email = `smoke-bl-stu-${NUM}@example.com`
  const passport = `BL${NUM.slice(-5)}1`
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

  const asStudent = api(await token(email))

  // ---- baseline: an active student can use the APIs ----
  let r = await asStudent('/api/student/profile')
  check('active student: profile GET 200', r.status === 200, `status=${r.status}`)
  r = await asStudent('/api/student/payments')
  check('active student: payments GET 200', r.status === 200, `status=${r.status}`)
  r = await asStudent('/api/student/applications', {
    method: 'POST',
    body: JSON.stringify({ type: 'ariza', title: 'Smoke', reason: 'sabab', text: 'matn matni', status: 'draft' }),
  })
  const draftId = r.body?.application?.id
  check('active student: create draft ariza 200', r.status === 200 && !!draftId, `status=${r.status}`)
  if (draftId) await svc.from('arizalar').delete().eq('id', draftId)

  // ---- blacklist the student ----
  const bl = await svc.from('users').update({ blacklisted: true }).eq('id', trash.authId)
  if (bl.error) throw new Error(`blacklist: ${bl.error.message}`)

  // token is still valid (JWT), the guard reads the fresh users row
  const isBlacklisted403 = (res) =>
    res.status === 403 && res.body?.code === 'BLACKLISTED'

  r = await asStudent('/api/student/profile')
  check('blacklisted: profile GET still 200 (read-only carve-out)', r.status === 200, `status=${r.status}`)

  r = await asStudent('/api/student/payments')
  check('blacklisted: payments GET → 403 BLACKLISTED', isBlacklisted403(r), `status=${r.status} code=${r.body?.code}`)

  r = await asStudent('/api/student/cleaning-schedule')
  check('blacklisted: cleaning-schedule GET → 403 BLACKLISTED', isBlacklisted403(r), `status=${r.status} code=${r.body?.code}`)

  r = await asStudent('/api/student/applications', {
    method: 'POST',
    body: JSON.stringify({ type: 'ariza', title: 'x', reason: 'y', text: 'zzzzz', status: 'draft' }),
  })
  check('blacklisted: create ariza → 403 BLACKLISTED', isBlacklisted403(r), `status=${r.status} code=${r.body?.code}`)

  r = await asStudent('/api/ai/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'salom' }] }) })
  check('blacklisted: AI chat → 403 BLACKLISTED', isBlacklisted403(r), `status=${r.status} code=${r.body?.code}`)
} catch (err) {
  check('smoke run', false, err.message)
} finally {
  if (trash.authId) {
    await svc.from('arizalar').delete().eq('student_id', trash.authId)
    await svc.from('users').delete().eq('id', trash.authId)
    await svc.auth.admin.deleteUser(trash.authId).catch(() => {})
  }
  if (trash.permitId) await svc.from('permit_requests').delete().eq('id', trash.permitId)
  const failed = results.filter((x) => !x.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}
