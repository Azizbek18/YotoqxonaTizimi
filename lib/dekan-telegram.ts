import 'server-only'

import { getServiceSupabase } from '@/lib/server-supabase'
import { sendTelegramChatMessage } from '@/lib/telegram'
import { permitFacultyLabel } from '@/lib/faculties'

// Numeric chat id (groups are negative) or an @public_channel handle —
// mirrors the CHECK constraint on app_settings.dekan_telegram_chat_id.
const CHAT_ID_RE = /^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{3,31})$/

/** '' for anything the DB constraint would reject, so callers can treat
 *  "not configured" and "invalid" identically. */
export function normalizeDekanChatId(raw: unknown): string {
  const value = String(raw ?? '').trim()
  return CHAT_ID_RE.test(value) ? value : ''
}

export async function getDekanTelegramChatId(faculty: string): Promise<string> {
  const { data, error } = await getServiceSupabase()
    .from('app_settings')
    .select('dekan_telegram_chat_id')
    .eq('faculty', faculty)
    .maybeSingle()
  if (error) throw error
  return normalizeDekanChatId(data?.dekan_telegram_chat_id)
}

/** Upserts so a faculty with no app_settings row yet still gets one — the
 *  fee columns fall back to their database defaults. An empty/invalid
 *  `chatId` clears the value (notifications off). Returns what was stored. */
export async function setDekanTelegramChatId(faculty: string, chatId: string): Promise<string> {
  const normalized = normalizeDekanChatId(chatId)
  const { error } = await getServiceSupabase()
    .from('app_settings')
    .upsert(
      { faculty, dekan_telegram_chat_id: normalized || null, updated_at: new Date().toISOString() },
      { onConflict: 'faculty' },
    )
  if (error) throw error
  return normalized
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export type NewPermitNotice = {
  fullName: string
  faculty: string
  direction: string | null
  course: number | null
  applicationType: 'yollanma' | 'imtiyozli'
  resubmitted?: boolean
}

export function formatNewPermitTelegramMessage(notice: NewPermitNotice): string {
  const kind = notice.applicationType === 'imtiyozli' ? 'Xorijiy/imtiyozli ariza' : 'Yo‘llanma'
  const head = notice.resubmitted
    ? `♻️ <b>${kind} qayta yuborildi</b>`
    : `📨 <b>Yangi ${kind.toLowerCase()}</b>`
  const study = notice.direction
    ? `📚 ${escapeHtml(notice.direction)}${notice.course ? ` · ${notice.course}-kurs` : ''}`
    : null
  return [
    head,
    '',
    `👤 <b>${escapeHtml(notice.fullName)}</b>`,
    `🎓 ${escapeHtml(permitFacultyLabel(notice.faculty))}`,
    study,
    '',
    'Dekan panelida ko‘rib chiqing.',
  ]
    .filter((line) => line !== null)
    .join('\n')
}

/** Telegram is an optional channel — a missing chat id, a bot that was
 *  removed from the group, or an API hiccup must never fail the student's
 *  submission. Always resolves, never throws. */
export async function notifyDekanNewPermit(notice: NewPermitNotice): Promise<boolean> {
  try {
    const chatId = await getDekanTelegramChatId(notice.faculty)
    if (!chatId) return false
    return await sendTelegramChatMessage(chatId, formatNewPermitTelegramMessage(notice), {
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [[{ text: 'Dekan paneli', url: `${process.env.NEXT_PUBLIC_APP_URL}/dekan/arizalar` }]],
      },
    })
  } catch (error) {
    console.error('Dekan Telegram notification failed:', error)
    return false
  }
}
