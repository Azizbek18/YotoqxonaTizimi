import 'server-only'
import { notifyStudent } from '@/lib/notify-student'
import { sendPushWithoutBreaking } from '@/lib/push-notifications'
import { sendTelegramChatMessage } from '@/lib/telegram'
import { tashkentNow } from '@/lib/tashkent-time'
import type { StudentContact } from './dekan-repository'

export type ReminderTarget = StudentContact & { chatId: string | null }

export type ReminderInfo = {
  sessionId: string
  dormLabel: string
  closesAt: Date
  round: number
  /** Telegram only — the caller already sent the push for this round. */
  skipPush?: boolean
}

export type ReminderSender = (targets: ReminderTarget[], info: ReminderInfo) => Promise<{ attempted: number }>

const CONCURRENCY = 8

function hm(d: Date): string {
  return tashkentNow(d).toISOString().slice(11, 16)
}

function appUrl(path: string): string | null {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
  return base ? `${base}${path}` : null
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]
      await fn(item)
    }
  })
  await Promise.all(workers)
}

/**
 * Telegram (+ the existing web/app push) to each student who has not
 * confirmed yet. Every channel is best-effort and independent — one student's
 * dead chat never stops the rest, and a provider outage never
 * fails the cron run.
 */
/** "You are confirmed" receipt to the student's Telegram, best-effort. */
export async function sendCheckinConfirmation(chatId: string, now: Date = new Date()): Promise<void> {
  await sendTelegramChatMessage(
    chatId,
    `✅ Yo‘qlamada «bor» deb belgilandingiz.\n\nSoat ${hm(now)} da yotoqxonada ekanligingiz tasdiqlandi.`,
  )
}

export const sendAttendanceReminders: ReminderSender = async (targets, info) => {
  const closeTime = hm(info.closesAt)
  const link = appUrl('/talaba/yoqlama')

  await pool(targets, CONCURRENCY, async (t) => {
    const jobs: Promise<unknown>[] = []

    if (!info.skipPush) jobs.push(
      sendPushWithoutBreaking(() =>
        notifyStudent(t.id, {
          title: info.round <= 1 ? 'Yo‘qlama boshlandi' : 'Yo‘qlama: tasdiqlamadingiz',
          body: `${closeTime} gacha yotoqxonada ekanligingizni tasdiqlang.`,
          url: '/talaba/yoqlama',
          tag: `attendance-${info.sessionId}`,
        }),
      ),
    )

    if (t.chatId) {
      const text = [
        info.round <= 1 ? '📍 Yo‘qlama boshlandi' : '⏰ Yo‘qlama: hali tasdiqlamadingiz',
        `${info.dormLabel} yotoqxonasi. Soat ${closeTime} gacha «Men yotoqxonadaman» tugmasini bosib, joylashuvingizni tasdiqlang.`,
      ].join('\n\n')
      jobs.push(
        sendTelegramChatMessage(
          t.chatId,
          text,
          link ? { replyMarkup: { inline_keyboard: [[{ text: 'Yotoqxonadaman ✅', url: link }]] } } : {},
        ),
      )
    }

    await Promise.allSettled(jobs)
  })

  return { attempted: targets.length }
}
