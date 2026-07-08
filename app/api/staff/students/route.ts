import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { getRequestUser } from '@/lib/server-auth'
import { extractFloor } from '@/lib/floor'

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

    let studentsQuery = serviceSupabase
      .from('users')
      .select('*')
      .eq('role', 'talaba')
      .order('created_at', { ascending: false })

    // Gender is an exact-match field, so it can be pushed down into SQL to cut
    // down the number of rows fetched. Floor is derived from room_number via
    // regex and stays as a JS filter below.
    if (staffUser.assigned_gender) {
      studentsQuery = studentsQuery.ilike('gender', staffUser.assigned_gender)
    }

    const { data: students, error: studentsError } = await studentsQuery

    if (studentsError) {
      return jsonError(studentsError.message, 500)
    }

    const filteredStudents = (students ?? []).filter((student) => {
      const floorOk = staffUser.assigned_floor
        ? extractFloor((student.room_number as string | null | undefined) ?? null) === staffUser.assigned_floor
        : true

      return floorOk
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
