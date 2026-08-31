import 'server-only'

type InlineKeyboard = { inline_keyboard: Array<Array<{ text: string; url: string }>> }

type SendOptions = { replyMarkup?: InlineKeyboard; parseMode?: 'HTML' }

export async function sendTelegramChatMessage(chatId: string, text: string, options: SendOptions = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(options.parseMode ? { parse_mode: options.parseMode } : {}),
        disable_web_page_preview: true,
        ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
      }),
    })
    if (!response.ok) {
      console.error('Telegram sendMessage error:', response.status, await response.text())
      return false
    }
    return true
  } catch (error) {
    console.error('Telegram sendMessage failed:', error)
    return false
  }
}

export async function sendTelegramMessage(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  await sendTelegramChatMessage(chatId, text)
}
