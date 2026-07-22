'use client'

import { getAuthHeaders } from '@/lib/auth-session'
import type { FacultyStudentRow } from '../types'

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const response = await fetch(url, {
    ...init,
    headers: { ...authHeaders, ...init?.headers },
    cache: 'no-store',
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || "So'rovni bajarib bo'lmadi")
  return body as T
}

export async function fetchAssignableStudents() {
  const result = await requestJson<{ students: FacultyStudentRow[] }>('/api/zamdekan/students')
  return result.students
}

export function assignStudentRoom(input: { studentId: string; roomNumber: string | null }) {
  return requestJson<{ success: true }>('/api/zamdekan/students', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
