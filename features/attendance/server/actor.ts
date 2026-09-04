import 'server-only'
import { getRequestUser } from '@/lib/server-auth'
import { getServiceSupabase } from '@/lib/server-supabase'
import { normalizeFaculty } from '@/lib/faculties'
import { resolveCallerFaculty } from '@/server/auth/faculty'
import { ApiError } from '@/server/http/api-error'
import { createAttendanceRepository } from './repository'
import type { AttendanceActor } from '../types'

/**
 * Who is acting on a yo'qlama session:
 *  - a floor captain (`users.is_floor_captain`) — scoped to their floor+gender,
 *  - a tarbiyachi — the whole building (every faculty sharing the dorm),
 *  - a dekan/admin — read-only oversight of their faculty's building.
 * Every /api/attendance/* route resolves through this.
 */
export async function resolveAttendanceActor(request: Request): Promise<AttendanceActor> {
  const user = await getRequestUser(request)
  if (!user?.id) throw new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED')

  const supabase = getServiceSupabase()
  const repo = createAttendanceRepository()

  const { data: student } = await supabase
    .from('users')
    .select('role, status, is_floor_captain, assigned_floor, gender, faculty')
    .eq('id', user.id)
    .maybeSingle()

  if (student?.role === 'talaba' && student.status === 'active' && student.is_floor_captain) {
    if (!student.assigned_floor || (student.gender !== 'male' && student.gender !== 'female')) {
      throw new ApiError(400, 'Sardorlik qavati yoki jinsi belgilanmagan')
    }
    const faculty = normalizeFaculty(student.faculty)
    if (!faculty) throw new ApiError(403, 'Fakultet biriktirilmagan')
    const dormId = await repo.dormIdForFaculty(faculty)
    if (!dormId) throw new ApiError(409, 'Yotoqxona hali sozlanmagan — dekanga murojaat qiling', 'DORM_NOT_SET')
    return {
      userId: user.id,
      role: 'sardor',
      dormId,
      faculties: [faculty],
      floor: student.assigned_floor,
      gender: student.gender,
      canWrite: true,
    }
  }

  // A plain resident (not a floor captain): read-only. The dashboard banner
  // and the /talaba/yoqlama check-in screen gate their UI on
  // /api/attendance/summary, so this branch is what makes the "Men
  // yotoqxonadaman" button appear at all for an ordinary student. Marking
  // still runs through /api/attendance/checkin (requireActiveStudent).
  if (student?.role === 'talaba' && student.status === 'active') {
    const faculty = normalizeFaculty(student.faculty)
    if (!faculty) throw new ApiError(403, 'Fakultet biriktirilmagan')
    const dormId = await repo.dormIdForFaculty(faculty)
    if (!dormId) throw new ApiError(409, 'Yotoqxona hali sozlanmagan', 'DORM_NOT_SET')
    return {
      userId: user.id,
      role: 'talaba',
      dormId,
      faculties: [faculty],
      floor: null,
      gender: null,
      canWrite: false,
    }
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('role, status, faculty, dorm_id, assigned_gender')
    .eq('id', user.id)
    .maybeSingle()

  if (!staff || staff.status !== 'active' || !['tarbiyachi', 'dekan', 'admin'].includes(staff.role)) {
    throw new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN')
  }

  if (staff.role === 'tarbiyachi') {
    let dormId = staff.dorm_id ?? null
    const staffFaculty = normalizeFaculty(staff.faculty)
    if (!dormId && staffFaculty) dormId = await repo.dormIdForFaculty(staffFaculty)
    if (!dormId) throw new ApiError(409, 'Yotoqxona hali sozlanmagan', 'DORM_NOT_SET')
    const faculties = await repo.facultiesForDorm(dormId)
    const gender = staff.assigned_gender === 'male' || staff.assigned_gender === 'female'
      ? staff.assigned_gender
      : null
    return {
      userId: user.id,
      role: 'tarbiyachi',
      dormId,
      faculties: faculties.length > 0 ? faculties : (staffFaculty ? [staffFaculty] : []),
      floor: null,
      gender,
      canWrite: true,
    }
  }

  // dekan / admin — read-only oversight of one faculty's building.
  const faculty = await resolveCallerFaculty(user.id)
  const dormId = await repo.dormIdForFaculty(faculty)
  if (!dormId) throw new ApiError(409, 'Yotoqxona hali sozlanmagan', 'DORM_NOT_SET')
  return {
    userId: user.id,
    role: 'dekan',
    dormId,
    faculties: [faculty],
    floor: null,
    gender: null,
    canWrite: false,
  }
}
