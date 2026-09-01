'use client'

import { apiRequest } from '@/lib/api-client'
import type { ApplicationListKind, CreateStudentApplication, StudentApplication } from '../types'

function request<T>(url: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>(url, init, "Murojaat so'rovini bajarib bo'lmadi")
}

export type SignatureInput = { typedName: string; attested: true }

export type ArizaReceipt = {
  verifyCode: string
  signedAt: string
  contentHash: string
  hashShort: string
  title?: string | null
  type?: string | null
  studentName?: string | null
}

export function fetchStudentApplications(kind: ApplicationListKind = 'documents', limit = 100) {
  return request<{ success: true; applications: StudentApplication[] }>(
    `/api/student/applications?kind=${kind}&limit=${limit}`,
  )
}

export function createStudentApplication(
  input: CreateStudentApplication & { signature?: SignatureInput },
) {
  return request<{ success: true; application: StudentApplication; receipt?: ArizaReceipt }>(
    '/api/student/applications',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}

export function submitStudentApplication(id: string | number, signature?: SignatureInput) {
  return request<{ success: true; application: StudentApplication; receipt?: ArizaReceipt }>(
    '/api/student/applications',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, signature }),
    },
  )
}

export function deleteStudentApplication(id: string | number) {
  return request<{ success: true }>(`/api/student/applications?id=${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
  })
}

export function fetchArizaReceipt(arizaId: string | number) {
  return request<{ success: true; receipt: ArizaReceipt }>(
    `/api/student/applications/receipt?id=${encodeURIComponent(String(arizaId))}`,
  )
}
