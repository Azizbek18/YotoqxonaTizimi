'use client'

import { apiRequest } from '@/lib/api-client'
import type { IntegrityReport } from '../types'

export function fetchIntegrityReport(): Promise<IntegrityReport> {
  return apiRequest<IntegrityReport>('/api/admin/data-integrity', undefined, "Tekshiruvni bajarib bo'lmadi")
}
