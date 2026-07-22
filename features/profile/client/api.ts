'use client'

import { getAuthHeaders } from '@/lib/auth-session'
import type { StudentProfilePayload, StudentProfileUpdate } from '../types'

async function profileRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const response = await fetch(url, {
    ...init,
    headers: { ...authHeaders, ...init?.headers },
    cache: 'no-store',
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Profil so‘rovini bajarib bo‘lmadi')
  return body as T
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
