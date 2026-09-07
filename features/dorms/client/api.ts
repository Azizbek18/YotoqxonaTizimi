'use client'

import { apiRequest } from '@/lib/api-client'
import type { BlockedDormGrid, BlockedRoomMapDorm, DekanDorm, DormPreview, SuperadminDorm } from '../types'

// `dorm` = primary (or null) for back-compat; `dorms` = every building the
// faculty holds, primary first (many-to-many, 202609300000) — a single-dorm
// faculty gets a 1-item array.
export function fetchDekanDorm() {
  return apiRequest<{ dorm: DekanDorm | null; dorms: DekanDorm[] }>('/api/dekan/dorm')
}

export function previewDorm(number: string) {
  return apiRequest<{ preview: DormPreview }>(`/api/dekan/dorm?number=${encodeURIComponent(number.trim())}`)
}

export function setUpDorm(input: {
  number: string
  floorCount?: number
  roomCapacity?: number
  floors: number[]
  /** Claim this building ALONGSIDE the faculty's existing one(s) instead of
   *  moving to it. See DormSetupInput. */
  additional?: boolean
}) {
  return apiRequest<{ confirmed: number[]; proposed: number[]; dorm: DekanDorm | null }>(
    '/api/dekan/dorm',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}

export function resolveFloorClaim(floor: number, accept: boolean, dormId?: string) {
  return apiRequest<{ outcome: string; faculty?: string; dorm: DekanDorm | null }>('/api/dekan/dorm', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'resolve', floor, accept, dormId }),
  })
}

export function withdrawFloorClaims(floors: number[], dormId?: string) {
  return apiRequest<{ dorm: DekanDorm | null }>('/api/dekan/dorm', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'withdraw', floors, dormId }),
  })
}

export function saveDormAttendanceSettings(
  settings: {
    latitude?: number | null
    longitude?: number | null
    checkinRadiusM?: number
    attendanceEnabled?: boolean
    attendanceOpenTime?: string
    attendanceCloseTime?: string
  },
  dormId?: string,
) {
  return apiRequest<{ dorm: DekanDorm | null }>('/api/dekan/dorm', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'attendance-settings', settings, dormId }),
  })
}

export type GeocodeResult = { name: string; lat: number; lng: number }

/** Free-text place search for the yo'qlama location picker (OSM Nominatim,
 *  proxied server-side — see app/api/dekan/geocode). */
export function geocodePlace(query: string) {
  return apiRequest<{ results: GeocodeResult[] }>(
    `/api/dekan/geocode?q=${encodeURIComponent(query.trim())}`,
  )
}

/** Make one of the faculty's already-linked buildings the primary. */
export function setPrimaryDorm(dormId: string) {
  return apiRequest<{ dorms: DekanDorm[] }>('/api/dekan/dorm', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set-primary', dormId }),
  })
}

/** Drop a faculty↔building link — only once it's empty and not primary. */
export function unlinkDorm(dormId: string) {
  return apiRequest<{ dorms: DekanDorm[] }>('/api/dekan/dorm', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'unlink', dormId }),
  })
}

// ---- superadmin (admin role only) ----
export function fetchAllDorms() {
  return apiRequest<{ dorms: SuperadminDorm[] }>('/api/admin/dorms')
}

export function createDorm(input: {
  number: string
  name?: string
  floorCount: number
  roomCapacity?: number
  /** 'blocked' → an A/B-wing building (6-yotoqxona); needs blockCount >= 2. */
  layoutKind?: 'simple' | 'blocked'
  blockCount?: number
}) {
  return apiRequest<{ ok: true }>('/api/admin/dorms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

// ---- blocked-layout dorm sections (6-yotoqxona), superadmin ----

export function fetchDormSectionGrid(dormId: string) {
  return apiRequest<{ grid: BlockedDormGrid }>(`/api/admin/dorms/sections?dormId=${encodeURIComponent(dormId)}`)
}

export function buildDormLayout(dormId: string) {
  return apiRequest<{ ok: true; created: number }>('/api/admin/dorms/sections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'buildLayout', dormId }),
  })
}

export function assignDormSection(dormId: string, block: string, floor: number, faculty: string) {
  return apiRequest<{ ok: true; block: string; floor: number; faculty: string }>('/api/admin/dorms/sections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'assignSection', dormId, block, floor, faculty }),
  })
}

export function clearDormSection(dormId: string, block: string, floor: number) {
  return apiRequest<{ ok: true; cleared: boolean }>('/api/admin/dorms/sections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'clearSection', dormId, block, floor }),
  })
}

/** Dekan: the blocked-dorm (7-yotoqxona) rooms this faculty's sections cover. */
export function fetchBlockedRoomMap() {
  return apiRequest<{ dorms: BlockedRoomMapDorm[] }>('/api/dekan/blok-xonalar')
}

export function saveDormSettings(dormId: string, settings: Partial<SuperadminDorm>) {
  return apiRequest<{ ok: true }>('/api/admin/dorms', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dormId, settings }),
  })
}

export function reassignDormFloor(dormId: string, floor: number, faculty: string | null) {
  return apiRequest<{ ok: true }>('/api/admin/dorms', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dormId, action: 'reassignFloor', floor, faculty }),
  })
}
