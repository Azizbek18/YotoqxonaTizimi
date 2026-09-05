export type RoomOccupancyTone = 'empty' | 'partial' | 'full' | 'unknown'

export function getRoomOccupancyTone(
  occupied: number,
  capacity: number | null,
): RoomOccupancyTone {
  if (occupied <= 0) return 'empty'
  if (capacity === null) return 'unknown'
  return occupied >= capacity ? 'full' : 'partial'
}

export function getFreePlaces(
  capacity: number | null,
  occupied: number,
): number | null {
  if (capacity === null) return null
  return Math.max(0, capacity - occupied)
}

export function getPaymentStats(
  totalContractFee: number | null,
  paidAmount: number,
) {
  if (totalContractFee === null) return null

  return {
    totalContractFee,
    remainingAmount: Math.max(0, totalContractFee - paidAmount),
    progressPercent: Math.min(100, Math.round((paidAmount / totalContractFee) * 100)),
  }
}

export function getTashkentYear(date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
  }).format(date))
}

function getTashkentMonth(date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tashkent',
    month: 'numeric',
  }).format(date))
}

// The dorm billing year is Sentabr(9) -> Iyun(6), not the calendar year — so
// "this academic year" during, say, Mart 2027 is the one that started
// Sentabr 2026, not 2027. Returns the START year of the CURRENT academic
// year, and the one before/after it, for a 3-tab selector.
export function getPaymentYears(date = new Date()): [number, number, number] {
  const calendarYear = getTashkentYear(date)
  const month = getTashkentMonth(date)
  const academicYearStart = month >= 9 ? calendarYear : calendarYear - 1
  return [academicYearStart - 1, academicYearStart, academicYearStart + 1]
}
