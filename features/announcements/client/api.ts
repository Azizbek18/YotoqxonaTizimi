'use client'

import { getAuthHeaders } from '@/lib/auth-session'
import type { StudentAnnouncementsPayload } from '../types'

export async function fetchStudentAnnouncements(): Promise<StudentAnnouncementsPayload> {
  const response = await fetch('/api/elonlar', {
    headers: await getAuthHeaders(),
    cache: 'no-store',
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || "E'lonlarni yuklab bo'lmadi")
  return body as StudentAnnouncementsPayload
}
