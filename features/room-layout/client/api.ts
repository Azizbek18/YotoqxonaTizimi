'use client'

import { apiRequest as requestJson } from '@/lib/api-client'
import type { FloorRoomPlan, RoomFloorStatus, RoomLayoutBlock, RoomNumbering } from '../types'

export async function fetchRoomFloors() {
  const result = await requestJson<{ rooms: RoomFloorStatus[] }>('/api/room-floors')
  return result.rooms
}

export function setRoomFrozen(roomNumber: string, frozen: boolean, reason?: string | null) {
  return requestJson<{ success: true; roomNumber: string; frozen: boolean }>('/api/room-floors/freeze', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomNumber, frozen, reason: reason ?? null }),
  })
}

/** Per-room bed-count override; `capacity: null` clears it (back to the dorm default). */
export function setRoomCapacity(roomNumber: string, capacity: number | null) {
  return requestJson<{ success: true; roomNumber: string; capacity: number | null }>('/api/room-floors/capacity', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomNumber, capacity }),
  })
}

export function bulkSetRoomCapacity(roomNumbers: string[], capacity: number | null) {
  return requestJson<{ success: true; changed: number; capacity: number | null }>('/api/room-floors/capacity', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomNumbers, capacity }),
  })
}

export function generateRoomFloors(floors: FloorRoomPlan[], numbering: RoomNumbering) {
  return requestJson<{ success: true; created: number }>('/api/room-floors/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ floors, numbering }),
  })
}

export async function fetchFloorLayout(floorNumber: number) {
  const result = await requestJson<{ blocks: RoomLayoutBlock[] }>(`/api/dekan/room-layout?floor=${floorNumber}`)
  return result.blocks
}

export function saveFloorLayout(floorNumber: number, blocks: RoomLayoutBlock[]) {
  return requestJson<{ success: true }>('/api/dekan/room-layout', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ floorNumber, blocks }),
  })
}
