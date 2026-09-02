import 'server-only'

import { createHash, randomBytes } from 'crypto'
import { getServiceSupabase } from '@/lib/server-supabase'
import { sendTelegramChatMessage } from '@/lib/telegram'

const LINK_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function botUsername() {
  const value = (process.env.TELEGRAM_BOT_USERNAME ?? '').trim().replace(/^@/, '')
  return /^[A-Za-z0-9_]{5,32}$/.test(value) ? value : null
}

export type StudentTelegramStatus = { linked: boolean; url: string | null }

/** Current binding + a fresh deep link if not linked yet. */
export async function getStudentTelegramLink(studentId: string): Promise<StudentTelegramStatus> {
  const username = botUsername()
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('student_telegram_links')
    .select('chat_id, token_expires_at')
    .eq('student_id', studentId)
    .maybeSingle()
  if (error) throw error
  if (data?.chat_id != null) return { linked: true, url: null }
  if (!username) return { linked: false, url: null }
  return { linked: false, url: await issueLink(studentId, username) }
}

async function issueLink(studentId: string, username: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const supabase = getServiceSupabase()
  const { error } = await supabase.from('student_telegram_links').upsert({
    student_id: studentId,
    token_hash: tokenHash(token),
    token_expires_at: new Date(now.getTime() + LINK_LIFETIME_MS).toISOString(),
    chat_id: null,
    linked_at: null,
    updated_at: now.toISOString(),
  }, { onConflict: 'student_id' })
  if (error) throw error
  return `https://t.me/${username}?start=${token}`
}

/** Called by the Telegram webhook on `/start <token>`. Returns the student's
 *  name on success (for the acknowledgement message), null otherwise. */
export async function bindStudentTelegramChat(token: string, chatId: number): Promise<{ name: string } | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token) || !Number.isSafeInteger(chatId)) return null
  const supabase = getServiceSupabase()
  const hash = tokenHash(token)
  const { data: link, error } = await supabase
    .from('student_telegram_links')
    .select('student_id, chat_id, token_expires_at')
    .eq('token_hash', hash)
    .maybeSingle()
  if (error) throw error
  if (!link || new Date(link.token_expires_at).getTime() <= Date.now()) return null

  if (link.chat_id != null) {
    if (Number(link.chat_id) !== chatId) return null
  } else {
    const now = new Date().toISOString()
    const { data: claimed, error: claimErr } = await supabase
      .from('student_telegram_links')
      .update({ chat_id: chatId, linked_at: now, updated_at: now })
      .eq('student_id', link.student_id)
      .eq('token_hash', hash)
      .is('chat_id', null)
      .select('student_id')
      .maybeSingle()
    if (claimErr) throw claimErr
    if (!claimed) return null
  }

  const { data: user } = await supabase
    .from('users').select('full_name').eq('id', link.student_id).maybeSingle()
  return { name: user?.full_name ?? 'Talaba' }
}

/** Best-effort: deliver a message to the student's linked chat, if any. */
export async function sendStudentTelegram(
  studentId: string,
  text: string,
  options: Parameters<typeof sendTelegramChatMessage>[2] = {},
): Promise<boolean> {
  try {
    const supabase = getServiceSupabase()
    const { data } = await supabase
      .from('student_telegram_links')
      .select('chat_id')
      .eq('student_id', studentId)
      .maybeSingle()
    if (data?.chat_id == null) return false
    return await sendTelegramChatMessage(String(data.chat_id), text, options)
  } catch (error) {
    console.error('sendStudentTelegram failed:', error)
    return false
  }
}
