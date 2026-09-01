import { NextRequest, NextResponse } from 'next/server'
import { safeEqual } from '@/lib/security'
import { createAttendanceService } from '@/features/attendance/server/service'

// GitHub Actions ~ har 15 daqiqada chaqiradi. Har binoning yo'qlama oynasi
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
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('Attendance cron failed:', error)
    return NextResponse.json({ error: 'cron failed' }, { status: 500 })
  }
}

// Vercel Cron ham GET yuboradi — bir xil ish.
export const GET = POST
