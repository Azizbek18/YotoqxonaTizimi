/**
 * Qabul yili: guruh kodidagi 2 xonali yildan (TMI-2301 → 2023), bo'lmasa joriy
 * o'quv yili va kursdan hisoblanadi. O'quv yili sentyabrda boshlanadi.
 */
export function admissionYearFor(group: string | undefined, course: number, now = new Date()): number {
  const academicStart = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  const fromGroup = /(?:^|\D)(\d{2})\d{2}(?:\D|$)/.exec(group ?? '')
  if (fromGroup) {
    const year = 2000 + Number(fromGroup[1])
    if (year <= academicStart && academicStart - year <= 5) return year
  }
  return academicStart - (Math.min(Math.max(course, 1), 4) - 1)
}
