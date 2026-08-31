import { isPlaceholderValue } from './env-placeholders.mjs'

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

const missing = required.filter((name) => {
  return isPlaceholderValue(process.env[name])
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

// Telegram student notifications are optional until a bot webhook is
// configured. Once either new setting is present, require the complete and
// valid trio so a deployment cannot expose a half-working START button.
if (process.env.TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_WEBHOOK_SECRET) {
  if (isPlaceholderValue(process.env.TELEGRAM_BOT_TOKEN)) {
    console.error('TELEGRAM_BOT_TOKEN is required when Telegram student notifications are enabled.')
    process.exit(1)
  }
  if (!/^[A-Za-z0-9_]{5,32}$/.test((process.env.TELEGRAM_BOT_USERNAME ?? '').replace(/^@/, ''))) {
    console.error('TELEGRAM_BOT_USERNAME is not a valid Telegram bot username.')
    process.exit(1)
  }
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(process.env.TELEGRAM_WEBHOOK_SECRET ?? '')) {
    console.error('TELEGRAM_WEBHOOK_SECRET must be a random 32-256 character webhook secret.')
    process.exit(1)
  }
}

if (process.env.TELEGRAM_ADMIN_CHAT_ID
  && !/^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{3,31})$/.test(process.env.TELEGRAM_ADMIN_CHAT_ID.trim())) {
  console.error('TELEGRAM_ADMIN_CHAT_ID must be a numeric Telegram chat ID or a public @channel handle.')
  process.exit(1)
}

console.log('Production environment validation passed.')
