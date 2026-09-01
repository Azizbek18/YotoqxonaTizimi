import { ApiError } from '../../../server/http/api-error'
import type { CreateStudentApplication } from '../types'

const allowedTypes = new Set(['ariza', 'tushuntirish', 'chat', 'taklif'])

function text(value: unknown, max: number, required = false) {
  const normalized = typeof value === 'string' ? value.trim().slice(0, max) : ''
  if (required && !normalized) throw new ApiError(400, 'Majburiy maydonlar to\'ldirilmagan')
  return normalized
}

export type SignatureInput = { typedName: string; attested: boolean }

export function parseSignatureInput(value: unknown): SignatureInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const s = value as Record<string, unknown>
  const typedName = typeof s.typedName === 'string' ? s.typedName.trim().slice(0, 160) : ''
  const attested = s.attested === true
  if (!typedName && !attested) return null
  return { typedName, attested }
}

export function parseStudentApplication(value: unknown): CreateStudentApplication {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'Murojaat ma\'lumotlari noto\'g\'ri')
  }
  const input = value as Record<string, unknown>
  if (typeof input.type !== 'string' || !allowedTypes.has(input.type)) {
    throw new ApiError(400, 'Murojaat turi noto\'g\'ri')
  }
  const type = input.type as CreateStudentApplication['type']
  const requestedStatus = typeof input.status === 'string' ? input.status : ''
  const status = type === 'chat'
    ? 'submitted'
    : (requestedStatus === 'draft' || requestedStatus === 'submitted' || requestedStatus === 'pending'
        ? requestedStatus
        : 'pending')
  // Level/priority is never taken from the student's own request — every
  // legitimate client always sends 'info' at creation time, and staff have
  // a separate admin-only endpoint (app/api/admin/arizalar/route.ts) to
  // escalate a submission's level after review. Trusting a client-supplied
  // level here would let a student self-flag their own ariza as 'critical'
  // and jump the staff queue.
  const level = 'info' as const
  return {
    type,
    title: text(input.title, 200, true),
    reason: text(input.reason, 4000),
    text: text(input.text, 20000, true),
    status,
    level,
    aiGenerated: Boolean(input.aiGenerated),
  }
}
