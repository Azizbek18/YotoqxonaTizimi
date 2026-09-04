'use client'

import { apiRequest as requestJson } from '@/lib/api-client'
import type { FacultyStudentRow } from '../types'

export async function fetchAssignableStudents() {
  const result = await requestJson<{ students: FacultyStudentRow[] }>('/api/dekan/students')
  return result.students
}

export type AssignRoomResult = {
  success: true
  /** Set for a permit-backed placement: the outcome of generating + sending
   *  the signed Ariza + Tilxat. 'deferred_no_dekan_signature' means the
   *  dekan still needs to save their e-signature in Sozlamalar. */
  documentDelivery?:
    | 'delivered'
    | 'deferred_no_dekan_signature'
    | 'deferred_no_channel'
    | 'skipped_not_ready'
    | 'skipped_already'
    | 'skipped_no_document'
    | 'error'
}

export function assignStudentRoom(input: {
  studentId: string
  roomNumber: string | null
  source?: 'user' | 'permit'
  /** Which of the faculty's buildings the room belongs to (many-to-many,
   *  202609300000); omitted keeps the RPC's own prior resolution. */
  dormId?: string
}) {
  return requestJson<AssignRoomResult>('/api/dekan/students', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
