/**
 * Per-floor course-year balance. The dekan wants every floor to hold a
 * representative mix of all four courses (1–4) — not "1-qavat = hamma
 * 1-kurs". The ideal for a floor is capacity-proportional: a floor with
 * 20% of the beds should hold ~20% of each course.
 *
 * Pure + framework-free so `features/permits/server/service.ts` builds the
 * dashboard payload with it and `app/dekan/xonalar/page.tsx` recomputes it
 * live (as the dekan places students) from the same maths.
 */

export const COURSES = [1, 2, 3, 4] as const
export type Course = (typeof COURSES)[number]
export type CourseCount = Record<number, number>

// Tunables — exported so the thresholds are easy to find and adjust.
export const OVER_RATIO = 1.3 // "over" needs placed >= target * this
export const MIN_DELTA = 2 // ...and an absolute gap of at least this
export const NEAR_EMPTY_ABS = 4 // a floor with fewer placed than this is left alone
export const NEAR_EMPTY_FRAC = 0.2 // ...or fewer than this fraction of its beds

export type CourseStatus = 'over' | 'under' | 'ok'

export type FloorBalanceRow = {
  floor: number
  /** Non-frozen beds on this floor. */
  capacity: number
  /** Total students placed on this floor. */
  placed: number
  byCourse: CourseCount
  targetByCourse: CourseCount
  statusByCourse: Record<number, CourseStatus>
  /** The single most out-of-balance course, or null when the floor is fine / too empty to judge. */
  worst: { course: Course; kind: 'over' | 'under'; delta: number } | null
}

export type FloorBalance = {
  courses: readonly number[]
  /** Every student the faculty needs to house, by course (placed + roomless). */
  totalToHouse: CourseCount
  totalCapacity: number
  floors: FloorBalanceRow[]
}

function emptyCounts(): CourseCount {
  return { 1: 0, 2: 0, 3: 0, 4: 0 }
}

function isNearEmpty(placed: number, capacity: number): boolean {
  return placed < Math.max(NEAR_EMPTY_ABS, capacity * NEAR_EMPTY_FRAC)
}

function classify(placed: number, target: number): CourseStatus {
  if (placed > target && placed - target >= MIN_DELTA && placed >= target * OVER_RATIO) return 'over'
  if (target - placed >= MIN_DELTA) return 'under'
  return 'ok'
}

export function computeFloorBalance(input: {
  floors: { floor: number; capacity: number }[]
  placed: { floor: number; course: number | null | undefined }[]
  totalToHouse: CourseCount
}): FloorBalance {
  const totalCapacity = input.floors.reduce((sum, f) => sum + Math.max(0, f.capacity), 0)

  const placedByFloor = new Map<number, CourseCount>()
  const placedTotalByFloor = new Map<number, number>()
  for (const p of input.placed) {
    const counts = placedByFloor.get(p.floor) ?? emptyCounts()
    placedTotalByFloor.set(p.floor, (placedTotalByFloor.get(p.floor) ?? 0) + 1)
    if (p.course != null && counts[p.course] !== undefined) counts[p.course] += 1
    placedByFloor.set(p.floor, counts)
  }

  const floors: FloorBalanceRow[] = [...input.floors]
    .sort((a, b) => a.floor - b.floor)
    .map(({ floor, capacity }) => {
      const byCourse = placedByFloor.get(floor) ?? emptyCounts()
      const placed = placedTotalByFloor.get(floor) ?? 0
      const targetByCourse = emptyCounts()
      const statusByCourse: Record<number, CourseStatus> = {}
      const nearEmpty = isNearEmpty(placed, capacity)

      for (const c of COURSES) {
        targetByCourse[c] = totalCapacity > 0
          ? Math.round((capacity / totalCapacity) * (input.totalToHouse[c] ?? 0))
          : 0
        statusByCourse[c] = nearEmpty ? 'ok' : classify(byCourse[c], targetByCourse[c])
      }

      let worst: FloorBalanceRow['worst'] = null
      for (const c of COURSES) {
        if (statusByCourse[c] === 'ok') continue
        const delta = byCourse[c] - targetByCourse[c]
        if (!worst || Math.abs(delta) > Math.abs(worst.delta)) {
          worst = { course: c, kind: statusByCourse[c] === 'over' ? 'over' : 'under', delta }
        }
      }

      return { floor, capacity, placed, byCourse, targetByCourse, statusByCourse, worst }
    })

  return { courses: COURSES, totalToHouse: input.totalToHouse, totalCapacity, floors }
}

/**
 * Would putting one more `course` student on `floor` push that course past
 * its target? If so, and the floor is short on another course, name it (the
 * biggest gap that still has a roomless student available — `availableByCourse`
 * is already gender-filtered by the caller).
 */
export function checkFloorPlacement(
  balance: FloorBalance,
  floor: number,
  course: number | null | undefined,
  opts: { availableByCourse?: CourseCount } = {},
): { wouldOverfill: boolean; suggestion: { course: Course; gap: number; available: number } | null } | null {
  const row = balance.floors.find((f) => f.floor === floor)
  if (!row || course == null || !COURSES.includes(course as Course)) return null

  const simPlaced = row.placed + 1
  if (isNearEmpty(simPlaced, row.capacity)) return { wouldOverfill: false, suggestion: null }

  const target = row.targetByCourse[course] ?? 0
  const simCount = (row.byCourse[course] ?? 0) + 1
  const wouldOverfill = classify(simCount, target) === 'over'
  if (!wouldOverfill) return { wouldOverfill: false, suggestion: null }

  const suggestion = COURSES
    .filter((c) => c !== course && row.statusByCourse[c] === 'under')
    .map((c) => ({
      course: c,
      gap: (row.targetByCourse[c] ?? 0) - (row.byCourse[c] ?? 0),
      available: opts.availableByCourse ? (opts.availableByCourse[c] ?? 0) : 1,
    }))
    .filter((s) => s.available > 0)
    .sort((a, b) => b.gap - a.gap)[0] ?? null

  return { wouldOverfill, suggestion }
}
