import 'server-only'

import { normalizeFaculty } from '@/lib/faculties'
import { checkRateLimit } from '@/lib/security'
import { sendTelegramChatMessage } from '@/lib/telegram'
import { findStudentByTelegramChat } from '@/lib/student-telegram'
import { createAttendanceService } from '@/features/attendance/server/service'

export type TelegramLocationMessage = {
  date?: number
  location?: { latitude: number; longitude: number; horizontal_accuracy?: number }
  forward_origin?: unknown
  forward_date?: number
  via_bot?: unknown
}

/** A location older than this is a re-sent / stale pin, not "right now". */
const MAX_LOCATION_AGE_S = 120
/** Telegram omits the accuracy for some clients; assume a modest fix. */
const DEFAULT_ACCURACY_M = 100

const CHECKIN_KEYBOARD = {
  keyboard: [[{ text: '📍 Yo‘qlamada ekanligimni tasdiqlash', request_location: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
}

/** `/yoqlama` — asks the student to share their current location. */
export async function promptTelegramCheckin(chatId: number) {
  const student = await findStudentByTelegramChat(chatId)
  if (!student) {
    await sendTelegramChatMessage(
      String(chatId),
      'Bu Telegram akkaunt talaba profiliga ulanmagan. Saytdagi <b>Telegram botga ulash</b> tugmasi orqali ulang.',
      { parseMode: 'HTML' },
    )
    return
  }
  await sendTelegramChatMessage(
    String(chatId),
    '📍 Quyidagi tugmani bosib <b>joriy joylashuvingizni</b> yuboring.\n\n'
      + '<i>Faqat tugma orqali yuboring — qo‘lda tanlangan nuqta yoki boshqa joydan yuborilgan joylashuv qabul qilinmaydi.</i>',
    { parseMode: 'HTML', replyMarkup: CHECKIN_KEYBOARD },
  )
}

/** A location message from the bot chat → the same server-side check-in the site uses. */
export async function handleTelegramLocation(chatId: number, message: TelegramLocationMessage) {
  const reply = (text: string) =>
    sendTelegramChatMessage(String(chatId), text, { parseMode: 'HTML', replyMarkup: { remove_keyboard: true } })

  const loc = message.location
  if (!loc || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return

  // Only a fresh, first-hand pin: no forwards, no inline-bot pins, not stale.
  const age = Math.floor(Date.now() / 1000) - (message.date ?? 0)
  if (message.forward_origin || message.forward_date || message.via_bot || age > MAX_LOCATION_AGE_S) {
    await reply('⚠️ Bu joylashuv qabul qilinmadi. /yoqlama buyrug‘ini yuborib, tugma orqali <b>hozirgi</b> joylashuvingizni yuboring.')
    return
  }

  const student = await findStudentByTelegramChat(chatId)
  if (!student) {
    await reply('Bu Telegram akkaunt talaba profiliga ulanmagan yoki profil faol emas.')
    return
  }

  const throttle = await checkRateLimit(`attendance-tg:${student.id}`, 8, 10 * 60_000)
  if (!throttle.allowed) {
    await reply('Juda ko‘p urinish. Birozdan keyin qayta urining.')
    return
  }

  const faculty = normalizeFaculty(student.faculty)
  if (!faculty) {
    await reply('Hozir ochiq yo‘qlama yo‘q.')
    return
  }

  const result = await createAttendanceService().checkin(student.id, faculty, {
    lat: loc.latitude,
    lng: loc.longitude,
    accuracy: loc.horizontal_accuracy ?? DEFAULT_ACCURACY_M,
  })

  switch (result.status) {
    case 'present':
      await reply('✅ Yo‘qlamada «bor» deb belgilandingiz. Yotoqxonada ekanligingiz tasdiqlandi.')
      return
    case 'outside':
      await reply(`❌ Siz yotoqxonadan ~${Math.round(result.distanceM)} m uzoqdasiz. Yotoqxonaga kelib qayta urining yoki sardorga ayting.`)
      return
    case 'already':
      await reply('ℹ️ Yo‘qlamangiz allaqachon qayd etilgan.')
      return
    case 'retry':
      await reply('📡 Joylashuv aniqligi yetarli emas. Ochiq joyga chiqib, /yoqlama ni qayta yuboring.')
      return
    case 'no_session':
      await reply('Hozir ochiq yo‘qlama yo‘q.')
      return
    default:
      await reply('Hozircha yo‘qlamani tasdiqlab bo‘lmadi. Birozdan keyin urining yoki sardorga ayting.')
  }
}
