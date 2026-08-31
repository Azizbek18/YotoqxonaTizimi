const required = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'NEXT_PUBLIC_APP_URL']
const missing = required.filter((name) => !process.env[name]?.trim())
if (missing.length) {
  console.error(`Telegram webhook sozlamalari topilmadi: ${missing.join(', ')}`)
  process.exit(1)
}

const token = process.env.TELEGRAM_BOT_TOKEN.trim()
const secret = process.env.TELEGRAM_WEBHOOK_SECRET.trim()
const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL.trim())
if (appUrl.protocol !== 'https:') throw new Error('NEXT_PUBLIC_APP_URL HTTPS bo‘lishi kerak.')
if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret)) throw new Error('TELEGRAM_WEBHOOK_SECRET kamida 32 ta xavfsiz belgidan iborat bo‘lishi kerak.')

const api = async (method, body) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json()
  if (!response.ok || !payload.ok) throw new Error(payload.description || `${method} xatoligi`)
  return payload.result
}

const bot = await api('getMe', {})
const configuredUsername = (process.env.TELEGRAM_BOT_USERNAME ?? '').replace(/^@/, '')
if (configuredUsername && configuredUsername.toLowerCase() !== bot.username.toLowerCase()) {
  throw new Error(`TELEGRAM_BOT_USERNAME @${configuredUsername}, token esa @${bot.username} botiga tegishli.`)
}

await api('setWebhook', {
  url: new URL('/api/telegram/webhook', appUrl).toString(),
  secret_token: secret,
  allowed_updates: ['message'],
  drop_pending_updates: false,
})

console.log(`Telegram webhook tayyor: @${bot.username} -> ${new URL('/api/telegram/webhook', appUrl)}`)
