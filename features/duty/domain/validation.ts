import { ApiError } from '../../../server/http/api-error'
import type { CleaningSchedule } from '../types'

const weekdays = new Set(['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'])

export function normalizeCleaningSchedule(value: unknown): CleaningSchedule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'Navbatchilik jadvali noto\'g\'ri')
  }
  const result: CleaningSchedule = {}
  for (const [day, assignee] of Object.entries(value)) {
    if (!weekdays.has(day)) continue
    if (assignee === null) {
      result[day] = null
      continue
    }
    if (!assignee || typeof assignee !== 'object' || Array.isArray(assignee)) {
      throw new ApiError(400, 'Navbatchi ma\'lumoti noto\'g\'ri')
    }
    const id = typeof assignee.id === 'string' ? assignee.id.trim().slice(0, 80) : ''
    const name = typeof assignee.name === 'string' ? assignee.name.trim().slice(0, 160) : ''
    if (!id || !name) throw new ApiError(400, 'Navbatchi ma\'lumoti to\'liq emas')
    result[day] = { id, name }
  }
  return result
}
