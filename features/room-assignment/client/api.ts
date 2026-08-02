'use client'

import { apiRequest as requestJson } from '@/lib/api-client'
import type { FacultyStudentRow } from '../types'

export async function fetchAssignableStudents() {
  const result = await requestJson<{ students: FacultyStudentRow[] }>('/api/dekan/students')
  return result.students
}

export function assignStudentRoom(input: { studentId: string; roomNumber: string | null }) {
  return requestJson<{ success: true }>('/api/dekan/students', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
