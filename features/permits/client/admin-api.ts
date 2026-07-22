'use client'

import { getAuthHeaders } from '@/lib/auth-session'
import type { ZamdekanOverview } from '../types'

async function request<T>(init?: RequestInit): Promise<T> {
  const response = await fetch('/api/zamdekan/overview', {
    ...init,
    headers: { ...await getAuthHeaders(), ...init?.headers },
    cache: 'no-store',
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Yo\'llanma ma\'lumotlarini yuklab bo\'lmadi')
  return body as T
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
