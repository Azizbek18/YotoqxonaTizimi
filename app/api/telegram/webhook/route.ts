import { NextResponse } from 'next/server'
import { bindPermitTelegramChat, formatPermitTelegramMessage } from '@/lib/permit-telegram'
import { bindStudentTelegramChat } from '@/lib/student-telegram'
import { sendTelegramChatMessage } from '@/lib/telegram'

type TelegramUpdate = {
  message?: {
    text?: string
    chat?: { id?: number; type?: string }
  }
}

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  const suppliedSecret = request.headers.get('x-telegram-bot-api-secret-token')
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const update = await request.json() as TelegramUpdate
    const chatId = update.message?.chat?.id
    const chatType = update.message?.chat?.type
    const text = update.message?.text?.trim() ?? ''
    if (!chatId || chatType !== 'private') return NextResponse.json({ ok: true })

    const match = text.match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+([A-Za-z0-9_-]{20,64}))?$/)
    if (!match?.[1]) {
      await sendTelegramChatMessage(
        String(chatId),
        'Assalomu alaykum! Arizangiz yuborilgandan keyin saytdagi <b>Telegram botga ulash</b> tugmasini bosing.\n\n'
          + `Agar siz <b>dekan</b> bo‘lsangiz — quyidagi ID ni saytda «Sozlamalar → Yangi ariza Telegram bildirishnomasi»ga kiriting:\n<code>${chatId}</code>`,
        { parseMode: 'HTML' },
      )
      return NextResponse.json({ ok: true })
    }

    const permit = await bindPermitTelegramChat(match[1], chatId)
    if (!permit) {
      // Not a permit link — maybe a registered student linking their account.
      const student = await bindStudentTelegramChat(match[1], chatId)
      if (student) {
        await sendTelegramChatMessage(
          String(chatId),
          `🔔 <b>Telegram ulandi</b>\n\nHurmatli <b>${student.name.replaceAll('<', '&lt;')}</b>, endi yuborgan arizalaringiz nusxasi shu botga keladi.`,
          {
            parseMode: 'HTML',
            replyMarkup: { inline_keyboard: [[{ text: 'Arizalarim', url: `${process.env.NEXT_PUBLIC_APP_URL}/talaba/arizalar` }]] },
          },
        )
        return NextResponse.json({ ok: true })
      }
      await sendTelegramChatMessage(String(chatId), '⚠️ Bu havola eskirgan yoki avval boshqa Telegram akkauntiga ulangan. Saytdan yangi havola oling.')
      return NextResponse.json({ ok: true })
    }

    const sent = await sendTelegramChatMessage(String(chatId), formatPermitTelegramMessage(permit), {
      parseMode: 'HTML',
      replyMarkup: { inline_keyboard: [[{ text: 'Ariza holatini ochish', url: `${process.env.NEXT_PUBLIC_APP_URL}/ruxsatnoma-tekshirish` }]] },
    })
    if (!sent) throw new Error('Telegram START acknowledgement could not be sent')

    // The bind acknowledgement is also the current status notification;
    // the next real status change will still be delivered by the dean flow.
    const { getServiceSupabase } = await import('@/lib/server-supabase')
    const { error: markError } = await getServiceSupabase().from('permit_telegram_links')
      .update({ last_notified_status: permit.status, updated_at: new Date().toISOString() })
      .eq('permit_request_id', permit.id)
    if (markError) throw markError
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook failed:', error)
    // A non-2xx response makes Telegram retry transient database/network errors.
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
