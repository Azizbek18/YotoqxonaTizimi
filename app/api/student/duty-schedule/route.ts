import { NextRequest, NextResponse } from 'next/server'
import { extractFloor } from '@/lib/floor'
import { getRequestUser } from '@/lib/server-auth'
import { getServiceSupabase } from '@/lib/server-supabase'

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request)
    if (!user?.id) {
      return NextResponse.json({ error: 'Autentifikatsiya talab qilinadi' }, { status: 401 })
    }

    const supabase = getServiceSupabase()
    const { data: profile } = await supabase
      .from('users')
      .select('id, full_name, email, role, status, gender, room_number, faculty, assigned_floor')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'talaba' || profile.status !== 'active') {
      return NextResponse.json({ error: 'Faol talaba profili topilmadi' }, { status: 403 })
    }

    const floor = profile.assigned_floor || extractFloor(profile.room_number)
    if (!floor || !profile.gender) {
      return NextResponse.json({ profile, floorCaptains: [], schedule: {}, admins: [] })
    }

    const [captainsResult, scheduleResult] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, room_number, phone_number, avatar_url')
        .eq('role', 'talaba')
        .eq('status', 'active')
        .eq('is_floor_captain', true)
        .eq('assigned_floor', floor)
        .eq('gender', profile.gender),
      supabase
        .from('elonlar')
        .select('text')
        .eq('title', 'HAFTALIK_NAVBATCHILIK_JADVALI')
        .eq('target_floor', floor)
        .eq('target_gender', profile.gender)
        .maybeSingle(),
    ])

    let schedule = {}
    let admins: unknown[] = []
    if (scheduleResult.data?.text) {
      try {
        const parsed = JSON.parse(scheduleResult.data.text)
        if (parsed?.schedule && typeof parsed.schedule === 'object') schedule = parsed.schedule
        if (Array.isArray(parsed?.admins)) admins = parsed.admins
      } catch {
        // A malformed legacy row is treated as an empty schedule.
      }
    }

    return NextResponse.json({
      profile,
      floorCaptains: captainsResult.data ?? [],
      schedule,
      admins,
    })
  } catch (error) {
    console.error('Duty schedule GET error:', error)
    return NextResponse.json({ error: 'Navbatchilik ma’lumotlarini yuklab bo‘lmadi' }, { status: 500 })
  }
}
