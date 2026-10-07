import { NextRequest, NextResponse } from 'next/server'
import { safeEqual } from '@/lib/security'
import { createAttendanceService } from '@/features/attendance/server/service'
import { createDekanAttendanceService } from '@/features/attendance/server/dekan-service'

// GitHub Actions ~ har 5 daqiqada chaqiradi (dekan yo'qlamasi eslatmalari uchun). Har binoning yo'qlama oynasi
// ochilganda kechki sessiya yaratadi + talabalarga push yuboradi; muddati
// o'tgan sessiyalarni yopadi. Idempotent.
export async function POST(request: NextRequest) {
  const secret = process.env.ATTENDANCE_CRON_SECRET
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || !safeEqual(secret, provided ?? undefined)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await createAttendanceService().runNightlyCron()
    // Dekan roll-calls are an independent system: a failure in one must not
    // stop the other, so each is guarded separately.
    const dekan = await Promise.resolve().then(() => createDekanAttendanceService().runCron()).catch((error) => {
      console.error('Dekan attendance cron failed:', error)
      return { error: true as const }
    })
    // Nightly reminders (every 5 min to unconfirmed residents) are best-effort too.
    const reminders = await Promise.resolve().then(() => createAttendanceService().runNightlyReminders()).catch((error) => {
      console.error('Nightly attendance reminders failed:', error)
      return { error: true as const }
    })
    return NextResponse.json({ ok: true, ...result, dekan, reminders })
  } catch (error) {
    console.error('Attendance cron failed:', error)
    return NextResponse.json({ error: 'cron failed' }, { status: 500 })
  }
}

// Vercel Cron ham GET yuboradi — bir xil ish.
export const GET = POST
