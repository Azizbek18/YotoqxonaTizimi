'use client'

import { getAuthHeaders } from '@/lib/auth-session'
import type { StaffAccountRow, CreateStaffAccountInput } from '../types'

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const response = await fetch(url, {
    ...init,
    headers: { ...authHeaders, ...init?.headers },
    cache: 'no-store',
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || "So'rovni bajarib bo'lmadi")
  return body as T
}

export async function fetchStaffAccounts() {
  const result = await requestJson<{ staff: StaffAccountRow[] }>('/api/zamdekan/staff')
  return result.staff
}

export function createStaffAccount(input: CreateStaffAccountInput) {
  return requestJson<{ success: true }>('/api/zamdekan/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
