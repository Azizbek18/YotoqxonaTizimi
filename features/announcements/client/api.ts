'use client'

import { apiRequest } from '@/lib/api-client'
import type { StudentAnnouncementsPayload } from '../types'

export function fetchStudentAnnouncements(): Promise<StudentAnnouncementsPayload> {
  return apiRequest<StudentAnnouncementsPayload>('/api/elonlar', undefined, "E'lonlarni yuklab bo'lmadi")
}
