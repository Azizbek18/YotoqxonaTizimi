import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { getRequestUser } from '@/lib/server-auth'

type StaffProfile = {
  id: string
  email: string
  role: string
  assigned_floor?: number | null
  assigned_gender?: string | null
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

function extractFloor(roomNumber?: string | null) {
  if (!roomNumber) return null
  const matched = roomNumber.match(/\d+/)
  if (!matched) return null
  const parsed = Number(matched[0])
  if (!Number.isFinite(parsed)) return null
  return Math.max(1, Math.floor((parsed - 1) / 30) + 1)
}

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req)
    const serviceSupabase = getServiceSupabase()

    if (!user?.id) {
      return jsonError('Autentifikatsiya talab qilinadi', 401)
    }

    const { data: staffUser, error: staffError } = await serviceSupabase
      .from('staff')
      .select('id, email, role, assigned_floor, assigned_gender')
      .or(`id.eq.${user.id},email.eq.${user.email?.trim().toLowerCase() ?? ''}`)
      .maybeSingle<StaffProfile>()

    if (staffError) {
      return jsonError(staffError.message, 500)
    }

    if (!staffUser || staffUser.role !== 'tarbiyachi') {
      return jsonError('Tarbiyachi huquqi talab qilinadi', 403)
    }

    const { data: students, error: studentsError } = await serviceSupabase
      .from('users')
      .select('*')
      .eq('role', 'talaba')
      .order('created_at', { ascending: false })

    if (studentsError) {
      return jsonError(studentsError.message, 500)
    }

    const filteredStudents = (students ?? []).filter((student) => {
      const floorOk = staffUser.assigned_floor
        ? extractFloor((student.room_number as string | null | undefined) ?? null) === staffUser.assigned_floor
        : true

      const genderOk = staffUser.assigned_gender
        ? String(student.gender ?? '').toLowerCase() === String(staffUser.assigned_gender).toLowerCase()
        : true

      return floorOk && genderOk
    })

    return NextResponse.json({
      ok: true,
      students: filteredStudents,
      scope: {
        assigned_floor: staffUser.assigned_floor ?? null,
        assigned_gender: staffUser.assigned_gender ?? null,
      },
    })
  } catch (error) {
    console.error('Staff students GET xato:', error)
    return jsonError('Talabalarni yuklashda server xatosi yuz berdi', 500)
  }
}
