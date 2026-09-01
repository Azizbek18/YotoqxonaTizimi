// End-to-end smoke test for the yo'qlama (attendance) feature.
//
//   node --env-file=.env.local scripts/smoke-attendance.mjs [--keep]
//
// Spins up a throwaway building (faculty `fizika`, which has no real
// faculty_dorm row), a sardor + tarbiyachi + dekan + 4 residents, then
// drives the REAL HTTP API on http://127.0.0.1:3000 with signed-in tokens:
// sardor opens a session and marks, scope is enforced, the tarbiyachi
// promotes a flag to a warning, the dekan is read-only, and a student
// self-checks-in by location. Everything is deleted at the end.
//
// Needs a dev server running (npm run dev) + NEXT_PUBLIC_SUPABASE_URL,
// NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from '@supabase/supabase-js'

const BASE = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const svc = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const keep = process.argv.includes('--keep')

const DORM = { lat: 41.311081, lng: 69.240562 }
const FAR = { lat: 41.5, lng: 69.5 } // ~28 km away
const NUM = `SMOKE-${Date.now().toString().slice(-6)}`
const PW = 'Smoke1234!x'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

const trash = { authUsers: [], studentIds: [], permitIds: [], dormId: null }

let seq = 0
async function mkStaff(role, faculty) {
  seq += 1
  const email = `smoke-att-${role}-${NUM}-${seq}@example.com`
  const { data, error } = await svc.auth.admin.createUser({ email, password: PW, email_confirm: true })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  trash.authUsers.push(data.user.id)
  const ins = await svc.from('staff').insert({
    id: data.user.id, email, full_name: `SMOKE ${role}`, role, status: 'active', faculty,
  })
  if (ins.error) throw new Error(`staff insert ${email}: ${ins.error.message}`)
  return { id: data.user.id, email }
}

async function mkStudent({ floor, room, captain = false }) {
  seq += 1
  const email = `smoke-att-stu-${NUM}-${seq}@example.com`
  const passport = `SA${NUM.slice(-4)}${seq}`
  const jshshir = `9${NUM.slice(-6)}${seq}0000`.slice(0, 14)
  const { data, error } = await svc.auth.admin.createUser({ email, password: PW, email_confirm: true })
  if (error) throw new Error(`createUser student: ${error.message}`)
  trash.authUsers.push(data.user.id)
  trash.studentIds.push(data.user.id)
  const perm = await svc.from('permit_requests').insert({
    passport_series: passport, jshshir, full_name: `SMOKE stu ${seq}`,
    email, phone: '+998000000000', gender: 'male', faculty: 'fizika', direction: 'Fizika',
    course: 1, permit_url: 'smoke/none', status: 'approved',
  }).select('id').single()
  if (perm.error) throw new Error(`permit insert: ${perm.error.message}`)
  trash.permitIds.push(perm.data.id)
  const ins = await svc.from('users').insert({
    id: data.user.id, email, full_name: `SMOKE stu ${seq}`, role: 'talaba', status: 'active',
    faculty: 'fizika', direction: 'Fizika', course: 1, gender: 'male',
    passport_series: passport, jshshir,
    dorm_id: trash.dormId, assigned_floor: floor, room_number: room,
    is_floor_captain: captain,
  })
  if (ins.error) throw new Error(`user insert: ${ins.error.message}`)
  return data.user.id
}

async function token(email) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword({ email, password: PW })
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
  try { body = await res.json() } catch { /* ignore */ }
  return { status: res.status, body }
}

try {
  // ---- server up? ----
  try {
    await fetch(`${BASE}/api/attendance/cron`, { method: 'POST' })
  } catch {
    throw new Error(`no dev server at ${BASE} — run "npm run dev" first`)
  }

  // ---- 1. building + geo config ----
  const dormIns = await svc.from('dorms').insert({
    number: NUM, name: 'SMOKE yo\'qlama bino', floor_count: 5,
    latitude: DORM.lat, longitude: DORM.lng, checkin_radius_m: 1000,
    attendance_enabled: true, attendance_open_time: '21:00', attendance_close_time: '23:00',
  }).select('id').single()
  if (dormIns.error) throw new Error(`dorm: ${dormIns.error.message}`)
  trash.dormId = dormIns.data.id
  await svc.from('faculty_dorm').insert({ faculty: 'fizika', dorm_id: trash.dormId })
  check('throwaway dorm + geo config created', true, NUM)

  // ---- 2. people ----
  const tarbiyachi = await mkStaff('tarbiyachi', 'fizika')
  await svc.from('staff').update({ dorm_id: trash.dormId, assigned_gender: 'male' }).eq('id', tarbiyachi.id)
  const dekan = await mkStaff('dekan', 'fizika')
  await svc.from('staff').update({ dorm_id: trash.dormId }).eq('id', dekan.id)

  const sardorId = await mkStudent({ floor: 2, room: '201', captain: true })
  const stuA = await mkStudent({ floor: 2, room: '201' })
  const stuB = await mkStudent({ floor: 2, room: '202' })
  const stuC = await mkStudent({ floor: 3, room: '301' }) // different floor — outside sardor scope
  check('sardor + 3 residents (2 on floor 2, 1 on floor 3)', true)

  const tok = {
    sardor: await token((await svc.from('users').select('email').eq('id', sardorId).single()).data.email),
    tarbiyachi: await token(tarbiyachi.email),
    dekan: await token(dekan.email),
    stuA: await token((await svc.from('users').select('email').eq('id', stuA).single()).data.email),
    stuB: await token((await svc.from('users').select('email').eq('id', stuB).single()).data.email),
  }
  const asSardor = api(tok.sardor)
  const asTarbiyachi = api(tok.tarbiyachi)
  const asDekan = api(tok.dekan)

  // ---- 3. sardor: no session yet, then open ad-hoc ----
  let r = await asSardor('/api/attendance/session')
  check('sardor GET session → empty', r.status === 200 && Array.isArray(r.body?.sessions) && r.body.sessions.length === 0, JSON.stringify(r.body))

  r = await asSardor('/api/attendance/session', { method: 'POST' })
  const roster = r.body
  const sessionId = roster?.session?.id
  const rooms = (roster?.rooms ?? []).map((x) => x.roomNumber).sort()
  check('sardor opens ad-hoc → roster for own floor only',
    r.status === 200 && roster?.canWrite === true && roster?.summary?.total === 3
      && JSON.stringify(rooms) === '["201","202"]',
    `total=${roster?.summary?.total} rooms=${JSON.stringify(rooms)}`)

  // ---- 4. mark + scope ----
  r = await asSardor('/api/attendance/mark', { method: 'PATCH', body: JSON.stringify({ sessionId, studentId: stuA, state: 'absent' }) })
  check('sardor marks stuA absent', r.status === 200, `status=${r.status} ${JSON.stringify(r.body)}`)

  r = await asSardor('/api/attendance/mark', { method: 'PATCH', body: JSON.stringify({ sessionId, studentId: stuC, state: 'present' }) })
  check('sardor cannot mark a floor-3 student (403)', r.status === 403, `status=${r.status}`)

  r = await asSardor(`/api/attendance/roster?sessionId=${sessionId}`)
  const recA = r.body?.rooms?.flatMap((x) => x.residents).find((x) => x.id === stuA)
  check('roster reflects stuA = absent + soft flag', recA?.state === 'absent', JSON.stringify(recA))

  // ---- 5. dekan is read-only ----
  r = await asDekan(`/api/attendance/roster?sessionId=${sessionId}`)
  check('dekan sees roster, canWrite=false', r.status === 200 && r.body?.canWrite === false, `status=${r.status} canWrite=${r.body?.canWrite}`)
  r = await asDekan('/api/attendance/mark', { method: 'PATCH', body: JSON.stringify({ sessionId, studentId: stuA, state: 'present' }) })
  check('dekan mark → 403', r.status === 403, `status=${r.status}`)

  // ---- 6. tarbiyachi: whole building + promote flag to warning ----
  r = await asTarbiyachi('/api/attendance/flags')
  const flag = (r.body?.flags ?? []).find((f) => f.studentId === stuA)
  check('tarbiyachi sees stuA in the flag queue', Boolean(flag), JSON.stringify(r.body?.flags))

  const before = (await svc.from('users').select('warning_count').eq('id', stuA).single()).data?.warning_count ?? 0
  r = await asTarbiyachi('/api/attendance/flags', { method: 'POST', body: JSON.stringify({ recordId: flag?.recordId, action: 'warn' }) })
  const after = (await svc.from('users').select('warning_count').eq('id', stuA).single()).data?.warning_count ?? 0
  check('promote flag → warning issued, warning_count +1', r.status === 200 && after === before + 1, `${before} → ${after}`)

  r = await asTarbiyachi('/api/attendance/flags')
  check('flag cleared after warning', !(r.body?.flags ?? []).some((f) => f.studentId === stuA))

  // close the ad-hoc session so it doesn't collide with the nightly one
  await asSardor('/api/attendance/close', { method: 'POST', body: JSON.stringify({ sessionId }) })

  // ---- 7. Phase 2: student self check-in by location ----
  const closesAt = new Date(Date.now() + 2 * 3600_000).toISOString()
  const nightlyIns = await svc.from('attendance_sessions').insert({
    dorm_id: trash.dormId, scheduled_for: new Date().toISOString().slice(0, 10),
    kind: 'nightly', gender: null, floor_number: null, closes_at: closesAt,
  }).select('id').single()
  if (nightlyIns.error) throw new Error(`nightly session: ${nightlyIns.error.message}`)

  const asStuA = api(tok.stuA)
  const asStuB = api(tok.stuB)

  r = await asStuA('/api/attendance/checkin', { method: 'POST', body: JSON.stringify({ lat: DORM.lat, lng: DORM.lng, accuracy: 20 }) })
  check('stuA at the dorm → present', r.body?.status === 'present' && r.body?.distanceM < 1000, JSON.stringify(r.body))

  r = await asStuB('/api/attendance/checkin', { method: 'POST', body: JSON.stringify({ lat: FAR.lat, lng: FAR.lng, accuracy: 20 }) })
  check('stuB 28 km away → outside', r.body?.status === 'outside' && r.body?.distanceM > 20000, JSON.stringify(r.body))

  r = await asStuA('/api/attendance/checkin', { method: 'POST', body: JSON.stringify({ lat: DORM.lat, lng: DORM.lng, accuracy: 20 }) })
  check('stuA taps again → still present (idempotent)', r.body?.status === 'present', JSON.stringify(r.body))

  r = await asStuA('/api/attendance/checkin', { method: 'POST', body: JSON.stringify({ lat: DORM.lat, lng: DORM.lng, accuracy: 9000 }) })
  check('poor GPS accuracy → retry', r.body?.status === 'retry', JSON.stringify(r.body))

  // ---- 8. cron auth ----
  r = await api(null)('/api/attendance/cron', { method: 'POST' })
  check('cron without secret → 401', r.status === 401, `status=${r.status}`)
  r = await api(null)('/api/attendance/cron', { method: 'POST', headers: { Authorization: 'Bearer nope' } })
  check('cron with wrong secret → 401', r.status === 401, `status=${r.status}`)

  // ---- 9. records in the DB ----
  const { data: recs } = await svc.from('attendance_records').select('state, source')
    .eq('session_id', nightlyIns.data.id)
  const present = recs.filter((x) => x.state === 'present').length
  check('nightly session has self_location records', recs.some((x) => x.source === 'self_location') && present >= 1, JSON.stringify(recs))
} catch (err) {
  check('EXCEPTION', false, err.message)
} finally {
  if (!keep && trash.dormId) {
    await svc.from('attendance_sessions').delete().eq('dorm_id', trash.dormId)
    await svc.from('arizalar').delete().in('student_id', trash.studentIds)
    await svc.from('users').delete().in('id', trash.studentIds)
    if (trash.permitIds.length) await svc.from('permit_requests').delete().in('id', trash.permitIds)
    await svc.from('staff').update({ dorm_id: null }).eq('dorm_id', trash.dormId)
    await svc.from('faculty_dorm').delete().eq('dorm_id', trash.dormId)
    await svc.from('dorms').delete().eq('id', trash.dormId)
    for (const id of trash.authUsers) {
      await svc.from('staff').delete().eq('id', id)
      await svc.auth.admin.deleteUser(id).catch(() => {})
    }
    console.log('\ncleanup done')
  } else if (keep) {
    console.log('\n--keep: left dorm', trash.dormId)
  }
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}
