'use client'

import { apiRequest } from '@/lib/api-client'
import type { DekanOverview } from '../types'

function request<T>(init?: RequestInit): Promise<T> {
  return apiRequest<T>('/api/dekan/overview', init, "Yo'llanma ma'lumotlarini yuklab bo'lmadi")
}

export function fetchDekanOverview() {
  return request<DekanOverview>()
}

export function approvePermitRequest(id: string) {
  return request({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'approve' }) })
}

export function rejectPermitRequest(id: string, reason: string) {
  return request({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'reject', reason }) })
}
