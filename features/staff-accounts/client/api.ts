'use client'

import { apiRequest as requestJson } from '@/lib/api-client'
import type { StaffAccountRow } from '../types'

export async function fetchStaffAccounts() {
  const result = await requestJson<{ staff: StaffAccountRow[] }>('/api/admin/staff-accounts')
  return result.staff
}
