/** A student with this many signed tushuntirish xatlari is flagged red. */
export const EXPLANATION_RED_THRESHOLD = 3

export function isExplanationRed(count: number | null | undefined): boolean {
  return (count ?? 0) >= EXPLANATION_RED_THRESHOLD
}
