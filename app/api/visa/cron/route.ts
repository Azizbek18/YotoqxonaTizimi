import { NextRequest, NextResponse } from 'next/server'
import { safeEqual } from '@/lib/security'
import { runForeignDocReminders } from '@/features/foreign-docs/server/reminders'

// GitHub Actions kuniga bir marta (~06:00 Asia/Tashkent) chaqiradi. Har faol
// viza/propiska hujjati uchun muddatga qolgan kunni hisoblab, yangi "kelgan"
// bosqichni (30/15/10/5/3/0, keyin muddat o'tgach 7 kun) talabaga yuboradi va
// dekanga digest beradi. Jurnal orqali idempotent — takror chaqiruv zararsiz.
export async function POST(request: NextRequest) {
  const secret = process.env.VISA_CRON_SECRET
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || !safeEqual(secret, provided ?? undefined)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runForeignDocReminders()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('Visa reminder cron failed:', error)
    return NextResponse.json({ error: 'cron failed' }, { status: 500 })
  }
}

export const GET = POST
