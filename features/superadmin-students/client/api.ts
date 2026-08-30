'use client'

import { apiRequest } from '@/lib/api-client'
import type { StudentActionResult, SuperadminStudentsPage } from '../types'

export function fetchSuperadminStudents(params: {
  limit?: number
  offset?: number
  search?: string
  faculty?: string
  status?: string
  blacklisted?: boolean
  placement?: string
  unknownFaculty?: boolean
}): Promise<SuperadminStudentsPage> {
  const s = new URLSearchParams()
  if (params.limit) s.set('limit', String(params.limit))
  if (params.offset) s.set('offset', String(params.offset))
  if (params.search) s.set('search', params.search)
  if (params.faculty) s.set('faculty', params.faculty)
  if (params.status) s.set('status', params.status)
  if (typeof params.blacklisted === 'boolean') s.set('blacklisted', String(params.blacklisted))
  if (params.placement) s.set('placement', params.placement)
  if (params.unknownFaculty) s.set('unknownFaculty', 'true')
  return apiRequest<SuperadminStudentsPage>(`/api/admin/students?${s.toString()}`, undefined, "Talabalarni yuklab bo'lmadi")
}

type StudentAction =
  | { id: string; action: 'move'; faculty: string }
  | { id: string; action: 'blacklist'; reason: string }
  | { id: string; action: 'unblacklist' }
  | { id: string; action: 'expel'; reason: string; alsoBlacklist: boolean }

export function runStudentAction(body: StudentAction): Promise<StudentActionResult> {
  return apiRequest<StudentActionResult>('/api/admin/students', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, "Amalni bajarib bo'lmadi")
}
