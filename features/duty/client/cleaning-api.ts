'use client'

import { apiRequest } from '@/lib/api-client'
import type { CleaningSchedule } from '../types'

function request<T>(init?: RequestInit): Promise<T> {
  return apiRequest<T>('/api/student/cleaning-schedule', init, "Navbatchilik jadvali so'rovini bajarib bo'lmadi")
}

export function fetchCleaningSchedule() {
  return request<{ success: true; schedule: CleaningSchedule | null }>()
}

export function saveCleaningSchedule(schedule: CleaningSchedule) {
  return request<{ success: true; schedule: CleaningSchedule }>({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schedule }),
  })
}
