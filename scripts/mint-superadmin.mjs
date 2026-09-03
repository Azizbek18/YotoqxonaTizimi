import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'

// System-owner tool: provision a SUPERADMIN (`staff.role = 'admin'`) account.
//
// There is deliberately no invite flow for `admin` — `staff_invites.role`
// only allows 'tarbiyachi' | 'dekan'. A superadmin is created by hand with
// this script. It creates the Supabase Auth user (email pre-confirmed, with a
// temporary password you hand over) and the matching `staff` row.
//
//   node --env-file=.env.local scripts/mint-superadmin.mjs "user@example.com" "Familiya Ism"            # dry run
//   node --env-file=.env.local scripts/mint-superadmin.mjs "user@example.com" "Familiya Ism" --confirm  # do it
//   ...--password 'SomeTempPass123'   use this instead of a generated one
//   ...--faculty fizika               base staff.faculty (default: amit; the
//                                     acting faculty is chosen live via the
//                                     sa_scope switcher, so this rarely matters)
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// The person then signs in at /login with the temp password and changes it in
// Sozlamalar (or via "parolni unutdingizmi"). To revoke: set their staff row
// status='inactive', or delete the auth user (cascades the staff row).

const args = process.argv.slice(2)
const confirm = args.includes('--confirm')
const pwIdx = args.indexOf('--password')
const facIdx = args.indexOf('--faculty')
const providedPassword = pwIdx !== -1 ? args[pwIdx + 1] : null
const faculty = facIdx !== -1 ? args[facIdx + 1] : 'amit'
const positionals = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--password' && args[i - 1] !== '--faculty')
const [rawEmail, fullName] = positionals

if (!rawEmail || !fullName) {
  console.error('Usage: node --env-file=.env.local scripts/mint-superadmin.mjs "<email>" "<Full Name>" [--confirm] [--password <pw>] [--faculty <code>]')
  process.exit(1)
}
const email = rawEmail.trim().toLowerCase()
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`Not a valid email: ${rawEmail}`)
  process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

const password = providedPassword || `Sa-${randomBytes(9).toString('base64url')}-${randomBytes(3).toString('hex')}`

// 1. Already a staff member?
const { data: existingStaff, error: staffErr } = await supabase
  .from('staff').select('id, role, status, faculty').ilike('email', email).maybeSingle()
if (staffErr) throw staffErr
if (existingStaff) {
  if (existingStaff.role === 'admin') {
    console.log(`Already a superadmin (staff.id=${existingStaff.id}, status=${existingStaff.status}). Nothing to do.`)
    if (existingStaff.status !== 'active') {
      console.log(`  NOTE: status is "${existingStaff.status}" — run: update staff set status='active' where id='${existingStaff.id}'`)
    }
    process.exit(0)
  }
  console.error(`This email already has a staff row with role="${existingStaff.role}" (faculty=${existingStaff.faculty}).`)
  console.error(`Refusing to silently change a role. Decide explicitly, then either UPDATE that row or delete it first.`)
  process.exit(1)
}

// 2. Does an auth user already exist for this email? (e.g. registered as a student, or an orphan)
async function findAuthUserByEmail(target) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === target)
    if (hit) return hit
    if (data.users.length < 200) break
  }
  return null
}
const existingAuth = await findAuthUserByEmail(email)

const { data: existingUserRow } = await supabase
  .from('users').select('id, role, status').ilike('email', email).maybeSingle()

console.log('── plan ──────────────────────────────────')
console.log(`email        : ${email}`)
console.log(`full_name    : ${fullName}`)
console.log(`staff role   : admin  (superadmin)`)
console.log(`staff.faculty: ${faculty}  (base; actual scope via sa_scope switcher)`)
console.log(`auth user    : ${existingAuth ? `EXISTS (${existingAuth.id}) — reuse, no new account, no password change` : 'CREATE (email pre-confirmed)'}`)
if (!existingAuth) console.log(`temp password: ${providedPassword ? '(provided)' : password}`)
if (existingUserRow) console.log(`WARNING      : this email also has a public.users row (role=${existingUserRow.role}, status=${existingUserRow.status}) — a person with both a student and a superadmin identity. Usually fine (matches the project owner's own setup), just confirming you know.`)
console.log('──────────────────────────────────────────')

if (!confirm) {
  console.log('\nDry run. Re-run with --confirm to apply.')
  process.exit(0)
}

// 3. Create (or reuse) the auth user
let authId = existingAuth?.id
if (!authId) {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { role: 'admin', full_name: fullName } }),
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('Auth user creation failed:', body.msg || body.error_description || body.error || res.status)
    process.exit(1)
  }
  authId = body.id
  console.log(`✔ auth user created: ${authId}`)
}

// 4. Insert the staff row
const { error: insErr } = await supabase.from('staff').insert({
  id: authId,
  email,
  full_name: fullName,
  role: 'admin',
  status: 'active',
  faculty,
})
if (insErr) {
  console.error('staff insert failed:', insErr.message)
  if (!existingAuth) console.error(`  (the auth user ${authId} was created — delete it or retry the insert)`)
  process.exit(1)
}

console.log(`\n✔ ${email} is now a superadmin (staff.id=${authId}).`)
if (!existingAuth) {
  console.log(`  Hand over: login at ${process.env.NEXT_PUBLIC_APP_URL || 'https://meningyotoqxonam.uz'}/login`)
  console.log(`             email    ${email}`)
  console.log(`             password ${password}`)
  console.log(`  They should change it in Sozlamalar right after first login.`)
} else {
  console.log(`  They already had an account — they log in as usual and now land on the superadmin panel.`)
}
