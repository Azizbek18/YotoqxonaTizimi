import 'server-only'

export async function sendTelegramMessage(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    if (!response.ok) {
      console.error('Telegram sendMessage error:', response.status, await response.text())
    }
  } catch (error) {
    console.error('Telegram sendMessage failed:', error)
  }
}
