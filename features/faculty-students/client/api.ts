'use client'

import { apiRequest as requestJson } from '@/lib/api-client'
import type {
  FacultyPaymentRecord,
  SendWarningInput,
  SendWarningResult,
  SetBlacklistInput,
  SetBlacklistResult,
  SetFloorCaptainInput,
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

// Appoint the student as the floor captain (sardor) of their own residence
// floor, or strip that role. /api/admin/users routes is_floor_captain=true
// through the promote_floor_captain RPC, which atomically demotes whoever
// currently holds the same (faculty, floor, gender) slot; is_floor_captain=false
// is a plain demote. Faculty scope is enforced server-side, and a student with
// no assigned floor / gender (i.e. no room yet) is rejected with 400.
export function setStudentFloorCaptain({ studentId, isCaptain }: SetFloorCaptainInput) {
  return requestJson<{ ok: true }>('/api/admin/users', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: studentId, source: 'users', is_floor_captain: isCaptain }),
  })
}

// The editable slice of a student record. Room, floor, warning count and
// account status are deliberately absent — those are driven by the Xonalar
// map, the warning flow and email verification, not a free-form edit.
// Captaincy has its own action (setStudentFloorCaptain above), not a form field.
// Faculty is a tenancy boundary and is rejected server-side if changed.
export type FacultyStudentPatch = Partial<{
  full_name: string
  middle_name: string
  phone: string
  direction: string
  course: string
  gender: string
  birth_date: string
  nationality: string
  study_type: string
  entry_date: string
  passport_series: string
  jshshir: string
  passport_date: string
  region: string
  district: string
  mahalla: string
  father_full_name: string
  father_workplace: string
  father_phone: string
  mother_full_name: string
  mother_workplace: string
  mother_phone: string
}>

// Both endpoints below reuse /api/admin/users, which is already scoped to the
// caller's own faculty for a dekan (see app/api/admin/users/route.ts) and
// rejects student rows from any other faculty.
export function updateFacultyStudent(id: string, patch: FacultyStudentPatch) {
  return requestJson<{ ok: true }>('/api/admin/users', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, source: 'users', ...patch }),
  })
}

export function deleteFacultyStudent(id: string) {
  return requestJson<{ ok: true }>('/api/admin/users', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, source: 'users' }),
  })
}
