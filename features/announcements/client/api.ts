'use client'

import { apiRequest } from '@/lib/api-client'
import type { AnnouncementInput, AuthoredAnnouncement, StudentAnnouncementsPayload } from '../types'

export function fetchStudentAnnouncements(): Promise<StudentAnnouncementsPayload> {
  return apiRequest<StudentAnnouncementsPayload>('/api/elonlar', undefined, "E'lonlarni yuklab bo'lmadi")
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export async function fetchDekanAnnouncements() {
  const result = await apiRequest<{ elonlar: AuthoredAnnouncement[] }>('/api/dekan/elonlar')
  return result.elonlar
}

export async function createDekanAnnouncement(input: AnnouncementInput) {
  const result = await apiRequest<{ elon: AuthoredAnnouncement }>('/api/dekan/elonlar', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
  return result.elon
}

export async function updateDekanAnnouncement(input: Partial<AnnouncementInput> & { id: string }) {
  const result = await apiRequest<{ elon: AuthoredAnnouncement }>('/api/dekan/elonlar', {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
  return result.elon
}

export function deleteDekanAnnouncement(id: string) {
  return apiRequest<{ ok: true }>(`/api/dekan/elonlar?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}
