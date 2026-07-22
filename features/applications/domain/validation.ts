import { ApiError } from '../../../server/http/api-error'
import type { CreateStudentApplication } from '../types'

const allowedTypes = new Set(['ariza', 'tushuntirish', 'chat', 'taklif'])

function text(value: unknown, max: number, required = false) {
  const normalized = typeof value === 'string' ? value.trim().slice(0, max) : ''
  if (required && !normalized) throw new ApiError(400, 'Majburiy maydonlar to\'ldirilmagan')
  return normalized
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
  const level = input.level === 'warning' || input.level === 'critical' ? input.level : 'info'
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
