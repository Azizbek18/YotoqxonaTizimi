import { createHash, randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// System-owner tool: mint a one-time registration code for the INTERNATIONAL
// OFFICE ("xalqaro" role) — a cross-faculty, read-only view of foreign
// students' visa / registration documents. The code is bound to one email;
// its holder opens /register/xodim?code=..., sets their own password and lands
// on /xalqaro/dashboard. The password is never seen or set here.
//
//   node --env-file=.env.local scripts/mint-xalqaro-invite.mjs head@example.uz "Xalqaro bo'lim"
//   add --confirm to actually write; without it this is a dry run.
//   add --days=30 to change the expiry (default 30).
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//      NEXT_PUBLIC_APP_URL (optional, for the printed link)

// Keep in sync with lib/staff-invite.ts.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generateInviteCode() {
  let raw = ''
  for (let i = 0; i < 12; i++) raw += ALPHABET[randomInt(ALPHABET.length)]
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
}
const normalize = (code) => code.toUpperCase().replace(/[^A-Z0-9]/g, '')
const hashInviteCode = (code) => createHash('sha256').update(normalize(code)).digest('hex')

const args = process.argv.slice(2)
const confirm = args.includes('--confirm')
const daysArg = args.find((a) => a.startsWith('--days='))
const days = daysArg ? Number(daysArg.split('=')[1]) : 30
const positional = args.filter((a) => !a.startsWith('--'))
const email = (positional[0] ?? '').trim().toLowerCase()
const label = (positional[1] ?? 'Xalqaro bo‘lim').trim().slice(0, 80)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
  console.error('Usage: node --env-file=.env.local scripts/mint-xalqaro-invite.mjs <email> ["label"] [--days=30] [--confirm]')
  process.exit(1)
}
if (!Number.isInteger(days) || days < 1 || days > 90) {
  console.error('--days must be an integer between 1 and 90.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

const { data: staff, error: staffError } = await supabase.from('staff').select('id').ilike('email', email).maybeSingle()
if (staffError) throw staffError
if (staff) {
  console.error(`${email} is already a staff account — a code for it would be dead on arrival.`)
  process.exit(1)
}

const { data: pending, error: pendingError } = await supabase
  .from('staff_invites')
  .select('id')
  .ilike('email', email)
  .is('revoked_at', null)
  .eq('use_count', 0)
  .maybeSingle()
if (pendingError) throw pendingError
if (pending) {
  console.error(`${email} already has an unused invite code — revoke it first.`)
  process.exit(1)
}

console.log(`${confirm ? 'Creating' : 'DRY RUN — would create'} a one-time "xalqaro" invite for ${email} (${label}), valid ${days} days.`)
if (!confirm) {
  console.log('Re-run with --confirm to write it.')
  process.exit(0)
}

const code = generateInviteCode()
const { error: insertError } = await supabase.from('staff_invites').insert({
  code_hash: hashInviteCode(code),
  faculty: null,
  role: 'xalqaro',
  email,
  label,
  created_by: null,
  expires_at: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
  max_uses: 1,
})
if (insertError) {
  console.error('Insert failed:', insertError.message)
  process.exit(1)
}

const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.meningyotoqxonam.uz').replace(/\/$/, '')
console.log('\nSend this to the account holder (shown only once):')
console.log(`  Code: ${code}`)
console.log(`  Link: ${appUrl}/register/xodim?code=${code}`)
