'use client'

import { getAuthHeaders } from '@/lib/auth-session'
import { apiRequest as requestJson } from '@/lib/api-client'
import { ClientCache } from '@/lib/client-cache'
import type { PaymentRecord, PaymentSummary, PaymentStatus, SubmitPaymentResult } from '../types'

// The student's own payments: read on dashboard/tolova visits, changed only by
// their own upload (which clears the cache) or a staff review (visible within the TTL).
const studentPaymentsCache = new ClientCache<PaymentRecord[]>(30_000)

export function fetchStudentPayments() {
  return studentPaymentsCache.get('mine', async () => {
    const result = await requestJson<{ payments: PaymentRecord[] }>('/api/student/payments')
    return result.payments
  })
}

export function submitStudentPayment(form: FormData) {
  return studentPaymentsCache.invalidateAround(
    requestJson<SubmitPaymentResult>('/api/student/payments', { method: 'POST', body: form }),
  )
}

// The receipt-review body is shared by the tarbiyachi and dekan panels; each
// has its own faculty-scoped endpoint, chosen by which panel's URL we are in.
function reviewPaymentsEndpoint() {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/dekan')
    ? '/api/dekan/payments'
    : '/api/tarbiyachi/payments'
}

export async function fetchAdminPayments(studentId?: string) {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''
  const result = await requestJson<{ payments: PaymentRecord[] }>(`${reviewPaymentsEndpoint()}${query}`)
  return result.payments
}

export async function fetchAdminPaymentSummary(): Promise<PaymentSummary> {
  try {
    const authHeaders = await getAuthHeaders()
    if (!authHeaders.Authorization) {
      return { waitingCount: 0 }
    }
    return await requestJson<PaymentSummary>(`${reviewPaymentsEndpoint()}?summary=1`)
  } catch {
    return { waitingCount: 0 }
  }
}

// The `receipts` storage bucket is private; the stored `receipt_url` is
// just an object path, so a fresh short-lived signed URL must be minted
// per view/download instead of using it directly as an <img src>/href.
export async function fetchReceiptSignedUrl(paymentId: string, opts: { download?: boolean } = {}) {
  const query = opts.download ? '&download=1' : ''
  const result = await requestJson<{ url: string }>(`/api/payments/receipt-url?id=${encodeURIComponent(paymentId)}${query}`)
  return result.url
}

export function reviewAdminPayments(input: {
  ids: string[]
  status: Extract<PaymentStatus, 'approved' | 'rejected'>
  message: string
}) {
  return requestJson<{ ok: true }>(reviewPaymentsEndpoint(), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
