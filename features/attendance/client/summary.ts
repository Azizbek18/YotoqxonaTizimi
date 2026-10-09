'use client'

import { ClientCache } from '@/lib/client-cache'
import { getAuthHeaders } from '@/lib/auth-session'

export type StudentAttendanceSummary = {
  ok: boolean
  hasOpen?: boolean
  closesAt?: string | null
  myState?: string | null
}

// The dashboard banner and the yo'qlama page read the same summary one after the
// other; share one request for a short window. A check-in clears it.
const summaryCache = new ClientCache<StudentAttendanceSummary>(20_000)

export function fetchAttendanceSummary(): Promise<StudentAttendanceSummary> {
  return summaryCache.get('me', async () => {
    const headers = await getAuthHeaders()
    const res = await fetch('/api/attendance/summary', { headers, cache: 'no-store' })
    const data = await res.json()
    return { ok: res.ok, hasOpen: data?.hasOpen, closesAt: data?.closesAt, myState: data?.myState }
  })
}

export function clearAttendanceSummary() {
  summaryCache.clear()
}
