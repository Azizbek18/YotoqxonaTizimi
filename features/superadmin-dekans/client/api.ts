'use client'

import { apiRequest } from '@/lib/api-client'
import type { SuperadminDekansPayload } from '../types'

export function fetchSuperadminDekans() {
  return apiRequest<SuperadminDekansPayload>(
    '/api/admin/dekans',
    undefined,
    "Dekanlar nazorat ma'lumotlarini yuklab bo'lmadi",
  )
}

type DekanLifecycleBody =
  | { id: string; action: 'activate' | 'deactivate' }
  | { id: string; action: 'reassign'; faculty: string }

export function updateDekanAccount(body: DekanLifecycleBody) {
  return apiRequest<{ ok: true }>(
    '/api/admin/dekans',
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    "Dekan hisobini yangilab bo'lmadi",
  )
}
