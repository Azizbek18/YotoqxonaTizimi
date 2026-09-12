import { ApiError } from '@/server/http/api-error'

export type UserSource = 'users' | 'staff'

/**
 * Decides which table a delete actually targets. `source` arrives from the
 * browser and cannot be trusted to pick the authorization rules, so the
 * caller resolves the row from the database first and this asserts the
 * submitted source agrees with it.
 *
 * Lives outside `route.ts` because Next.js route files may only export
 * request handlers and a fixed set of config keys — exporting a helper from
 * one makes the generated route types fail to typecheck.
 */
export function resolveDeleteTarget(
  submittedSource: UserSource,
  student: { id: string } | null,
  staff: { id: string; role: string } | null,
): UserSource {
  if (student && staff) {
    throw new ApiError(409, "Hisob bir nechta profil jadvalida topildi; o'chirish xavfsizlik sabab to'xtatildi")
  }
  if (!student && !staff) throw new ApiError(404, 'Foydalanuvchi topilmadi')

  const resolvedSource: UserSource = staff ? 'staff' : 'users'
  if (submittedSource !== resolvedSource) {
    throw new ApiError(409, "Foydalanuvchi manbasi eskirgan yoki noto'g'ri")
  }
  if (staff?.role === 'dekan') {
    throw new ApiError(403, "Dekan profilini admin panelidan o'chirib bo'lmaydi")
  }
  return resolvedSource
}
