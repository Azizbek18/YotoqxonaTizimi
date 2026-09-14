import 'server-only'
import { createDormRepository } from '@/features/dorms/server/repository'
import { ApiError } from '@/server/http/api-error'

/** An omitted filter preserves legacy aggregate callers; explicit IDs must be owned. */
export async function requireDormFilter(faculty: string | null, value: string | null,
  repository: Pick<ReturnType<typeof createDormRepository>, 'facultyDormIds'> = createDormRepository(),
): Promise<string | null | undefined> {
  if (value === null) return undefined
  if (!faculty) throw new ApiError(403, 'Fakultet biriktirilmagan')
  if (value === 'unassigned') return null
  const ids = await repository.facultyDormIds(faculty)
  if (!ids.includes(value)) throw new ApiError(403, 'Bu yotoqxona sizga tegishli emas')
  return value
}
