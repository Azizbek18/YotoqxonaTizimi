import 'server-only'
import { cookies } from 'next/headers'
import { getServiceSupabase } from '@/lib/server-supabase'
import { normalizeFaculty } from '@/lib/faculties'
import { ApiError } from '@/server/http/api-error'

/** Superadmin (`admin` role) "acting scope" — a faculty code, or `*` = global. */
export const SUPERADMIN_SCOPE_COOKIE = 'sa_scope'
export const GLOBAL_SCOPE = '*'

/**
 * Reads the sa_scope cookie: `global` (cross-faculty) or one faculty. Only
 * meaningful for the `admin` role — see the scope injection in
 * requireActiveStaff (server/auth/guards.ts). A missing / `*` / unknown
 * value is treated as global.
 */
export async function readSuperadminScope(): Promise<'global' | { faculty: string }> {
  const raw = (await cookies()).get(SUPERADMIN_SCOPE_COOKIE)?.value
  if (!raw || raw === GLOBAL_SCOPE) return 'global'
  const faculty = normalizeFaculty(raw)
  return faculty ? { faculty } : 'global'
}

/**
 * The faculty for a route that can only ever operate on ONE faculty (the
 * room editor, dorm setup, per-faculty settings). A superadmin in global
 * mode gets SCOPE_REQUIRED so the client can show a faculty picker.
 */
export function requirePickedFaculty(staff: { faculty: string | null; superadminGlobal?: boolean }): string {
  if (staff.superadminGlobal) {
    throw new ApiError(400, 'Avval fakultetni tanlang', 'SCOPE_REQUIRED')
  }
  return requireStaffFaculty(staff.faculty)
}

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
 * Legacy export retained for existing callers. Missing faculty now fails
 * closed instead of silently granting access to the AMIT faculty.
 */
export function staffFacultyOrPrimary(faculty: string | null | undefined): string {
  return requireStaffFaculty(faculty)
}

/**
 * The faculty of any authenticated caller: staff.faculty first, then
 * users.faculty. Missing or unrecognised assignments fail closed.
 */
export async function resolveCallerFaculty(userId: string): Promise<string> {
  const supabase = getServiceSupabase()

  const { data: staff, error: staffError } = await supabase.from('staff').select('faculty, role').eq('id', userId).maybeSingle()
  if (staffError) throw staffError
  // A superadmin who has picked a faculty in the sidebar resolves to it;
  // global mode must pick a faculty for these single-faculty endpoints.
  if (staff?.role === 'admin') {
    const scope = await readSuperadminScope()
    if (scope !== 'global') return scope.faculty
    throw new ApiError(400, 'Avval fakultetni tanlang', 'SCOPE_REQUIRED')
  }
  if (staff) return requireStaffFaculty(staff.faculty)

  const { data: student, error: studentError } = await supabase.from('users').select('faculty').eq('id', userId).maybeSingle()
  if (studentError) throw studentError
  return requireStaffFaculty(student?.faculty)
}

/**
 * Every faculty that shares a staff member's dorm building — the scope for
 * a tarbiyachi, who supervises the whole building regardless of which
 * faculty each resident studies at (shared-dorm tenancy, P4). Falls back to
 * just the staff's own faculty when they have no dorm yet, so a
 * single-faculty building behaves exactly as before.
 */
export async function staffDormFaculties(
  staffId: string,
  fallbackFaculty: string | null | undefined,
): Promise<string[]> {
  const supabase = getServiceSupabase()
  const fallback = requireStaffFaculty(fallbackFaculty)

  // Prefer the staff row's own dorm; otherwise resolve it from their
  // faculty's mapping (covers a tarbiyachi who registered before the dekan
  // set the building up).
  const { data: staff } = await supabase
    .from('staff')
    .select('dorm_id')
    .eq('id', staffId)
    .maybeSingle()

  let dormId: string | null = staff?.dorm_id ?? null
  if (!dormId) {
    const { data: link } = await supabase
      .from('faculty_dorm')
      .select('dorm_id')
      .eq('faculty', fallback)
      .eq('is_primary', true)
      .maybeSingle()
    dormId = link?.dorm_id ?? null
  }

  if (dormId) {
    const { data } = await supabase
      .from('faculty_dorm')
      .select('faculty')
      .eq('dorm_id', dormId)
    const list = (data ?? [])
      .map((row) => normalizeFaculty(row.faculty))
      .filter((f): f is NonNullable<typeof f> => f !== null)
    if (list.length > 0) return list
  }

  return [fallback]
}
