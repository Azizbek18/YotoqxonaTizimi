'use client'

import { apiRequest } from '@/lib/api-client'
import type {
  ForeignDoc,
  ForeignDocDashboardRow,
  ForeignDocInput,
  ForeignDocStaffPatch,
} from '../types'

export async function fetchMyForeignDocs(): Promise<ForeignDoc[]> {
  const result = await apiRequest<{ docs: ForeignDoc[] }>('/api/student/foreign-docs')
  return result.docs
}

/**
 * Hujjatni yaratadi/yangilaydi. Fayl ixtiyoriy — multipart bilan yuboriladi
 * (avatar yuklash namunasi). `apiRequest` Content-Type ni o'zi qo'ymaydi, shu
 * bois FormData bilan brauzer boundary ni to'g'ri qo'yadi.
 */
export async function saveForeignDoc(
  input: ForeignDocInput,
  file: File | null,
): Promise<ForeignDoc> {
  const form = new FormData()
  form.append('payload', JSON.stringify(input))
  if (file) form.append('file', file)
  const result = await apiRequest<{ doc: ForeignDoc }>('/api/student/foreign-docs', {
    method: 'POST',
    body: form,
  })
  return result.doc
}

export async function deleteForeignDoc(id: string): Promise<void> {
  await apiRequest<{ ok: true }>(`/api/student/foreign-docs?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/** Hujjat faylining qisqa muddatli signed URL manzili (talaba). */
export async function foreignDocFileUrl(id: string): Promise<string> {
  const result = await apiRequest<{ url: string }>(
    `/api/student/foreign-docs/file?id=${encodeURIComponent(id)}`,
  )
  return result.url
}

// ── Dekan / superadmin ──────────────────────────────────────────────────────

export async function fetchForeignDocsDashboard(): Promise<ForeignDocDashboardRow[]> {
  const result = await apiRequest<{ docs: ForeignDocDashboardRow[] }>('/api/dekan/foreign-docs')
  return result.docs
}

export async function patchForeignDoc(id: string, patch: ForeignDocStaffPatch): Promise<ForeignDoc> {
  const result = await apiRequest<{ doc: ForeignDoc }>(
    `/api/dekan/foreign-docs?id=${encodeURIComponent(id)}`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) },
  )
  return result.doc
}

export async function addForeignDocForStudent(
  studentId: string,
  input: ForeignDocInput,
): Promise<ForeignDoc> {
  const result = await apiRequest<{ doc: ForeignDoc }>('/api/dekan/foreign-docs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, ...input }),
  })
  return result.doc
}

export async function dekanForeignDocFileUrl(id: string): Promise<string> {
  const result = await apiRequest<{ url: string }>(
    `/api/dekan/foreign-docs/file?id=${encodeURIComponent(id)}`,
  )
  return result.url
}
