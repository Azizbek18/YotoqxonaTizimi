import { createClient } from '@supabase/supabase-js'

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const [staff, settings, invite, amitStudents, fizikaStudents] = await Promise.all([
  s.from('staff').select('email, full_name, role, status, faculty').eq('faculty', 'fizika'),
  s.from('app_settings').select('faculty, monthly_fee, floor_count, ttj_name').eq('faculty', 'fizika'),
  s.from('staff_invites').select('faculty, role, use_count, max_uses, revoked_at').eq('faculty', 'fizika'),
  s.from('users').select('id', { count: 'exact', head: true }).eq('role', 'talaba').eq('faculty', 'amit'),
  s.from('users').select('id', { count: 'exact', head: true }).eq('role', 'talaba').eq('faculty', 'fizika'),
])

console.log('\n=== staff (fizika) — royxatdan otgan dekan ===')
console.log(JSON.stringify(staff.data, null, 2), staff.error?.message ?? '')

console.log('\n=== app_settings (fizika) — royxatdan otishda avtomatik yaratilishi kerak ===')
console.log(JSON.stringify(settings.data, null, 2), settings.error?.message ?? '')

console.log('\n=== staff_invites (fizika) — use_count 1 bolishi kerak ===')
console.log(JSON.stringify(invite.data, null, 2), invite.error?.message ?? '')

console.log('\n=== Talabalar soni: amit vs fizika ===')
console.log('amit talaba:', amitStudents.count, '| fizika talaba:', fizikaStudents.count)
