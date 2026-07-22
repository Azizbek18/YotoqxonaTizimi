'use client'

import { getAuthHeaders } from '@/lib/auth-session'
import type { StudentApplication } from '../types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...await getAuthHeaders(), ...init?.headers },
    cache: 'no-store',
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.ok === false) throw new Error(body.error || 'Chat so\'rovini bajarib bo\'lmadi')
  return body as T
}

export function fetchAdminChat(studentId: string) {
  return request<{ ok: true; messages: StudentApplication[] }>(
    `/api/admin/chat?studentId=${encodeURIComponent(studentId)}`,
  )
}

export function sendAdminChat(studentId: string, message: string) {
  return request<{ ok: true; message: StudentApplication }>('/api/admin/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: studentId, message }),
  })
}
