'use client'

import { getAuthHeaders } from '@/lib/auth-session'
import type { ApplicationListKind, CreateStudentApplication, StudentApplication } from '../types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const response = await fetch(url, {
    ...init,
    headers: { ...authHeaders, ...init?.headers },
    cache: 'no-store',
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Murojaat so\'rovini bajarib bo\'lmadi')
  return body as T
}

export function fetchStudentApplications(kind: ApplicationListKind = 'documents', limit = 100) {
  return request<{ success: true; applications: StudentApplication[] }>(
    `/api/student/applications?kind=${kind}&limit=${limit}`,
  )
}

export function createStudentApplication(input: CreateStudentApplication) {
  return request<{ success: true; application: StudentApplication }>('/api/student/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function submitStudentApplication(id: string | number) {
  return request<{ success: true; application: StudentApplication }>('/api/student/applications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
}

export function deleteStudentApplication(id: string | number) {
  return request<{ success: true }>(`/api/student/applications?id=${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  })
}
