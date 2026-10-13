import 'server-only'
import { getDekanTelegramChatId } from '@/lib/dekan-telegram'
import { openInAppButton, sendTelegramChatMessage } from '@/lib/telegram'
import { sendStudentTelegram } from '@/lib/student-telegram'
import { sendPushWithoutBreaking } from '@/lib/push-notifications'
import { notifyStudent } from '@/lib/notify-student'
import { createAttendanceRepository } from '@/features/attendance/server/repository'
import type { HomeLeaveStaffRow } from '../types'
import { createHomeLeaveService, type HomeLeaveService } from './service'

function appUrl(path: string): string | null {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
  return base ? `${base}${path}` : null
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function fmt(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

export function formatOverdueMessage(rows: HomeLeaveStaffRow[]): string {
  const lines = rows.slice(0, 30).map((r) => {
    const room = r.roomNumber ? ` (${escapeHtml(r.roomNumber)}-xona)` : ''
    return `• <b>${escapeHtml(r.studentName)}</b>${room} — muddati ${fmt(r.endsOn)} da tugagan\n   📞 ${escapeHtml(r.contactName)}: ${escapeHtml(r.contactPhone)}`
  })
  const more = rows.length > 30 ? `\n… va yana ${rows.length - 30} ta` : ''
  return [
    `⚠️ <b>Uyga ketgan, lekin qaytmagan talabalar (${rows.length})</b>`,
    '',
    'Ruxsat muddati tugadi va keyingi yo‘qlamada ham ko‘rinmadi:',
    '',
    lines.join('\n') + more,
  ].join('\n')
}

/**
 * Muddati tugagan, lekin yo'qlamada ham ko'rinmagan talabalar haqida:
 *  - fakultet dekaniga (Telegram guruhi sozlangan bo'lsa) bitta xabar;
 *  - talabaning o'ziga eslatma (push + Telegram).
 * Har ariza uchun bir marta (security_audit_logs orqali, migratsiyasiz).
 * Dekan panelida esa qaytmaganlar muammo hal bo'lguncha ko'rinib turadi.
 */
export async function runLeaveOverdueAlerts(
  service: HomeLeaveService = createHomeLeaveService(),
  now: Date = new Date(),
): Promise<{ overdue: number; alertedDekans: number; remindedStudents: number }> {
  const overdue = await service.findOverdue(undefined, now)
  if (overdue.length === 0) return { overdue: 0, alertedDekans: 0, remindedStudents: 0 }

  const attendance = createAttendanceRepository()
  const fresh: HomeLeaveStaffRow[] = []
  let remindedStudents = 0
  for (const row of overdue) {
    if (!(await attendance.claimAlertSlot(`leave-overdue:${row.id}`))) continue
    fresh.push(row)
    try {
      await sendStudentTelegram(
        row.studentId,
        '⏰ Uyga ketish muddatingiz tugadi. Yotoqxonaga qaytgan bo‘lsangiz, yo‘qlamada o‘zingizni tasdiqlang; hali qaytmagan bo‘lsangiz, dekanatga xabar bering.',
      )
    } catch (error) {
      console.error('Leave overdue student Telegram failed:', error)
    }
    await sendPushWithoutBreaking(() =>
      notifyStudent(row.studentId, {
        title: 'Uyga ketish muddati tugadi',
        body: 'Yotoqxonaga qaytib, yo‘qlamada o‘zingizni tasdiqlang.',
        url: '/talaba/uyga-ketish',
        tag: `home-leave-overdue-${row.id}`,
      }),
    )
    remindedStudents += 1
  }

  // Dekanlarga fakultet bo'yicha guruhlab bitta xabar.
  const byFaculty = new Map<string, HomeLeaveStaffRow[]>()
  for (const row of fresh) {
    if (!row.faculty) continue
    byFaculty.set(row.faculty, [...(byFaculty.get(row.faculty) ?? []), row])
  }
  let alertedDekans = 0
  const link = appUrl('/dekan/yoqlama')
  for (const [faculty, rows] of byFaculty) {
    try {
      const chatId = await getDekanTelegramChatId(faculty)
      if (!chatId) continue
      await sendTelegramChatMessage(
        chatId,
        formatOverdueMessage(rows),
        { parseMode: 'HTML', ...(link ? { replyMarkup: { inline_keyboard: [[openInAppButton('Yo‘qlamani ochish', link)]] } } : {}) },
      )
      alertedDekans += 1
    } catch (error) {
      console.error('Leave overdue dekan Telegram failed:', error)
    }
  }
  return { overdue: overdue.length, alertedDekans, remindedStudents }
}
