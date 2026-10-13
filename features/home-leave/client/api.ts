'use client'

import { apiRequest } from '@/lib/api-client'
import { ClientCache } from '@/lib/client-cache'
import { clearAttendanceSummary } from '@/features/attendance/client/summary'
import type { HomeLeave, HomeLeaveInput, HomeLeaveStaffRow, LeaveCallResult } from '../types'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

// Sarlavhadagi "Uyda" belgisi har sahifada so'raladi — qisqa muddat bitta so'rov.
const mineCache = new ClientCache<HomeLeave[]>(30_000)

export function fetchMyLeaves(): Promise<HomeLeave[]> {
  return mineCache.get('mine', async () => {
    const result = await apiRequest<{ leaves: HomeLeave[] }>('/api/student/home-leave')
    return result.leaves
  })
}

export function clearMyLeaves() {
  mineCache.clear()
  clearAttendanceSummary()
}

export async function createLeave(input: HomeLeaveInput): Promise<{ leave: HomeLeave; needsReview: boolean }> {
  const result = await apiRequest<{ leave: HomeLeave; needsReview: boolean }>('/api/student/home-leave', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
  clearMyLeaves()
  return result
}

export async function finishLeave(id: string, action: 'cancel' | 'return'): Promise<HomeLeave> {
  const result = await apiRequest<{ leave: HomeLeave }>(`/api/student/home-leave/${id}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({ action }),
  })
  clearMyLeaves()
  return result.leave
}

export async function shareLeaveLocation(id: string, lat: number, lng: number): Promise<HomeLeave> {
  const result = await apiRequest<{ leave: HomeLeave }>(`/api/student/home-leave/${id}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({ action: 'location', lat, lng }),
  })
  clearMyLeaves()
  return result.leave
}

export async function fetchStaffLeaves(): Promise<{ leaves: HomeLeaveStaffRow[]; canWrite: boolean }> {
  return apiRequest<{ leaves: HomeLeaveStaffRow[]; canWrite: boolean }>('/api/attendance/leaves')
}

export async function recordLeaveCall(id: string, result: Exclude<LeaveCallResult, 'none'>): Promise<HomeLeave> {
  const data = await apiRequest<{ leave: HomeLeave }>('/api/attendance/leaves', {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({ id, result }),
  })
  return data.leave
}

export async function fetchFacultyLeaves(): Promise<{ leaves: HomeLeaveStaffRow[]; overdue: HomeLeaveStaffRow[] }> {
  return apiRequest<{ leaves: HomeLeaveStaffRow[]; overdue: HomeLeaveStaffRow[] }>('/api/dekan/home-leaves')
}

export async function decideLeave(id: string, input: { action: 'approve' | 'reject'; note?: string }): Promise<HomeLeave> {
  const result = await apiRequest<{ leave: HomeLeave }>(`/api/dekan/home-leaves?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
  return result.leave
}
