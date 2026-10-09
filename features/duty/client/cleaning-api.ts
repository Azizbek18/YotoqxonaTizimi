'use client'

import { apiRequest } from '@/lib/api-client'
import { ClientCache } from '@/lib/client-cache'
import type { CleaningSchedule } from '../types'

function request<T>(init?: RequestInit): Promise<T> {
  return apiRequest<T>('/api/student/cleaning-schedule', init, "Navbatchilik jadvali so'rovini bajarib bo'lmadi")
}

// Read on every dashboard visit; it only changes when the room saves it, and
// saving clears the cache so the writer (and the next read) sees it at once.
const scheduleCache = new ClientCache<{ success: true; schedule: CleaningSchedule | null }>(60_000)

export function fetchCleaningSchedule() {
  return scheduleCache.get('mine', () => request<{ success: true; schedule: CleaningSchedule | null }>())
}

export function saveCleaningSchedule(schedule: CleaningSchedule) {
  return scheduleCache.invalidateAround(
    request<{ success: true; schedule: CleaningSchedule }>({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule }),
    }),
  )
}
