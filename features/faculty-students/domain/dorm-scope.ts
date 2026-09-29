/** undefined: no building selected yet; null: explicitly unassigned. */
export function studentsInDorm<T extends { dorm_id: string | null }>(
  students: T[], dormId: string | null | undefined,
): T[] {
  if (dormId === undefined) return []
  return students.filter((student) => student.dorm_id === dormId)
}

/**
 * Permits differ from students: a permit with no building AND no room yet
 * (pending / not placed) belongs to no dorm, so it stays visible on every
 * building tab. Otherwise "Kutilayotgan arizalar" shows 0 once a real
 * building is selected.
 */
export function permitsInDorm<T extends { dorm_id?: string | null; room_number?: string | null }>(
  permits: T[], dormId: string | null | undefined,
): T[] {
  if (dormId === undefined) return []
  return permits.filter((permit) => (permit.dorm_id ?? null) === dormId
    || ((permit.dorm_id ?? null) === null && !permit.room_number))
}
