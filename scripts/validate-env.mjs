const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'RATE_LIMIT_REDIS_REST_URL',
  'RATE_LIMIT_REDIS_REST_TOKEN',
  // Gate the admin/tarbiyachi/dekan login links (lib/staff-access.ts) —
  // without these, every staff portal is silently unreachable in
  // production (safeEqual(undefined, key) always fails).
  'ADMIN_PORTAL_KEY',
  'TARBIYACHI_PORTAL_KEY',
  'DEKAN_PORTAL_KEY',
  'DEKAN_REGISTER_CODE',
  'DEKAN_ALLOWED_IDS',
]

const PLACEHOLDER_PATTERN = /^(your-|replace-with|change-?me|changeme|example\b)/i

const missing = required.filter((name) => {
  const value = process.env[name]?.trim()
  return !value || PLACEHOLDER_PATTERN.test(value) || value.includes('replace-with')
})
if (missing.length > 0) {
  console.error(`Production environment variables are missing or still placeholders: ${missing.join(', ')}`)
  process.exit(1)
}

function jwtRole(value) {
  const parts = value.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim()
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
const validAnonKey = (
  (anonKey.startsWith('sb_publishable_') && anonKey.length >= 30)
  || jwtRole(anonKey) === 'anon'
)
const validServiceRoleKey = (
  (serviceRoleKey.startsWith('sb_secret_') && serviceRoleKey.length >= 30)
  || jwtRole(serviceRoleKey) === 'service_role'
)

if (!validAnonKey) {
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not a valid publishable/anon Supabase key.')
  process.exit(1)
}

if (!validServiceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not a valid secret/service_role Supabase key.')
  process.exit(1)
}

const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL)
if (appUrl.protocol !== 'https:') {
  console.error('NEXT_PUBLIC_APP_URL must use HTTPS in production.')
  process.exit(1)
}

console.log('Production environment validation passed.')
