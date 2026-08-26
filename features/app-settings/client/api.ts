'use client'

import { apiRequest } from '@/lib/api-client'
import type { AppSettings } from '../types'

export function fetchAppSettings() {
  return apiRequest<AppSettings>('/api/settings')
}

export function updateAppSettings(input: Partial<AppSettings>) {
  return apiRequest<AppSettings>('/api/dekan/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
