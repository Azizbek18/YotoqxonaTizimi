import 'server-only'

import { createHash, randomBytes } from 'crypto'
import type { PermitRequestRow } from '@/types/database.generated'
import { getServiceSupabase } from '@/lib/server-supabase'
import { sendTelegramChatMessage } from '@/lib/telegram'

const LINK_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000

export type TelegramLinkResult =
  | { linked: true; url: null }
  | { linked: false; url: string }
  | { linked: false; url: null }

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function botUsername() {
  const value = (process.env.TELEGRAM_BOT_USERNAME ?? '').trim().replace(/^@/, '')
  return /^[A-Za-z0-9_]{5,32}$/.test(value) ? value : null
}

export async function issuePermitTelegramLink(permitRequestId: string): Promise<TelegramLinkResult> {
  const username = botUsername()
  // Keep the existing permit flow operational while Telegram is not yet
  // configured in an environment (for example an isolated PR Preview).
  if (!username) return { linked: false, url: null }

  const supabase = getServiceSupabase()
  const { data: existing, error: readError } = await supabase
    .from('permit_telegram_links')
    .select('chat_id')
    .eq('permit_request_id', permitRequestId)
    .maybeSingle()
  if (readError) throw readError
  if (existing?.chat_id != null) return { linked: true, url: null }

  // 32 random bytes become 43 base64url characters, within Telegram's
  // 64-character /start payload limit. Only the digest is persisted.
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const { error } = await supabase.from('permit_telegram_links').upsert({
    permit_request_id: permitRequestId,
    token_hash: tokenHash(token),
    token_expires_at: new Date(now.getTime() + LINK_LIFETIME_MS).toISOString(),
    chat_id: null,
    linked_at: null,
    last_notified_status: null,
    updated_at: now.toISOString(),
  }, { onConflict: 'permit_request_id' })
  if (error) throw error

  return { linked: false, url: `https://t.me/${username}?start=${token}` }
}

export async function issuePermitTelegramLinkSafely(permitRequestId: string): Promise<TelegramLinkResult> {
  try {
    return await issuePermitTelegramLink(permitRequestId)
  } catch (error) {
    // Telegram is an optional delivery channel. A missing migration or a
    // temporary database error must not turn a successfully saved permit
    // into a false submission/status failure for the student.
    console.error('Permit Telegram link could not be issued:', error)
    return { linked: false, url: null }
  }
}

export async function bindPermitTelegramChat(token: string, chatId: number) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token) || !Number.isSafeInteger(chatId)) return null

  const supabase = getServiceSupabase()
  const hash = tokenHash(token)
  const { data: link, error: readError } = await supabase
    .from('permit_telegram_links')
    .select('permit_request_id, chat_id, token_expires_at')
    .eq('token_hash', hash)
    .maybeSingle()
  if (readError) throw readError
  if (!link || new Date(link.token_expires_at).getTime() <= Date.now()) return null

  if (link.chat_id != null) {
    if (Number(link.chat_id) !== chatId) return null
  } else {
    const now = new Date().toISOString()
    const { data: claimed, error: claimError } = await supabase
      .from('permit_telegram_links')
      .update({ chat_id: chatId, linked_at: now, updated_at: now })
      .eq('permit_request_id', link.permit_request_id)
      .eq('token_hash', hash)
      .is('chat_id', null)
      .select('permit_request_id')
      .maybeSingle()
    if (claimError) throw claimError
    if (!claimed) return null
  }

  const { data: permit, error: permitError } = await supabase
    .from('permit_requests')
    .select('*')
    .eq('id', link.permit_request_id)
    .maybeSingle()
  if (permitError) throw permitError
  return permit
}

function escapeHtml(value: string | null | undefined) {
  return (value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function formatPermitTelegramMessage(permit: Pick<PermitRequestRow, 'full_name' | 'status' | 'reject_reason' | 'room_number' | 'application_type'>) {
  const name = escapeHtml(permit.full_name)
  if (permit.status === 'approved') {
    return `✅ <b>Arizangiz tasdiqlandi!</b>\n\nHurmatli <b>${name}</b>, yotoqxona uchun ${permit.application_type === 'imtiyozli' ? 'xorijiy/imtiyozli arizangiz' : "yo‘llanmangiz"} dekan tomonidan tasdiqlandi.${permit.room_number ? `\n🏠 Xona: <b>${escapeHtml(permit.room_number)}</b>` : ''}\n\nEndi tizimda ro‘yxatdan o‘tishingiz mumkin.`
  }
  if (permit.status === 'rejected') {
    return `❌ <b>Arizangiz rad etildi</b>\n\nHurmatli <b>${name}</b>, hujjatingizni tuzatib qayta yuborishingiz kerak.\n\n📝 <b>Sabab:</b> ${escapeHtml(permit.reject_reason) || 'Hujjat talabga javob bermadi.'}`
  }
  if (permit.status === 'registered') {
    return `🎉 <b>Ro‘yxatdan o‘tish yakunlandi!</b>\n\nHurmatli <b>${name}</b>, akkauntingiz muvaffaqiyatli yaratildi.${permit.room_number ? `\n🏠 Xona: <b>${escapeHtml(permit.room_number)}</b>` : ''}`
  }
  return `🔔 <b>Telegram xabarnomasi ulandi</b>\n\nHurmatli <b>${name}</b>, arizangiz hozir dekan ko‘rib chiqishini kutmoqda.\n\nJavob tayyor bo‘lishi bilan shu bot sizga avtomatik xabar yuboradi. Botni qayta ishga tushirishingiz shart emas.`
}

export async function notifyPermitTelegram(permit: PermitRequestRow) {
  const supabase = getServiceSupabase()
  const { data: link, error } = await supabase
    .from('permit_telegram_links')
    .select('chat_id, last_notified_status')
    .eq('permit_request_id', permit.id)
    .maybeSingle()
  if (error) throw error
  if (link?.chat_id == null || link.last_notified_status === permit.status) return false

  const sent = await sendTelegramChatMessage(String(link.chat_id), formatPermitTelegramMessage(permit), {
    parseMode: 'HTML',
    replyMarkup: { inline_keyboard: [[{ text: 'Ariza holatini ochish', url: `${process.env.NEXT_PUBLIC_APP_URL}/ruxsatnoma-tekshirish` }]] },
  })
  if (!sent) return false

  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('permit_telegram_links')
    .update({ last_notified_status: permit.status, updated_at: now })
    .eq('permit_request_id', permit.id)
  if (updateError) throw updateError
  return true
}
