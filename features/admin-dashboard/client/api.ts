'use client'

import { getAuthHeaders } from '@/lib/auth-session'
import type { AdminDashboardPayload } from '../types'

export async function fetchAdminDashboard(): Promise<AdminDashboardPayload> {
  const response = await fetch('/api/admin/dashboard', {
    headers: await getAuthHeaders(),
    cache: 'no-store',
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Dashboard ma\'lumotlarini yuklab bo\'lmadi')
  return body as AdminDashboardPayload
}
