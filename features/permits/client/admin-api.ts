'use client'

import { apiRequest } from '@/lib/api-client'
import type { ZamdekanOverview } from '../types'

function request<T>(init?: RequestInit): Promise<T> {
  return apiRequest<T>('/api/zamdekan/overview', init, "Yo'llanma ma'lumotlarini yuklab bo'lmadi")
}

export function fetchZamdekanOverview() {
  return request<ZamdekanOverview>()
}

export function approvePermitRequest(id: string, roomNumber: string) {
  return request({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'approve', roomNumber }) })
}

export function rejectPermitRequest(id: string, reason: string) {
  return request({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'reject', reason }) })
}
