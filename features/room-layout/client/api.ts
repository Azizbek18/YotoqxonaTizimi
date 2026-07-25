'use client'

import { getAuthHeaders } from '@/lib/auth-session'
import type { RoomLayoutBlock } from '../types'

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const response = await fetch(url, {
    ...init,
    headers: { ...authHeaders, ...init?.headers },
    cache: 'no-store',
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || "So'rovni bajarib bo'lmadi")
  return body as T
}

export async function fetchFloorLayout(floorNumber: number) {
  const result = await requestJson<{ blocks: RoomLayoutBlock[] }>(`/api/admin/room-layout?floor=${floorNumber}`)
  return result.blocks
}

export function saveFloorLayout(floorNumber: number, blocks: RoomLayoutBlock[]) {
  return requestJson<{ success: true }>('/api/admin/room-layout', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ floorNumber, blocks }),
  })
}
