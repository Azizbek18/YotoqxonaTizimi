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
