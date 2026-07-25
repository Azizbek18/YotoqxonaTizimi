'use client'

import { apiRequest } from '@/lib/api-client'
import type { AdminDashboardPayload } from '../types'

export function fetchAdminDashboard(): Promise<AdminDashboardPayload> {
  return apiRequest<AdminDashboardPayload>('/api/admin/dashboard', undefined, "Dashboard ma'lumotlarini yuklab bo'lmadi")
}
