import { createClient } from '@supabase/supabase-js'

// Ad-hoc operator tool: wipe test yo'llanma / imtiyozli applications from
// `permit_requests` and delete their uploaded files from the `permits`
// storage bucket. Early-stage prod held only a handful of tester rows
// (operator confirmed 2026-08-28); this clears them so the dekan panel
// starts from an empty queue.
//
//   node --env-file=.env.local scripts/delete-test-permits.mjs            # dry run — lists what would go
//   node --env-file=.env.local scripts/delete-test-permits.mjs --confirm  # actually delete
//   ...add --status pending            to limit to one status
//   ...add --include-registered        to also delete rows whose applicant already has an account
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// A row is deleted regardless of any pre-assigned room: room occupancy is
// derived live from permit_requests.room_number (assign_permit_room_atomic),
// so removing the row frees the room automatically — no extra step.

const args = process.argv.slice(2)
const confirm = args.includes('--confirm')
const includeRegistered = args.includes('--include-registered')
const statusIdx = args.indexOf('--status')
const statusFilter = statusIdx !== -1 ? args[statusIdx + 1] : null

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

let query = supabase
  .from('permit_requests')
  .select('id, full_name, passport_series, jshshir, email, faculty, direction, status, room_number, application_type, permit_url, created_at')
  .order('created_at', { ascending: true })
if (statusFilter) query = query.eq('status', statusFilter)

const { data: rows, error } = await query
if (error) throw error

if (!rows || rows.length === 0) {
  console.log('permit_requests bo‘sh — o‘chiradigan narsa yo‘q.')
  process.exit(0)
}

const registered = rows.filter((r) => r.status === 'registered')
const targets = includeRegistered ? rows : rows.filter((r) => r.status !== 'registered')

const pad = (s, n) => String(s ?? '').padEnd(n)
console.log(`\nHost: ${supabaseUrl}`)
console.log(`Topildi: ${rows.length} ta yozuv${statusFilter ? ` (status='${statusFilter}')` : ''}\n`)
console.log(pad('STATUS', 12) + pad('TURI', 11) + pad('F.I.Sh.', 30) + pad('FAKULTET', 10) + pad('XONA', 6) + 'FAYL')
console.log('-'.repeat(110))
for (const r of targets) {
  console.log(
    pad(r.status, 12) +
    pad(r.application_type === 'imtiyozli' ? 'imtiyozli' : 'yollanma', 11) +
    pad(r.full_name, 30) +
    pad(r.faculty, 10) +
    pad(r.room_number ?? '—', 6) +
    (r.permit_url ?? '—')
  )
}

if (registered.length > 0 && !includeRegistered) {
  console.log(`\n⚠  ${registered.length} ta 'registered' yozuv O‘TKAZIB YUBORILDI (ariza egasi allaqachon ro‘yxatdan o‘tgan).`)
  console.log('   Ularni ham o‘chirish uchun --include-registered qo‘shing (foydalanuvchi hisobi o‘chmaydi).')
}

if (targets.length === 0) {
  console.log('\nO‘chiradigan yozuv qolmadi.')
  process.exit(0)
}

if (!confirm) {
  console.log(`\nDRY RUN — ${targets.length} ta yozuv va ularning fayllari o‘chiriladi. Bajarish uchun --confirm bilan qayta ishga tushiring.`)
  process.exit(0)
}

// 1. Storage files first (so a failure here doesn't orphan paths we've lost).
const paths = targets.map((r) => r.permit_url).filter(Boolean)
if (paths.length > 0) {
  const { data: removed, error: rmErr } = await supabase.storage.from('permits').remove(paths)
  if (rmErr) {
    console.error(`\nStorage fayllarini o‘chirishda xato: ${rmErr.message}`)
    console.error('Yozuvlar o‘chirilmadi. Muammoni hal qilib qayta urinib ko‘ring.')
    process.exit(1)
  }
  console.log(`\nStorage: ${removed?.length ?? 0} ta fayl o‘chirildi (permits bucket).`)
}

// 2. Rows.
const ids = targets.map((r) => r.id)
const { error: delErr } = await supabase.from('permit_requests').delete().in('id', ids)
if (delErr) throw delErr

console.log(`permit_requests: ${ids.length} ta yozuv o‘chirildi.`)
console.log('\nTayyor. Dekan paneldagi yo‘llanmalar navbati endi bo‘sh.')
