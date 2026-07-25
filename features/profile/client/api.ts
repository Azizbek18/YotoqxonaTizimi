'use client'

import { apiRequest } from '@/lib/api-client'
import type { StudentProfilePayload, StudentProfileUpdate } from '../types'

function profileRequest<T>(url: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>(url, init, 'Profil so‘rovini bajarib bo‘lmadi')
}

export function fetchStudentProfile() {
  return profileRequest<StudentProfilePayload>('/api/student/profile')
}

export function updateStudentProfile(input: StudentProfileUpdate) {
  return profileRequest<{ success: true; data: Partial<StudentProfilePayload['profile']>; message: string }>(
    '/api/student/profile/update',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}

export function uploadStudentAvatar(file: File) {
  const form = new FormData()
  form.append('file', file)
  return profileRequest<{ success: true; avatar_url: string; message: string }>(
    '/api/student/profile/upload-avatar',
    { method: 'POST', body: form },
  )
}

export function deleteStudentAvatar() {
  return profileRequest<{ success: true; message: string }>(
    '/api/student/profile/upload-avatar',
    { method: 'DELETE' },
  )
}
