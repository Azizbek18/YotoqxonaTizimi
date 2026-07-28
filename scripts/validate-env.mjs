const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'RATE_LIMIT_REDIS_REST_URL',
  'RATE_LIMIT_REDIS_REST_TOKEN',
  // Gate the admin/tarbiyachi/zamdekan login links (lib/staff-access.ts) —
  // without these, every staff portal is silently unreachable in
  // production (safeEqual(undefined, key) always fails).
  'ADMIN_PORTAL_KEY',
  'TARBIYACHI_PORTAL_KEY',
  'ZAMDEKAN_PORTAL_KEY',
  'ZAMDEKAN_REGISTER_CODE',
  'ZAMDEKAN_ALLOWED_IDS',
]

const missing = required.filter((name) => !process.env[name] || process.env[name].includes('replace-with'))
if (missing.length > 0) {
  console.error(`Production environment variables are missing: ${missing.join(', ')}`)
  process.exit(1)
}

const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL)
if (appUrl.protocol !== 'https:') {
  console.error('NEXT_PUBLIC_APP_URL must use HTTPS in production.')
  process.exit(1)
}

console.log('Production environment validation passed.')
