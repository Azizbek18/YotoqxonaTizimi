import 'server-only'

import { getServiceSupabase } from '@/lib/server-supabase'
import { sendTelegramChatMessage } from '@/lib/telegram'
import { permitFacultyLabel } from '@/lib/faculties'

// Numeric chat id (personal chats are positive, groups negative) or an
// @public_channel handle — mirrors the CHECK constraint on
// staff.telegram_chat_id and lib/dekan-telegram.ts.
const CHAT_ID_RE = /^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{3,31})$/

/** '' for anything the DB constraint would reject, so callers treat
 *  "not configured" and "invalid" identically. */
export function normalizeStaffChatId(raw: unknown): string {
  const value = String(raw ?? '').trim()
  return CHAT_ID_RE.test(value) ? value : ''
}

export async function getStaffTelegramChatId(staffId: string): Promise<string> {
  const { data, error } = await getServiceSupabase()
    .from('staff')
    .select('telegram_chat_id')
    .eq('id', staffId)
    .maybeSingle()
  if (error) throw error
  return normalizeStaffChatId(data?.telegram_chat_id)
}

/** Writes the caller's own row. An empty/invalid value clears it
 *  (notifications off). Returns what was stored. */
export async function setStaffTelegramChatId(staffId: string, chatId: string): Promise<string> {
  const normalized = normalizeStaffChatId(chatId)
  const { error } = await getServiceSupabase()
    .from('staff')
    .update({ telegram_chat_id: normalized || null, updated_at: new Date().toISOString() })
    .eq('id', staffId)
  if (error) throw error
  return normalized
}

/**
 * Every active staff member of a faculty who has a personal Telegram chat
 * set — the recipients for a "new ariza in your dorm" heads-up. Best-effort:
 * resolves to `[]` on any error so a notification never blocks a student's
 * submission.
 */
export async function staffChatIdsForFaculty(faculty: string | null): Promise<string[]> {
  const canonical = (faculty ?? '').trim()
  if (!canonical) return []
  try {
    const { data, error } = await getServiceSupabase()
      .from('staff')
      .select('telegram_chat_id, role, status, faculty')
      .eq('status', 'active')
      .in('role', ['tarbiyachi', 'dekan'])
      .ilike('faculty', canonical)
    if (error) throw error
    return (data ?? [])
      .map((row) => normalizeStaffChatId(row.telegram_chat_id))
      .filter((id) => id.length > 0)
  } catch (error) {
    console.error('staffChatIdsForFaculty failed:', error)
    return []
  }
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export type NewArizaNotice = {
  studentName: string | null
  faculty: string | null
  kind: 'ariza' | 'tushuntirish'
  title: string | null
}

/**
 * Pings every staff member of the student's faculty who has a personal
 * Telegram chat set — "a new ariza is waiting in your dorm". Best-effort:
 * a missing chat, a removed bot or an API hiccup must never fail the
 * student's submission, so this always resolves and never throws.
 */
export async function notifyDormStaffNewAriza(notice: NewArizaNotice): Promise<void> {
  try {
    const chatIds = await staffChatIdsForFaculty(notice.faculty)
    if (chatIds.length === 0) return
    const label = notice.kind === 'tushuntirish' ? 'Tushuntirish xati' : 'Ariza'
    const message = [
      `📨 <b>Yangi ${label.toLowerCase()}</b>`,
      '',
      `👤 <b>${escapeHtml(notice.studentName ?? "Noma'lum")}</b>`,
      `🎓 ${escapeHtml(permitFacultyLabel(notice.faculty ?? '') || (notice.faculty ?? '—'))}`,
      notice.title ? `📝 ${escapeHtml(notice.title)}` : null,
      '',
      'Tarbiyachi panelida ko‘rib chiqing.',
    ].filter((line): line is string => line !== null).join('\n')
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/tarbiyachi/arizalar`
    await Promise.all(
      chatIds.map((chatId) =>
        sendTelegramChatMessage(chatId, message, {
          parseMode: 'HTML',
          replyMarkup: { inline_keyboard: [[{ text: 'Tarbiyachi paneli', url }]] },
        }).catch(() => false),
      ),
    )
  } catch (error) {
    console.error('notifyDormStaffNewAriza failed:', error)
  }
}
