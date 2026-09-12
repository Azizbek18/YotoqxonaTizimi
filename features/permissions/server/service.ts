import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import { ApiError } from '@/server/http/api-error'
import {
  PERMISSION_SUBJECTS,
  sanitizePermissions,
  type PermissionMap,
  type PermissionSubject,
} from '../types'

export type PermissionMember = {
  id: string
  subject: PermissionSubject
  fullName: string
  /** Email for a tarbiyachi, room/floor for a sardor — enough to tell two
   *  people with similar names apart in the dekan's list. */
  detail: string
  permissions: PermissionMap
}

function asMap(value: unknown, subject: PermissionSubject): PermissionMap {
  return sanitizePermissions(subject, value)
}

export function createPermissionsService() {
  const supabase = getServiceSupabase()

  return {
    /** Everyone in this faculty whose rights the dekan can tune. */
    async listMembers(faculty: string): Promise<PermissionMember[]> {
      const [staffResult, captainResult] = await Promise.all([
        supabase
          .from('staff')
          .select('id, full_name, email, permissions, assigned_floor, status')
          .eq('role', 'tarbiyachi')
          .eq('status', 'active')
          .or(`faculty.eq.${faculty},faculty.is.null`)
          .order('full_name', { ascending: true }),
        supabase
          .from('users')
          .select('id, full_name, room_number, assigned_floor, gender, captain_permissions')
          .eq('role', 'talaba')
          .eq('status', 'active')
          .eq('is_floor_captain', true)
          .ilike('faculty', faculty)
          .order('full_name', { ascending: true }),
      ])

      if (staffResult.error) throw staffResult.error
      if (captainResult.error) throw captainResult.error

      const tarbiyachi: PermissionMember[] = (staffResult.data ?? []).map((row) => ({
        id: String(row.id),
        subject: 'tarbiyachi' as const,
        fullName: String(row.full_name ?? 'Noma’lum'),
        detail: [row.email, row.assigned_floor ? `${row.assigned_floor}-qavat` : null]
          .filter(Boolean).join(' · '),
        permissions: asMap(row.permissions, 'tarbiyachi'),
      }))

      const sardor: PermissionMember[] = (captainResult.data ?? []).map((row) => ({
        id: String(row.id),
        subject: 'sardor' as const,
        fullName: String(row.full_name ?? 'Noma’lum'),
        detail: [
          row.assigned_floor ? `${row.assigned_floor}-qavat` : null,
          row.gender === 'female' ? 'qizlar' : row.gender === 'male' ? 'yigitlar' : null,
          row.room_number ? `${row.room_number}-xona` : null,
        ].filter(Boolean).join(' · '),
        permissions: asMap(row.captain_permissions, 'sardor'),
      }))

      return [...tarbiyachi, ...sardor]
    },

    /**
     * Replaces one member's permission map. Scoped to the caller's faculty so
     * a dekan can't reach into another faculty's staff, and the payload is
     * sanitised to the keys that subject actually owns.
     */
    async update(faculty: string, input: unknown): Promise<{ ok: true; permissions: PermissionMap }> {
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new ApiError(400, "So'rov noto'g'ri")
      }
      const body = input as Record<string, unknown>
      const memberId = typeof body.memberId === 'string' ? body.memberId.trim() : ''
      const subject = body.subject as PermissionSubject

      if (!/^[0-9a-f-]{36}$/i.test(memberId)) throw new ApiError(400, "Identifikator noto'g'ri")
      if (!PERMISSION_SUBJECTS.includes(subject)) throw new ApiError(400, "Rol noto'g'ri")

      const permissions = sanitizePermissions(subject, body.permissions)

      if (subject === 'tarbiyachi') {
        const { data: target, error } = await supabase
          .from('staff')
          .select('id, role, faculty')
          .eq('id', memberId)
          .maybeSingle()
        if (error) throw error
        if (!target || target.role !== 'tarbiyachi') throw new ApiError(404, 'Tarbiyachi topilmadi')
        // A legacy row with no faculty yet is still this dekan's to manage,
        // matching how the staff list itself is scoped.
        if (target.faculty && target.faculty !== faculty) {
          throw new ApiError(403, 'Boshqa fakultet xodimini boshqarib bo‘lmaydi')
        }
        const { error: updateError } = await supabase
          .from('staff').update({ permissions }).eq('id', memberId)
        if (updateError) throw updateError
      } else {
        const { data: target, error } = await supabase
          .from('users')
          .select('id, faculty, is_floor_captain')
          .eq('id', memberId)
          .maybeSingle()
        if (error) throw error
        if (!target?.is_floor_captain) throw new ApiError(404, 'Qavat sardori topilmadi')
        if ((target.faculty ?? '').toLowerCase() !== faculty.toLowerCase()) {
          throw new ApiError(403, 'Boshqa fakultet talabasini boshqarib bo‘lmaydi')
        }
        const { error: updateError } = await supabase
          .from('users').update({ captain_permissions: permissions }).eq('id', memberId)
        if (updateError) throw updateError
      }

      return { ok: true, permissions }
    },
  }
}
