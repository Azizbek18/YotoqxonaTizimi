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

export function getPaymentYears(date = new Date()): [number, number, number] {
  const currentYear = getTashkentYear(date)
  return [currentYear - 1, currentYear, currentYear + 1]
}
