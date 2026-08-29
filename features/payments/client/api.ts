'use client'

import { getAuthHeaders } from '@/lib/auth-session'
import { apiRequest as requestJson } from '@/lib/api-client'
import type { PaymentRecord, PaymentSummary, PaymentStatus, SubmitPaymentResult } from '../types'

export async function fetchStudentPayments() {
  const result = await requestJson<{ payments: PaymentRecord[] }>('/api/student/payments')
  return result.payments
}

export function submitStudentPayment(form: FormData) {
  return requestJson<SubmitPaymentResult>('/api/student/payments', { method: 'POST', body: form })
}

export async function fetchAdminPayments(studentId?: string) {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''
  const result = await requestJson<{ payments: PaymentRecord[] }>(`/api/tarbiyachi/payments${query}`)
  return result.payments
}

export async function fetchAdminPaymentSummary(): Promise<PaymentSummary> {
  try {
    const authHeaders = await getAuthHeaders()
    if (!authHeaders.Authorization) {
      return { waitingCount: 0 }
    }
    return await requestJson<PaymentSummary>('/api/tarbiyachi/payments?summary=1')
  } catch {
    return { waitingCount: 0 }
  }
}

// The `receipts` storage bucket is private; the stored `receipt_url` is
// just an object path, so a fresh short-lived signed URL must be minted
// per view/download instead of using it directly as an <img src>/href.
export async function fetchReceiptSignedUrl(paymentId: string) {
  const result = await requestJson<{ url: string }>(`/api/payments/receipt-url?id=${encodeURIComponent(paymentId)}`)
  return result.url
}

export function reviewAdminPayments(input: {
  ids: string[]
  status: Extract<PaymentStatus, 'approved' | 'rejected'>
  message: string
}) {
  return requestJson<{ ok: true }>('/api/tarbiyachi/payments', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
