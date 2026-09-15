/** undefined: no building selected yet; null: explicitly unassigned. */
export function studentsInDorm<T extends { dorm_id: string | null }>(
  students: T[], dormId: string | null | undefined,
): T[] {
  if (dormId === undefined) return []
  return students.filter((student) => student.dorm_id === dormId)
}
