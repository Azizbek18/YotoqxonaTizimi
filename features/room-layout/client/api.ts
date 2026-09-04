'use client'

import { apiRequest as requestJson } from '@/lib/api-client'
import type { FloorRoomPlan, RoomFloorStatus, RoomLayoutBlock, RoomNumbering } from '../types'

// `dormId` targets one specific one of the faculty's buildings
// (many-to-many, 202609300000); omitted resolves to primary everywhere
// below, exactly as before this parameter existed.
export async function fetchRoomFloors(dormId?: string) {
  const qs = dormId ? `?dormId=${encodeURIComponent(dormId)}` : ''
  const result = await requestJson<{ rooms: RoomFloorStatus[] }>(`/api/room-floors${qs}`)
  return result.rooms
}

export function setRoomFrozen(roomNumber: string, frozen: boolean, reason?: string | null, dormId?: string) {
  return requestJson<{ success: true; roomNumber: string; frozen: boolean }>('/api/room-floors/freeze', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomNumber, frozen, reason: reason ?? null, dormId }),
  })
}

/** Per-room bed-count override; `capacity: null` clears it (back to the dorm default). */
export function setRoomCapacity(roomNumber: string, capacity: number | null, dormId?: string) {
  return requestJson<{ success: true; roomNumber: string; capacity: number | null }>('/api/room-floors/capacity', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomNumber, capacity, dormId }),
  })
}

export function bulkSetRoomCapacity(roomNumbers: string[], capacity: number | null, dormId?: string) {
  return requestJson<{ success: true; changed: number; capacity: number | null }>('/api/room-floors/capacity', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomNumbers, capacity, dormId }),
  })
}

type RoomGender = 'male' | 'female' | null

/** Declared room gender; `gender: null` clears the reservation (any gender). */
export function setRoomGender(roomNumber: string, gender: RoomGender, dormId?: string) {
  return requestJson<{ success: true; roomNumber: string; gender: RoomGender }>('/api/room-floors/gender', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomNumber, gender, dormId }),
  })
}

export function bulkSetRoomGender(roomNumbers: string[], gender: RoomGender, dormId?: string) {
  return requestJson<{ success: true; changed: number; gender: RoomGender }>('/api/room-floors/gender', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomNumbers, gender, dormId }),
  })
}

export function generateRoomFloors(floors: FloorRoomPlan[], numbering: RoomNumbering, dormId?: string) {
  return requestJson<{ success: true; created: number; removed: number; renumbered: number }>('/api/room-floors/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ floors, numbering, dormId }),
  })
}

export async function fetchFloorLayout(floorNumber: number, dormId?: string) {
  const qs = dormId ? `&dormId=${encodeURIComponent(dormId)}` : ''
  const result = await requestJson<{ blocks: RoomLayoutBlock[] }>(`/api/dekan/room-layout?floor=${floorNumber}${qs}`)
  return result.blocks
}

export function saveFloorLayout(floorNumber: number, blocks: RoomLayoutBlock[], dormId?: string) {
  return requestJson<{ success: true }>('/api/dekan/room-layout', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ floorNumber, blocks, dormId }),
  })
}
