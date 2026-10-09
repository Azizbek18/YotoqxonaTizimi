'use client'

import { apiRequest } from '@/lib/api-client'
import { ClientCache } from '@/lib/client-cache'
import type { StudentProfilePayload, StudentProfileUpdate } from '../types'

// The student layout AND the page inside it read the profile on mount; share one
// request for a short window. Every write below clears it, so the next read is fresh.
const profileCache = new ClientCache<StudentProfilePayload>(30_000)

function profileRequest<T>(url: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>(url, init, 'Profil so‘rovini bajarib bo‘lmadi')
}

export function fetchStudentProfile() {
  return profileCache.get('me', () => profileRequest<StudentProfilePayload>('/api/student/profile'))
}

export function updateStudentProfile(input: StudentProfileUpdate) {
  return profileCache.invalidateAround(
    profileRequest<{ success: true; data: Partial<StudentProfilePayload['profile']>; message: string }>(
      '/api/student/profile/update',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    ),
  )
}

export function uploadStudentAvatar(file: File) {
  const form = new FormData()
  form.append('file', file)
  return profileCache.invalidateAround(
    profileRequest<{ success: true; avatar_url: string; message: string }>(
      '/api/student/profile/upload-avatar',
      { method: 'POST', body: form },
    ),
  )
}

export function deleteStudentAvatar() {
  return profileCache.invalidateAround(
    profileRequest<{ success: true; message: string }>(
      '/api/student/profile/upload-avatar',
      { method: 'DELETE' },
    ),
  )
}
