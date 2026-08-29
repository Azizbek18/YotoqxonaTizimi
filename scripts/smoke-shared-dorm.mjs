// End-to-end smoke test for shared-dorm tenancy (P0–P5).
// Creates a throwaway building shared by two test faculties (fizika +
// sport), drives the full floor handshake, room layout, assignment, and
// tarbiyachi scoping, asserts the isolation, then deletes everything.
//
//   node --env-file=.env.local scripts/smoke-shared-dorm.mjs [--keep]
//
// Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Runs entirely
// through the service client (same layer the API routes use), so it
// exercises the RPCs and repositories, not the HTTP surface.
import { createClient } from '@supabase/supabase-js'

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)
const keep = process.argv.includes('--keep')

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}
const trash = { authUsers: [], dormId: null, studentIds: [] }

const NUM = `SMOKE-${Date.now().toString().slice(-6)}`
const mkStaff = async (email, role, faculty) => {
  const { data, error } = await svc.auth.admin.createUser({ email, password: 'Smoke1234!x', email_confirm: true })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  trash.authUsers.push(data.user.id)
  const ins = await svc.from('staff').insert({
    id: data.user.id, email, full_name: `SMOKE ${role}`, role,
    status: 'active', faculty,
  })
  if (ins.error) throw new Error(`staff insert ${email}: ${ins.error.message}`)
  return data.user.id
}
let stuSeq = 0
const mkStudent = async (faculty, gender) => {
  stuSeq += 1
  const email = `smoke-stu-${faculty}-${Math.random().toString(36).slice(2, 8)}@example.com`
  const passport = `SM${NUM.slice(-4)}${stuSeq}`
  const jshshir = `9${NUM.slice(-6)}${stuSeq}00`.slice(0, 14)
  const { data, error } = await svc.auth.admin.createUser({ email, password: 'Smoke1234!x', email_confirm: true })
  if (error) throw new Error(`createUser student: ${error.message}`)
  trash.authUsers.push(data.user.id)
  trash.studentIds.push(data.user.id)
  // check_student_permit_approved trigger needs a matching approved permit
  const perm = await svc.from('permit_requests').insert({
    passport_series: passport, jshshir, full_name: `SMOKE ${faculty} ${gender}`,
    email, phone: '+998000000000', gender, faculty, direction: 'Fizika', course: 1,
    permit_url: 'smoke/none', status: 'approved',
  }).select('id').single()
  if (perm.error) throw new Error(`permit insert: ${perm.error.message}`)
  trash.permitIds ??= []
  trash.permitIds.push(perm.data.id)
  const ins = await svc.from('users').insert({
    id: data.user.id, email, full_name: `SMOKE ${faculty} ${gender}`, role: 'talaba',
    status: 'active', faculty, gender, passport_series: passport, jshshir,
  })
  if (ins.error) throw new Error(`user insert: ${ins.error.message}`)
  return data.user.id
}

try {
  // ---- 1. two dekans, one new building ----
  const fizikaDekan = await mkStaff(`smoke-dekan-fizika-${NUM}@example.com`, 'dekan', 'fizika')
  const sportDekan = await mkStaff(`smoke-dekan-sport-${NUM}@example.com`, 'dekan', 'sport')

  const dormIns = await svc.from('dorms').insert({ number: NUM, name: 'SMOKE bino', floor_count: 6 }).select('id').single()
  if (dormIns.error) throw new Error(`dorm: ${dormIns.error.message}`)
  trash.dormId = dormIns.data.id
  const dormId = trash.dormId
  await svc.from('staff').update({ dorm_id: dormId }).in('id', [fizikaDekan, sportDekan])
  await svc.from('faculty_dorm').insert([
    { faculty: 'fizika', dorm_id: dormId },
    { faculty: 'sport', dorm_id: dormId },
  ])
  check('two faculties mapped to one dorm', true, NUM)

  // ---- 2. fizika claims 1–3 (auto-confirm — first with no co-confirmed) ----
  let r = await svc.rpc('dorm_claim_floors', { p_dorm_id: dormId, p_faculty: 'fizika', p_floors: [1, 2, 3], p_staff_id: fizikaDekan })
  if (r.error) throw new Error(`claim fizika: ${r.error.message}`)
  check('fizika claim floors 1-3 auto-confirms', JSON.stringify(r.data.confirmed) === '[1,2,3]', JSON.stringify(r.data))

  // ---- 3. sport proposes 4–5 (needs fizika's confirmation) ----
  r = await svc.rpc('dorm_claim_floors', { p_dorm_id: dormId, p_faculty: 'sport', p_floors: [4, 5], p_staff_id: sportDekan })
  if (r.error) throw new Error(`claim sport: ${r.error.message}`)
  check('sport claim floors 4-5 goes pending', JSON.stringify(r.data.proposed) === '[4,5]', JSON.stringify(r.data))

  // sport cannot draw a layout on a floor it hasn't got confirmed
  r = await svc.rpc('replace_floor_room_layout', {
    p_faculty: 'sport', p_floor_number: 4,
    p_rows: [{ roomNumber: '401', side: 'left', position: 0, size: 'medium' }],
  })
  check('sport blocked from drawing an unconfirmed floor', r.error?.code === 'P0007', r.error?.code ?? 'no error')

  // ---- 4. fizika confirms 4 and 5 ----
  for (const f of [4, 5]) {
    r = await svc.rpc('dorm_resolve_floor', { p_dorm_id: dormId, p_floor: f, p_staff_id: fizikaDekan, p_accept: true })
    if (r.error) throw new Error(`resolve ${f}: ${r.error.message}`)
  }
  const floorsAfter = await svc.from('dorm_floor').select('floor_number, faculty, pending_faculty').eq('dorm_id', dormId).order('floor_number')
  const owned = Object.fromEntries((floorsAfter.data ?? []).map((x) => [x.floor_number, x.faculty]))
  check('floors partitioned fizika 1-3 / sport 4-5',
    owned[1] === 'fizika' && owned[3] === 'fizika' && owned[4] === 'sport' && owned[5] === 'sport'
      && (floorsAfter.data ?? []).every((x) => !x.pending_faculty),
    JSON.stringify(owned))

  // ---- 5. layouts on each side ----
  r = await svc.rpc('replace_floor_room_layout', {
    p_faculty: 'fizika', p_floor_number: 2,
    p_rows: [{ roomNumber: 'F201', side: 'left', position: 0, size: 'medium' }, { roomNumber: 'F202', side: 'right', position: 0, size: 'medium' }],
  })
  if (r.error) throw new Error(`fizika layout: ${r.error.message}`)
  r = await svc.rpc('replace_floor_room_layout', {
    p_faculty: 'sport', p_floor_number: 4,
    p_rows: [{ roomNumber: 'S401', side: 'left', position: 0, size: 'medium' }],
  })
  if (r.error) throw new Error(`sport layout: ${r.error.message}`)
  check('both faculties draw their own floors', true)

  // ---- 6. assignment + cross-faculty rejection ----
  const fStu = await mkStudent('fizika', 'male')
  const sStu = await mkStudent('sport', 'female')

  r = await svc.rpc('assign_student_room_atomic', { p_student_id: fStu, p_room_number: 'F201', p_max_capacity: 4 })
  check('fizika student -> fizika room', !r.error, r.error?.message ?? 'ok')

  r = await svc.rpc('assign_student_room_atomic', { p_student_id: sStu, p_room_number: 'F201', p_max_capacity: 4 })
  check('sport student -> fizika room is rejected (P0007)', r.error?.code === 'P0007', r.error?.code ?? 'no error')

  r = await svc.rpc('assign_student_room_atomic', { p_student_id: sStu, p_room_number: 'S401', p_max_capacity: 4 })
  check('sport student -> sport room', !r.error, r.error?.message ?? 'ok')

  const fStuRow = await svc.from('users').select('dorm_id, assigned_floor').eq('id', fStu).single()
  check('placement sets dorm_id + assigned_floor', fStuRow.data.dorm_id === dormId && fStuRow.data.assigned_floor === 2, JSON.stringify(fStuRow.data))

  // ---- 7. tarbiyachi sees the whole building ----
  const tarbiyachi = await mkStaff(`smoke-tarbiyachi-${NUM}@example.com`, 'tarbiyachi', 'fizika')
  await svc.from('staff').update({ dorm_id: dormId }).eq('id', tarbiyachi)
  const { data: dormFacs } = await svc.from('faculty_dorm').select('faculty').eq('dorm_id', dormId)
  const facList = (dormFacs ?? []).map((x) => x.faculty).sort()
  check('tarbiyachi dorm faculties = both', JSON.stringify(facList) === '["fizika","sport"]', JSON.stringify(facList))

  // seed a waiting payment for each faculty, check the tarbiyachi query spans both
  await svc.from('tolovlar').insert([
    { student_id: fStu, student_name: 'F', faculty: 'fizika', month: 'Sentabr', year: 2026, amount: 300000, status: 'waiting' },
    { student_id: sStu, student_name: 'S', faculty: 'sport', month: 'Sentabr', year: 2026, amount: 300000, status: 'waiting' },
  ])
  const { count: waiting } = await svc.from('tolovlar').select('id', { count: 'exact', head: true })
    .in('faculty', facList).eq('status', 'waiting')
  check('tarbiyachi payment scope covers both faculties', waiting === 2, `count=${waiting}`)

  // ---- 8. release blocked while residents remain ----
  r = await svc.rpc('dorm_claim_floors', { p_dorm_id: dormId, p_faculty: 'fizika', p_floors: [4], p_staff_id: fizikaDekan })
  check('fizika can propose to take back floor 4', !r.error && JSON.stringify(r.data.proposed) === '[4]', JSON.stringify(r.data ?? r.error?.message))
  r = await svc.rpc('dorm_resolve_floor', { p_dorm_id: dormId, p_floor: 4, p_staff_id: sportDekan, p_accept: true })
  check('takeover blocked while sport still has a resident on floor 4 (P0003)', r.error?.code === 'P0003', r.error?.code ?? 'no error')
} catch (err) {
  check('EXCEPTION', false, err.message)
} finally {
  if (!keep) {
    await svc.from('tolovlar').delete().in('student_id', trash.studentIds)
    await svc.from('users').delete().in('id', trash.studentIds)
    if (trash.permitIds?.length) await svc.from('permit_requests').delete().in('id', trash.permitIds)
    if (trash.dormId) {
      await svc.from('users').update({ dorm_id: null, room_number: null, assigned_floor: null }).eq('dorm_id', trash.dormId)
      await svc.from('floor_room_layout').delete().eq('dorm_id', trash.dormId)
      await svc.from('dorm_floor').delete().eq('dorm_id', trash.dormId)
      await svc.from('faculty_dorm').delete().eq('dorm_id', trash.dormId)
      await svc.from('staff').update({ dorm_id: null }).eq('dorm_id', trash.dormId)
      await svc.from('dorms').delete().eq('id', trash.dormId)
    }
    for (const id of trash.authUsers) {
      await svc.from('staff').delete().eq('id', id)
      await svc.auth.admin.deleteUser(id).catch(() => {})
    }
    console.log('\ncleanup done')
  } else {
    console.log('\n--keep: left everything in place, dorm', trash.dormId)
  }
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}
