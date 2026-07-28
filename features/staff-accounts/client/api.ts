'use client'

import { apiRequest as requestJson } from '@/lib/api-client'
import type { StaffAccountRow, CreateStaffAccountInput } from '../types'

export async function fetchStaffAccounts() {
  const result = await requestJson<{ staff: StaffAccountRow[] }>('/api/admin/staff-accounts')
  return result.staff
}

export function createStaffAccount(input: CreateStaffAccountInput) {
  return requestJson<{ success: true }>('/api/admin/staff-accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
