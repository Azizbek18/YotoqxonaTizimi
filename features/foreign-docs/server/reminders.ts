import 'server-only'
import { sendStudentTelegram } from '@/lib/student-telegram'
import { sendPushForUser, sendPushWithoutBreaking } from '@/lib/push-notifications'
import { sendForeignDocReminderEmail } from '@/lib/email'
import { sendTelegramChatMessage } from '@/lib/telegram'
import { getDekanTelegramChatId } from '@/lib/dekan-telegram'
import { normalizeFaculty, permitFacultyLabel } from '@/lib/faculties'
import { getServiceSupabase } from '@/lib/server-supabase'
import { DOC_TYPE_LABELS } from '../types'
import { daysLeft, dueReminder, tashkentToday } from '../domain/expiry'
import { countdownLabel } from '../domain/presentation'
import { createForeignDocsRepository, type ForeignDocsRepository } from './repository'

function appUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.meningyotoqxonam.uz').replace(/\/+$/, '')
  return `${base}${path}`
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'long', year: 'numeric' })
}

export type ReminderRunResult = {
  scanned: number
  studentsNotified: number
  milestonesRecorded: number
  dekanDigestsSent: number
}

/**
 * Kunlik cron. Har faol viza/propiska hujjati uchun muddatga necha kun
 * qolganini hisoblaydi va yangi "kelgan" bosqichni (30/15/10/5/3/0, keyin
 * muddat o'tgach 7 kun) talabaga yuboradi — Telegram + push + email. Har
 * bosqich jurnalда bir marta belgilanadi (idempotent). Fakultet dekaniga
 * bugungi barcha dolzarb hujjatlar bo'yicha bitta Telegram digest.
 */
export async function runForeignDocReminders(
  repository: ForeignDocsRepository = createForeignDocsRepository(),
  deps: {
    sendStudentTelegram: typeof sendStudentTelegram
    sendPush: typeof sendPushForUser
    sendEmail: typeof sendForeignDocReminderEmail
    sendDekanTelegram: (faculty: string, text: string) => Promise<boolean>
    resolveStudentEmail: (studentId: string) => Promise<string | null>
    today: string
  } = defaultDeps(),
): Promise<ReminderRunResult> {
  const today = deps.today
  const docs = await repository.listActiveForReminders()
  const ledgerRows = await repository.listRemindersFor(docs.map((d) => d.id))
  const ledger = new Map<string, Set<number>>()
  for (const row of ledgerRows) {
    const set = ledger.get(row.document_id) ?? new Set<number>()
    set.add(row.milestone)
    ledger.set(row.document_id, set)
  }

  const toRecord: { document_id: string; milestone: number }[] = []
  const digest = new Map<string, string[]>()
  let studentsNotified = 0

  for (const doc of docs) {
    const d = daysLeft(doc.expires_on, today)
    const decision = dueReminder(d, ledger.get(doc.id) ?? new Set<number>())
    if (!decision.send) continue

    for (const milestone of decision.mark) toRecord.push({ document_id: doc.id, milestone })

    const docLabel = DOC_TYPE_LABELS[doc.doc_type]
    const dateText = fmtDate(doc.expires_on)
    const link = appUrl('/talaba/hujjatlarim')
    const message =
      d < 0
        ? `🚨 ${docLabel} muddati ${Math.abs(d)} kun oldin — ${dateText} da tugagan.\n\nZudlik bilan universitet xalqaro bo'limi yoki fakultet dekanatiga murojaat qiling. Kechikish jarima va deportatsiya xavfini keltiradi.\n\n${link}`
        : d === 0
          ? `⏰ ${docLabel} muddati BUGUN (${dateText}) tugaydi.\n\nAgar hali yangilamagan bo'lsangiz — zudlik bilan xalqaro bo'limga murojaat qiling.\n\n${link}`
          : `⏰ ${docLabel} muddati tugashiga ${d} kun qoldi (${dateText}).\n\nVizani yangilash / qaytadan ro'yxatga qo'yish uchun xalqaro bo'limga oldindan murojaat qiling. Yangilangач yangi muddatni «Hujjatlarim» bo'limiga kiriting:\n${link}`

    await deps.sendStudentTelegram(doc.student_id, message)
    await sendPushWithoutBreaking(() =>
      deps.sendPush(doc.student_id, {
        title: d < 0 ? `${docLabel} muddati o'tgan 🚨` : `${docLabel}: ${countdownLabel(d)}`,
        body: d < 0
          ? 'Zudlik bilan xalqaro bo‘lim yoki dekanatga murojaat qiling.'
          : `Muddat: ${dateText}. Xalqaro bo‘limga murojaat qiling.`,
        url: '/talaba/hujjatlarim',
        tag: `foreign-doc-${doc.id}`,
      }),
    )
    const email = await deps.resolveStudentEmail(doc.student_id)
    if (email) {
      try {
        await deps.sendEmail(email, doc.users?.full_name ?? '', {
          docLabel,
          expiresOn: doc.expires_on,
          daysLeft: d,
        })
      } catch (error) {
        console.error('Foreign-doc reminder email failed:', error)
      }
    }
    studentsNotified += 1

    if (d <= 3) {
      const faculty = normalizeFaculty(doc.users?.faculty ?? null)
      if (faculty) {
        const line = `• <b>${escapeHtml(doc.users?.full_name ?? '—')}</b> — ${docLabel}, ${countdownLabel(d)} (${escapeHtml(dateText)})`
        const list = digest.get(faculty) ?? []
        list.push(line)
        digest.set(faculty, list)
      }
    }
  }

  await repository.insertReminders(toRecord)

  let dekanDigestsSent = 0
  for (const [faculty, lines] of digest) {
    const text = [
      '📋 <b>Xorijiy talaba hujjatlari — bugungi eslatma</b>',
      escapeHtml(permitFacultyLabel(faculty) || faculty),
      '',
      ...lines,
      '',
      `Dekan panelida ko‘rish: ${appUrl('/dekan/viza-nazorati')}`,
    ].join('\n')
    const ok = await deps.sendDekanTelegram(faculty, text)
    if (ok) dekanDigestsSent += 1
  }

  return {
    scanned: docs.length,
    studentsNotified,
    milestonesRecorded: toRecord.length,
    dekanDigestsSent,
  }
}

function defaultDeps() {
  return {
    sendStudentTelegram,
    sendPush: sendPushForUser,
    sendEmail: sendForeignDocReminderEmail,
    async sendDekanTelegram(faculty: string, text: string) {
      try {
        const chatId = await getDekanTelegramChatId(faculty)
        if (!chatId) return false
        return await sendTelegramChatMessage(chatId, text, { parseMode: 'HTML' as const })
      } catch (error) {
        console.error('Dekan foreign-doc digest failed:', error)
        return false
      }
    },
    async resolveStudentEmail(studentId: string) {
      const { data } = await getServiceSupabase()
        .from('users')
        .select('email')
        .eq('id', studentId)
        .maybeSingle()
      return data?.email ?? null
    },
    today: tashkentToday(),
  }
}
