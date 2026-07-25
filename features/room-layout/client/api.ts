'use client'

import { apiRequest as requestJson } from '@/lib/api-client'
import type { RoomLayoutBlock } from '../types'

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
