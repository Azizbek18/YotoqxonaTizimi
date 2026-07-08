import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/server-auth'
import { getServiceSupabase } from '@/lib/server-supabase'
import { extractFloor } from '@/lib/floor'

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request)
    const serviceSupabase = getServiceSupabase()

    let currentFaculty: string | null = null
    let userFloor: number | null = null
    let userGender: string | null = null

    if (user?.id) {
      const { data: userData } = await serviceSupabase
        .from('users')
        .select('faculty, room_number, gender, assigned_floor')
        .eq('id', user.id)
        .maybeSingle()

      if (userData) {
        currentFaculty = typeof userData.faculty === 'string' && userData.faculty.trim()
          ? userData.faculty.trim()
          : null
        userFloor = userData.assigned_floor || extractFloor(userData.room_number)
        userGender = userData.gender || null
      }
    }

    const { data, error } = await serviceSupabase
      .from('elonlar')
      .select('id, title, text, type, audience, faculty, is_published, created_at, published_at, created_by, target_floor, target_gender')
      .eq('is_published', true)
      // Exclude internal data-storage rows (e.g. the floor duty-schedule JSON
      // saved by floor captains) — these are never meant to appear as
      // student-facing announcements.
      .neq('title', 'HAFTALIK_NAVBATCHILIK_JADVALI')
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch creators names and details
    const creatorIds = Array.from(new Set(data?.map(e => e.created_by).filter(Boolean) || [])) as string[]
    const creatorsMap = new Map<string, { name: string; isCaptain: boolean; floor?: number }>()

    if (creatorIds.length > 0) {
      const [studentsRes, staffRes] = await Promise.all([
        serviceSupabase
          .from('users')
          .select('id, full_name, is_floor_captain, assigned_floor')
          .in('id', creatorIds),
        serviceSupabase
          .from('staff')
          .select('id, full_name')
          .in('id', creatorIds)
      ])

      studentsRes.data?.forEach(u => {
        creatorsMap.set(u.id, {
          name: u.full_name,
          isCaptain: !!u.is_floor_captain,
          floor: u.assigned_floor || undefined
        })
      })

      staffRes.data?.forEach(s => {
        creatorsMap.set(s.id, {
          name: s.full_name,
          isCaptain: false
        })
      })
    }

    const filtered = (data ?? []).filter((elon) => {
      if (elon.audience === 'all') return true
      if (elon.audience === 'faculty') {
        return Boolean(currentFaculty && elon.faculty === currentFaculty)
      }
      if (elon.audience === 'floor') {
        const floorMatch = elon.target_floor === null || elon.target_floor === userFloor
        const genderMatch = elon.target_gender === null || elon.target_gender === userGender
        return Boolean(userFloor && floorMatch && genderMatch)
      }
      return false
    })

    const elonlar = filtered.map((elon) => {
      const creator = creatorsMap.get(elon.created_by || '')
      return {
        id: elon.id,
        title: elon.title,
        text: elon.text,
        type: elon.type,
        audience: elon.audience,
        faculty: elon.faculty,
        created_at: elon.created_at,
        published_at: elon.published_at,
        author_name: creator ? creator.name : "Tizim ma'muri",
        is_from_captain: creator ? creator.isCaptain : false,
        captain_floor: creator ? creator.floor : undefined
      }
    })

    return NextResponse.json({ elonlar, currentFaculty })
  } catch (error) {
    console.error('Elonlar GET xato:', error)
    return NextResponse.json({ error: "E'lonlarni yuklashda xatolik" }, { status: 500 })
  }
}
