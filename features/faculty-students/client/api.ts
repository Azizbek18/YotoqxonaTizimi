'use client'

import { apiRequest as requestJson } from '@/lib/api-client'
import type {
  FacultyPaymentRecord,
  SendWarningInput,
  SendWarningResult,
  SetBlacklistInput,
  SetBlacklistResult,
  StudentProfileRow,
  StudentScope,
} from '../types'

export async function fetchFacultyStudents(scope: StudentScope = 'placed') {
  const result = await requestJson<{ students: StudentProfileRow[] }>(
    `/api/dekan/students/directory?scope=${scope}`,
  )
  return result.students
}

export async function fetchFacultyPayments() {
  const result = await requestJson<{ payments: FacultyPaymentRecord[] }>('/api/dekan/students/payments')
  return result.payments
}

export function sendStudentWarning(input: SendWarningInput) {
  return requestJson<SendWarningResult>('/api/dekan/students/warnings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function setStudentBlacklist(input: SetBlacklistInput) {
  return requestJson<SetBlacklistResult>('/api/dekan/students/blacklist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
