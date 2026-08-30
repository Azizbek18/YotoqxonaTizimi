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

// ---- superadmin: tizim-wide announcements ----

export async function fetchSystemAnnouncements() {
  const result = await apiRequest<{ elonlar: AuthoredAnnouncement[] }>('/api/admin/announcements', undefined, "E'lonlarni yuklab bo'lmadi")
  return result.elonlar
}

export async function createSystemAnnouncement(input: AnnouncementInput) {
  const result = await apiRequest<{ elon: AuthoredAnnouncement }>('/api/admin/announcements', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  }, "E'lonni yaratib bo'lmadi")
  return result.elon
}

export async function updateSystemAnnouncement(input: Partial<AnnouncementInput> & { id: string }) {
  const result = await apiRequest<{ elon: AuthoredAnnouncement }>('/api/admin/announcements', {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  }, "E'lonni yangilab bo'lmadi")
  return result.elon
}

export function deleteSystemAnnouncement(id: string) {
  return apiRequest<{ ok: true }>(`/api/admin/announcements?id=${encodeURIComponent(id)}`, { method: 'DELETE' }, "E'lonni o'chirib bo'lmadi")
}
