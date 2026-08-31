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

/**
 * Sends operational messages only to an explicitly configured administrator.
 * TELEGRAM_CHAT_ID used to share the student bot's recipient and is
 * intentionally ignored: a student who starts the bot must never receive
 * internal alerts or other students' submissions.
 */
export async function sendTelegramAdminMessage(text: string) {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim()
  if (!chatId) return false

  return sendTelegramChatMessage(chatId, text)
}
