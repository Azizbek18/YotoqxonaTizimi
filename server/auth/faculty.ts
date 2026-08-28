import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import { normalizeFaculty, PRIMARY_FACULTY } from '@/lib/faculties'
import { ApiError } from '@/server/http/api-error'

/**
 * The faculty a staff member's `faculty` column names, canonicalised.
 * Throws 403 when it is unset — every faculty-scoped staff route needs one
 * (same guard shape as /api/dekan/elonlar and /api/dekan/students).
 */
export function requireStaffFaculty(faculty: string | null | undefined): string {
  const canonical = normalizeFaculty(faculty ?? null)
  if (!canonical) throw new ApiError(403, 'Fakultet biriktirilmagan')
  return canonical
}

/**
 * A staff caller's faculty, or PRIMARY_FACULTY when they have none — for
 * routes shared by dekan (faculty-scoped) and admin (no faculty, operates
 * on the primary building during the transition).
 */
export function staffFacultyOrPrimary(faculty: string | null | undefined): string {
  return normalizeFaculty(faculty ?? null) ?? PRIMARY_FACULTY
}

/**
 * The faculty of any authenticated caller: staff.faculty first, then
 * users.faculty. Falls back to PRIMARY_FACULTY when neither is set (e.g. an
 * admin, or a staff row with no faculty) — the single-building default
 * until every faculty's dorm data is populated (multi-faculty migration,
 * Bosqich 3).
 */
export async function resolveCallerFaculty(userId: string): Promise<string> {
  const supabase = getServiceSupabase()

  const { data: staff } = await supabase.from('staff').select('faculty').eq('id', userId).maybeSingle()
  const staffFaculty = normalizeFaculty(staff?.faculty ?? null)
  if (staffFaculty) return staffFaculty

  const { data: student } = await supabase.from('users').select('faculty').eq('id', userId).maybeSingle()
  return normalizeFaculty(student?.faculty ?? null) ?? PRIMARY_FACULTY
}
