import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const confirmed = process.argv.includes('--confirm')
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
const { data: rows, error } = await supabase
  .from('permit_requests')
  .select('id, permit_url')
  .like('permit_url', 'http%')
if (error) throw error

console.log(`Legacy public permit files found: ${rows.length}`)
if (!confirmed) {
  console.log('Dry run only. Re-run with --confirm after applying MIGRATION_production_security_hardening.sql.')
  process.exit(0)
}

const allowedTypes = new Map([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])

let migrated = 0
for (const row of rows) {
  const sourceUrl = new URL(row.permit_url)
  if (sourceUrl.origin !== new URL(supabaseUrl).origin) {
    console.warn(`Skipping ${row.id}: URL does not belong to this Supabase project.`)
    continue
  }
  const match = sourceUrl.pathname.match(/\/storage\/v1\/object\/public\/(avatar|avatars)\/(.+)$/)
  if (!match) {
    console.warn(`Skipping ${row.id}: unsupported legacy storage URL.`)
    continue
  }

  const response = await fetch(sourceUrl)
  const contentType = response.headers.get('content-type')?.split(';')[0] ?? ''
  const extension = allowedTypes.get(contentType)
  if (!response.ok || !extension) {
    console.warn(`Skipping ${row.id}: file unavailable or unsupported MIME.`)
    continue
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > 5 * 1024 * 1024) {
    console.warn(`Skipping ${row.id}: file exceeds 5 MB.`)
    continue
  }

  const targetPath = `legacy/${randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage.from('permits').upload(targetPath, buffer, { contentType })
  if (uploadError) throw uploadError

  const { error: updateError } = await supabase.from('permit_requests').update({ permit_url: targetPath }).eq('id', row.id)
  if (updateError) {
    await supabase.storage.from('permits').remove([targetPath])
    throw updateError
  }

  const bucket = match[1]
  const oldPath = decodeURIComponent(match[2])
  const { error: removeError } = await supabase.storage.from(bucket).remove([oldPath])
  if (removeError) console.warn(`Migrated ${row.id}, but old public object could not be removed: ${removeError.message}`)
  migrated += 1
}

console.log(`Migration complete. Private files migrated: ${migrated}/${rows.length}`)
