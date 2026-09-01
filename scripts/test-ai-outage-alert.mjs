// Sends the exact "AI ishlamayapti" alert that lib/ai.ts alertOutage()
// produces, straight to TELEGRAM_ADMIN_CHAT_ID — so you can confirm the
// outage alert actually lands in the admin chat without waiting for every
// AI provider to fail in production.
//
//   npm run telegram:test-alert                 (reads .env.local)
//   node scripts/test-ai-outage-alert.mjs 123   (explicit chat id)
//
// TELEGRAM_ADMIN_CHAT_ID is NOT in .env.local (it lives only in Vercel), so
// either pass the id as the first argument or export it first:
//   TELEGRAM_ADMIN_CHAT_ID=... npm run telegram:test-alert

const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
const chatId = (process.argv[2] || process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim()

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN topilmadi (npm run bilan ishga tushiring yoki .env.local ni tekshiring).')
  process.exit(1)
}
if (!chatId) {
  console.error('TELEGRAM_ADMIN_CHAT_ID berilmadi. Uni argument sifatida bering: node scripts/test-ai-outage-alert.mjs <chat_id>')
  process.exit(1)
}

// Mirrors lib/ai.ts describeAiFailure() for a depleted-credit outage.
const describeAiFailure = 'AI krediti/kvotasi tugagan — Vercel AI Gateway yoki Google AI Studio balansini tekshiring.'
const where = 'sinov'
const text =
  `⚠️ Sun'iy intellekt ishlamayapti (${where})\n\n${describeAiFailure}\n\n` +
  "Talaba arizalari/cheklari to'xtatilmayapti — ular \"AI tekshirmagan\" belgisi bilan qo'lda ko'rib chiqishga o'tkazilmoqda. Provayder tiklangach belgisiz davom etadi.\n\n" +
  '(Bu — scripts/test-ai-outage-alert.mjs orqali yuborilgan SINOV xabari.)'

const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
})
const payload = await res.json()

if (res.ok && payload.ok) {
  console.log(`✅ Yuborildi. chat_id=${chatId}, message_id=${payload.result.message_id}. Admin Telegram'ini tekshiring.`)
} else {
  console.error(`❌ Yuborilmadi (${res.status}): ${payload.description || JSON.stringify(payload)}`)
  if (/chat not found/i.test(payload.description || '')) {
    console.error('   → chat_id noto‘g‘ri, yoki bot bu chat bilan hech qachon yozishmagan (guruh bo‘lsa botni qo‘shing; shaxsiy bo‘lsa botга /start bosing).')
  }
  process.exit(1)
}
