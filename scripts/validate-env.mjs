const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'RATE_LIMIT_REDIS_REST_URL',
  'RATE_LIMIT_REDIS_REST_TOKEN',
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
