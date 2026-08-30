import 'server-only'
import { cookies } from 'next/headers'
import { getServiceSupabase } from '@/lib/server-supabase'
import { normalizeFaculty, PRIMARY_FACULTY } from '@/lib/faculties'
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

  const { data: staff } = await supabase.from('staff').select('faculty, role').eq('id', userId).maybeSingle()
  // A superadmin who has picked a faculty in the sidebar resolves to it;
  // global mode falls through to their bound faculty as a harmless default
  // (room-map style endpoints are inherently single-faculty).
  if (staff?.role === 'admin') {
    const scope = await readSuperadminScope()
    if (scope !== 'global') return scope.faculty
  }
  const staffFaculty = normalizeFaculty(staff?.faculty ?? null)
  if (staffFaculty) return staffFaculty

  const { data: student } = await supabase.from('users').select('faculty').eq('id', userId).maybeSingle()
  return normalizeFaculty(student?.faculty ?? null) ?? PRIMARY_FACULTY
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
  const fallback = normalizeFaculty(fallbackFaculty ?? null) ?? PRIMARY_FACULTY

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
