'use client'

import { apiRequest } from '@/lib/api-client'
import type { CreatedStaffInvite, StaffInviteRole, StaffInviteRow } from '../types'

export async function fetchStaffInvites(): Promise<StaffInviteRow[]> {
  const result = await apiRequest<{ invites: StaffInviteRow[] }>('/api/dekan/staff-invites', undefined, "Taklif kodlarini yuklab bo'lmadi")
  return result.invites
}

export function createStaffInvite(input: {
  role: StaffInviteRole
  email: string
  label?: string
  expiryDays?: number
}): Promise<CreatedStaffInvite> {
  return apiRequest<CreatedStaffInvite>('/api/dekan/staff-invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }, "Taklif kodini yaratib bo'lmadi")
}

export function revokeStaffInvite(id: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/api/dekan/staff-invites?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }, "Taklif kodini bekor qilib bo'lmadi")
}
