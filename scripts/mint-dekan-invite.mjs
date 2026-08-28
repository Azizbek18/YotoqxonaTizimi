import { createHash, randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// System-owner tool: mint a one-time, faculty-bound registration code for a
// faculty's dekan and print the link to send them. The dekan opens
// /register/dekan?code=..., fills in their details, and lands on the same
// faculty-scoped dashboard AMIT's staff use — bound to the faculty this code
// carries, which they can never change.
//
//   node scripts/mint-dekan-invite.mjs fizika kimyo         # named faculties
//   node scripts/mint-dekan-invite.mjs --all                # every faculty with no active dekan
//   node scripts/mint-dekan-invite.mjs fizika --force       # even if fizika already has a dekan
//   add --confirm to actually write; without it this is a dry run.
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//      NEXT_PUBLIC_APP_URL (optional, for the printed link)

// Keep in sync with lib/faculties.ts (PERMIT_FACULTIES) and lib/staff-invite.ts.
const FACULTIES = [
  ['matematika', 'Matematika'],
  ['amit', 'Amaliy matematika va intellektual texnologiyalar'],
  ['fizika', 'Fizika'],
  ['kimyo', 'Kimyo'],
  ['biologiya', 'Biologiya va ekologiya'],
  ['geologiya', 'Geologiya va muhandislik geologiyasi'],
  ['geografiya', 'Geografiya va geoaxborot tizimlari'],
  ['iqtisodiyot', 'Iqtisodiyot'],
  ['tarix', 'Tarix'],
  ['ijtimoiy-fanlar', 'Ijtimoiy fanlar'],
  ['xorijiy-filologiya', 'Xorijiy filologiya'],
  ['ozbek-filologiyasi', 'Jurnalistika va o‘zbek filologiyasi'],
  ['sport', 'Taekvondo va sport faoliyati'],
]
const FACULTY_LABEL = new Map(FACULTIES)

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const EXPIRY_DAYS = 90

function generateInviteCode() {
  let raw = ''
  for (let i = 0; i < 12; i++) raw += ALPHABET[randomInt(ALPHABET.length)]
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
}
const normalize = (code) => code.toUpperCase().replace(/[^A-Z0-9]/g, '')
const hashInviteCode = (code) => createHash('sha256').update(normalize(code)).digest('hex')

const args = process.argv.slice(2)
const confirm = args.includes('--confirm')
const force = args.includes('--force')
const all = args.includes('--all')
const shared = args.includes('--shared')
const named = args.filter((a) => !a.startsWith('--'))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
if (!shared && !all && named.length === 0) {
  console.error('Pass --shared (one link for every dean), or faculty codes / --all. See the header of this file.')
  process.exit(1)
}

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://meningyotoqxonam.uz').replace(/\/$/, '')
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

// --shared: ONE faculty-less dekan code. Every dean uses the same link and
// picks their own faculty on /register/dekan; the DB enforces one active
// dekan per faculty. This is the blessed onboarding path.
if (shared) {
  const invite = generateInviteCode()
  const row = {
    code_hash: hashInviteCode(invite),
    faculty: null,
    role: 'dekan',
    label: 'Dekan (umumiy link)',
    max_uses: 50,
    expires_at: new Date(Date.now() + 180 * 86_400_000).toISOString(),
  }
  if (confirm) {
    const { error } = await supabase.from('staff_invites').insert(row)
    if (error) throw error
    console.log('Umumiy dekan kodi yaratildi. 180 kun, 50 martagacha.\n')
  } else {
    console.log('DRY RUN — --confirm bilan qayta ishga tushiring.\n')
  }
  console.log(`CODE: ${invite}`)
  console.log(`LINK: ${appUrl}/register/dekan?code=${invite}`)
  console.log('\nShu bitta havolani BARCHA dekanlarga yuboring. Har biri o‘z fakultetini formada tanlaydi.')
  process.exit(0)
}

// Which faculties are we minting for?
let targets = all ? FACULTIES.map(([code]) => code) : named
const unknown = targets.filter((c) => !FACULTY_LABEL.has(c))
if (unknown.length) {
  console.error(`Unknown faculty code(s): ${unknown.join(', ')}`)
  process.exit(1)
}

// Skip faculties that already have an active dekan (unless --force).
const { data: dekans, error: dekanErr } = await supabase
  .from('staff')
  .select('faculty')
  .eq('role', 'dekan')
  .eq('status', 'active')
if (dekanErr) throw dekanErr
const hasDekan = new Set((dekans ?? []).map((r) => (r.faculty ?? '').trim().toLowerCase()))

if (!force) {
  const skipped = targets.filter((c) => hasDekan.has(c))
  if (skipped.length) console.log(`Skipping (already have an active dekan): ${skipped.join(', ')}  — use --force to override\n`)
  targets = targets.filter((c) => !hasDekan.has(c))
}
if (targets.length === 0) {
  console.log('Nothing to mint.')
  process.exit(0)
}

const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 86_400_000).toISOString()
const rows = []
const printout = []
for (const code of targets) {
  const invite = generateInviteCode()
  rows.push({
    code_hash: hashInviteCode(invite),
    faculty: code,
    role: 'dekan',
    label: `Dekan · ${FACULTY_LABEL.get(code)}`,
    max_uses: 1,
    expires_at: expiresAt,
  })
  printout.push([code, invite, `${appUrl}/register/dekan?code=${invite}`])
}

if (!confirm) {
  console.log('DRY RUN — re-run with --confirm to write these rows.\n')
} else {
  const { error } = await supabase.from('staff_invites').insert(rows)
  if (error) throw error
  console.log(`Inserted ${rows.length} dekan invite(s). Valid ${EXPIRY_DAYS} days, single use.\n`)
}

const pad = (s, n) => String(s).padEnd(n)
console.log(pad('FACULTY', 20) + pad('CODE', 18) + 'REGISTRATION LINK')
console.log('-'.repeat(90))
for (const [code, invite, link] of printout) console.log(pad(code, 20) + pad(invite, 18) + link)
console.log('\nSend each dean their own row. The code is shown once here and never stored in plaintext.')
