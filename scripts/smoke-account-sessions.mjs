// Smoke test for the "connected devices" feature.
//   node --env-file=.env.local scripts/smoke-account-sessions.mjs
// Needs a dev server on http://127.0.0.1:3000 + Supabase env vars.
import { createClient } from '@supabase/supabase-js'

const BASE = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const svc = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const PW = 'Smoke1234!x'
const NUM = Date.now().toString().slice(-7)

const results = []
const check = (n, ok, d = '') => { results.push({ n, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }
let authId = null

const api = (tok) => async (path, init = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${tok}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
  })
  let body = null
  try { body = await res.json() } catch { /* */ }
  return { status: res.status, body }
}

async function signIn(email, ua) {
  const c = createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { 'User-Agent': ua } },
  })
  const { data, error } = await c.auth.signInWithPassword({ email, password: PW })
  if (error) throw new Error(error.message)
  return data.session.access_token
}

try {
  try { await fetch(`${BASE}/api/account/sessions`) } catch { throw new Error(`no dev server at ${BASE}`) }

  const email = `smoke-sess-${NUM}@example.com`
  const u = await svc.auth.admin.createUser({ email, password: PW, email_confirm: true })
  if (u.error) throw new Error(u.error.message)
  authId = u.data.user.id
  await svc.from('users').insert({ id: authId, email, full_name: 'SMOKE Sessions', role: 'talaba', status: 'active' })

  const tokA = await signIn(email, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537')
  const tokB = await signIn(email, 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537')

  const asA = api(tokA)
  const asB = api(tokB)

  // ---- unauth ----
  let r = await fetch(`${BASE}/api/account/sessions`)
  check('GET without a token → 401', r.status === 401, `status=${r.status}`)

  // ---- list ----
  r = await asA('/api/account/sessions')
  const list = r.body?.sessions ?? []
  const mine = list.find((s) => s.current)
  check('A sees >=2 sessions, exactly one marked current', list.length >= 2 && list.filter((s) => s.current).length === 1, `n=${list.length}`)
  check('user-agent parsed (Chrome / Windows or Android)', /Chrome/.test(mine?.browser || '') && /Windows|Android/.test(mine?.os || ''), JSON.stringify({ b: mine?.browser, o: mine?.os }))

  // ---- can't revoke current from here ----
  r = await asA('/api/account/sessions', { method: 'POST', body: JSON.stringify({ action: 'revoke', sessionId: mine.id }) })
  check('revoking the current session is refused (400)', r.status === 400, `status=${r.status}`)

  // ---- revoke the other one ----
  const other = list.find((s) => !s.current)
  r = await asA('/api/account/sessions', { method: 'POST', body: JSON.stringify({ action: 'revoke', sessionId: other.id }) })
  check('revoke another session → ok', r.status === 200 && r.body?.ok === true, JSON.stringify(r.body))

  // B's refresh token is now gone
  const bClient = createClient(url, anon, { auth: { persistSession: false } })
  const refreshed = await bClient.auth.refreshSession({ refresh_token: 'x' }).catch(() => null)
  // (can't easily test B's exact refresh token here; assert the row is gone instead)
  const rows = await svc.rpc('list_user_sessions', { p_user_id: authId })
  check('session row is deleted', (rows.data ?? []).length === 1, `n=${(rows.data ?? []).length}`)

  // ---- revoke-others ----
  await signIn(email, 'Mozilla/5.0 (iPhone) Safari/604')
  await signIn(email, 'Mozilla/5.0 (Macintosh) Safari/605')
  r = await asA('/api/account/sessions', { method: 'POST', body: JSON.stringify({ action: 'revoke-others' }) })
  check('revoke-others removes every session but the caller', r.status === 200 && r.body?.revoked >= 2, JSON.stringify(r.body))
  const after = await svc.rpc('list_user_sessions', { p_user_id: authId })
  check('only the caller session remains', (after.data ?? []).length === 1)

  // ---- a foreign session id is a no-op, never an error ----
  r = await asA('/api/account/sessions', { method: 'POST', body: JSON.stringify({ action: 'revoke', sessionId: '00000000-0000-0000-0000-000000000000' }) })
  check('revoking an unknown session → ok:false, not 500', r.status === 200 && r.body?.ok === false, JSON.stringify(r.body))
  void refreshed
} catch (err) {
  check('EXCEPTION', false, err.message)
} finally {
  if (authId) {
    await svc.from('users').delete().eq('id', authId)
    await svc.auth.admin.deleteUser(authId).catch(() => {})
  }
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}
