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
  const result = await requestJson<{ payments: PaymentRecord[] }>(`/api/admin/payments${query}`)
  return result.payments
}

export async function fetchAdminPaymentSummary(): Promise<PaymentSummary> {
  try {
    const authHeaders = await getAuthHeaders()
    if (!authHeaders.Authorization) {
      return { waitingCount: 0 }
    }
    return await requestJson<PaymentSummary>('/api/admin/payments?summary=1')
  } catch {
    return { waitingCount: 0 }
  }
}

export function reviewAdminPayments(input: {
  ids: string[]
  status: Extract<PaymentStatus, 'approved' | 'rejected'>
  message: string
}) {
  return requestJson<{ ok: true }>('/api/admin/payments', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
