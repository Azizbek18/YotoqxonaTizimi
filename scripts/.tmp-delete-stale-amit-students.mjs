import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase production credentials are not configured')

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const protectedId = '005d251c-5116-4e1e-926f-4cdb97915743'
const targetIds = [
  '37348710-32d9-4e23-8a24-0906221713f5',
  '166b7403-6da3-4f7e-b12b-77b1047c3195',
  '9c5d0338-72ce-4390-af89-926ae3982c85',
  '868d3526-ae46-434d-996c-aa3006901cd4',
  '7ca37222-5b98-4e62-bc8b-8880271f2b3d',
  '78f2635f-35df-47b5-8a31-02b1860badfd',
  '1c6c6a42-fea1-42a4-8f04-67ba551f4ceb',
  '0254d728-3049-4ff1-aea4-977b340a8202',
  '4f249a07-169e-4fd5-8269-04f1cd8a418d',
  'ad95a043-94fa-4dec-a60c-0535077c2260',
]

if (targetIds.includes(protectedId) || new Set(targetIds).size !== 10) {
  throw new Error('Deletion target safety assertion failed')
}

const { data: targets, error: targetError } = await db
  .from('users')
  .select('id,email,full_name,faculty,role,status,room_number,avatar_url')
  .in('id', targetIds)
if (targetError) throw targetError
if (targets.length !== targetIds.length) {
  throw new Error(`Preflight expected ${targetIds.length} rows, found ${targets.length}; nothing was deleted`)
}
for (const row of targets) {
  if (row.id === protectedId || row.role !== 'talaba' || String(row.faculty ?? '').trim().toLowerCase() !== 'amit') {
    throw new Error(`Preflight rejected target ${row.id}; nothing was deleted`)
  }
}

const { data: protectedRow, error: protectedError } = await db
  .from('users')
  .select('id,email,faculty,role')
  .eq('id', protectedId)
  .maybeSingle()
if (protectedError) throw protectedError
if (!protectedRow || protectedRow.role !== 'talaba' || String(protectedRow.faculty ?? '').trim().toLowerCase() !== 'amit') {
  throw new Error('Protected active AMIT account was not found; nothing was deleted')
}

const countsBefore = {}
for (const [table, keyName] of [
  ['arizalar', 'student_id'],
  ['tolovlar', 'student_id'],
  ['payment_receipt_uploads', 'student_id'],
  ['profiles', 'id'],
]) {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true }).in(keyName, targetIds)
  if (error) throw error
  countsBefore[table] = count ?? 0
}

const deleted = []
for (const target of targets) {
  const { error: authError } = await db.auth.admin.deleteUser(target.id)
  if (authError && !/not found/i.test(authError.message)) {
    throw new Error(`Auth deletion failed for ${target.id}: ${authError.message}`)
  }

  for (const [table, keyName] of [
    ['arizalar', 'student_id'],
    ['tolovlar', 'student_id'],
    ['payment_receipt_uploads', 'student_id'],
    ['profiles', 'id'],
    ['users', 'id'],
  ]) {
    const { error } = await db.from(table).delete().eq(keyName, target.id)
    if (error) throw new Error(`${table} cleanup failed for ${target.id}: ${error.message}`)
  }

  deleted.push({ id: target.id, email: target.email, fullName: target.full_name, room: target.room_number })
}

const { error: auditError } = await db.from('security_audit_logs').insert({
  event_type: 'bulk_delete_stale_students',
  status: 'success',
  actor_user_id: null,
  target_role: 'talaba',
  details: {
    faculty: 'amit',
    count: deleted.length,
    deleted_ids: deleted.map((row) => row.id),
    protected_id: protectedId,
    reason: 'Operator confirmed removal of stale legacy AMIT student accounts on 2026-08-31',
  },
})
if (auditError) throw new Error(`Deletion completed, but audit log failed: ${auditError.message}`)

const { data: remainingTargets, error: verifyTargetsError } = await db
  .from('users')
  .select('id')
  .in('id', targetIds)
if (verifyTargetsError) throw verifyTargetsError

const { data: remainingAmit, error: verifyAmitError } = await db
  .from('users')
  .select('id,email,status,room_number')
  .eq('role', 'talaba')
  .ilike('faculty', 'amit')
if (verifyAmitError) throw verifyAmitError

const { data: authUsers, error: authListError } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (authListError) throw authListError
const remainingAuthIds = authUsers.users.filter((user) => targetIds.includes(user.id)).map((user) => user.id)

if (remainingTargets.length || remainingAuthIds.length || remainingAmit.some((row) => row.id !== protectedId)) {
  throw new Error(`Post-delete verification failed: public=${remainingTargets.length}, auth=${remainingAuthIds.length}, AMIT=${remainingAmit.length}`)
}

console.log(JSON.stringify({
  deletedCount: deleted.length,
  deleted,
  linkedRowsRemoved: countsBefore,
  remainingAmit,
  authTargetsRemaining: remainingAuthIds.length,
}, null, 2))
