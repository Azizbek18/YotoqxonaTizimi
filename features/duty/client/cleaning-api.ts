'use client'

import { getAuthHeaders } from '@/lib/auth-session'
import type { CleaningSchedule } from '../types'

async function request<T>(init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const response = await fetch('/api/student/cleaning-schedule', {
    ...init,
    headers: { ...authHeaders, ...init?.headers },
    cache: 'no-store',
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Navbatchilik jadvali so\'rovini bajarib bo\'lmadi')
  return body as T
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
