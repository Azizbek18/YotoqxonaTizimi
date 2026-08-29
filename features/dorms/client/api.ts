'use client'

import { apiRequest } from '@/lib/api-client'
import type { DekanDorm, DormPreview } from '../types'

export function fetchDekanDorm() {
  return apiRequest<{ dorm: DekanDorm | null }>('/api/dekan/dorm')
}

export function previewDorm(number: string) {
  return apiRequest<{ preview: DormPreview }>(`/api/dekan/dorm?number=${encodeURIComponent(number.trim())}`)
}

export function setUpDorm(input: {
  number: string
  floorCount?: number
  roomCapacity?: number
  floors: number[]
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

export function resolveFloorClaim(floor: number, accept: boolean) {
  return apiRequest<{ outcome: string; faculty?: string; dorm: DekanDorm | null }>('/api/dekan/dorm', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'resolve', floor, accept }),
  })
}

export function withdrawFloorClaims(floors: number[]) {
  return apiRequest<{ dorm: DekanDorm | null }>('/api/dekan/dorm', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'withdraw', floors }),
  })
}
