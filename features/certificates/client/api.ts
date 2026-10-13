'use client'

import { apiRequest } from '@/lib/api-client'
import type {
  CertificateDashboardRow,
  CertificateDocument,
  CertificatePurpose,
  CertificateRequest,
} from '../types'

export async function fetchMyCertificates(): Promise<CertificateRequest[]> {
  const result = await apiRequest<{ requests: CertificateRequest[] }>('/api/student/certificates')
  return result.requests
}

export async function requestCertificate(input: { purpose: CertificatePurpose; purposeNote?: string }): Promise<CertificateRequest> {
  const result = await apiRequest<{ request: CertificateRequest }>('/api/student/certificates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return result.request
}

export async function fetchCertificateDocument(id: string): Promise<CertificateDocument> {
  const result = await apiRequest<{ certificate: CertificateDocument }>(`/api/student/certificates/${id}`)
  return result.certificate
}

export async function fetchFacultyCertificates(): Promise<CertificateDashboardRow[]> {
  const result = await apiRequest<{ requests: CertificateDashboardRow[] }>('/api/dekan/certificates')
  return result.requests
}

export async function decideCertificate(
  id: string,
  input: { action: 'approve' | 'reject'; note?: string },
): Promise<CertificateRequest> {
  const result = await apiRequest<{ request: CertificateRequest }>(`/api/dekan/certificates?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return result.request
}
