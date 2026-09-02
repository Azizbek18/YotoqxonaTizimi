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

export type ArizaContext = {
  fullName: string
  facultyLabel: string
  course: string | number
  room: string
  ttjNumber: string
  dekanName: string | null
}

export function fetchArizaContext() {
  return request<ArizaContext>('/api/student/applications/context')
}

export type FormalArizaBody = {
  kind: 'ariza' | 'tushuntirish'
  recipient: 'rektor' | 'prorektor' | 'dekan'
  title: string
  fullName: string
  ttjNumber: string
  room: string
  incidentText: string
  signature: { attested: true; image: string }
}

export type ArizaDocumentData = {
  success: true
  formal: Record<string, unknown> | null
  text: string
  title: string | null
  type: string | null
  signatureImage: string | null
  signedAt: string
  verifyCode: string
}

export function submitFormalAriza(body: FormalArizaBody) {
  return request<{ success: true; application: StudentApplication; receipt: ArizaReceipt; compose: Record<string, unknown> }>(
    '/api/student/applications/formal',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

export function fetchArizaDocument(arizaId: string | number) {
  return request<ArizaDocumentData>(
    `/api/student/applications/document?id=${encodeURIComponent(String(arizaId))}`,
  )
}
