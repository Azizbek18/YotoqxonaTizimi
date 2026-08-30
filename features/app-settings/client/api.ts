'use client'

import { apiRequest } from '@/lib/api-client'
import type { AppSettings, FacultyFee } from '../types'

export function fetchAppSettings() {
  return apiRequest<AppSettings>('/api/settings')
}

export function updateAppSettings(input: Partial<AppSettings>) {
  return apiRequest<AppSettings>('/api/dekan/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

// ---- superadmin: cross-faculty fee table ----

export async function fetchFacultyFees(): Promise<FacultyFee[]> {
  const result = await apiRequest<{ fees: FacultyFee[] }>('/api/admin/faculty-fees', undefined, "To'lovlarni yuklab bo'lmadi")
  return result.fees
}

export function updateFacultyFee(input: { faculty: string; monthlyFee: number; yearlyContractFee: number }) {
  return apiRequest<FacultyFee>('/api/admin/faculty-fees', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }, "To'lovni saqlab bo'lmadi")
}
