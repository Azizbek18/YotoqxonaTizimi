import { ApiError } from '../../../server/http/api-error'
import { isArizaRecipient, type ArizaKind, type ArizaRecipient } from '../../../lib/student-ariza-template'
import type { CreateStudentApplication } from '../types'

const allowedTypes = new Set(['ariza', 'tushuntirish', 'chat', 'taklif'])

function text(value: unknown, max: number, required = false) {
  const normalized = typeof value === 'string' ? value.trim().slice(0, max) : ''
  if (required && !normalized) throw new ApiError(400, 'Majburiy maydonlar to\'ldirilmagan')
  return normalized
}

export type SignatureInput = { typedName: string; attested: boolean; image?: string | null }

export function parseSignatureInput(value: unknown): SignatureInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const s = value as Record<string, unknown>
  const typedName = typeof s.typedName === 'string' ? s.typedName.trim().slice(0, 160) : ''
  const attested = s.attested === true
  const image = typeof s.image === 'string' && s.image.startsWith('data:image/png;base64,') ? s.image : null
  if (!typedName && !attested && !image) return null
  return { typedName, attested, image }
}

// ~260 KB cap on the base64 signature PNG (a trimmed pen stroke is a few KB).
const MAX_SIGNATURE_IMAGE_CHARS = 260_000

export type FormalArizaInput = {
  kind: ArizaKind
  recipient: ArizaRecipient
  title: string
  fullName: string
  ttjNumber: string
  room: string
  incidentText: string
  signatureImage: string
  attested: boolean
}

export function parseFormalAriza(value: unknown): FormalArizaInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'Ariza ma\'lumotlari noto\'g\'ri')
  }
  const s = value as Record<string, unknown>
  const kind = s.kind === 'ariza' || s.kind === 'tushuntirish' ? s.kind : null
  if (!kind) throw new ApiError(400, 'Ariza turini tanlang')
  if (!isArizaRecipient(s.recipient)) throw new ApiError(400, 'Kimning nomiga yozilishini tanlang')

  const sig = parseSignatureInput(s.signature)
  if (!sig?.attested) throw new ApiError(400, 'Ma\'lumotlar to\'g\'riligini tasdiqlang')
  if (!sig.image) throw new ApiError(400, 'Imzo qo\'ying')
  if (sig.image.length > MAX_SIGNATURE_IMAGE_CHARS) throw new ApiError(413, 'Imzo rasmi juda katta')

  return {
    kind,
    recipient: s.recipient,
    title: text(s.title, 200, true),
    fullName: text(s.fullName, 160, true),
    ttjNumber: text(s.ttjNumber, 20),
    room: text(s.room, 20),
    incidentText: text(s.incidentText, 8000, true),
    signatureImage: sig.image,
    attested: true,
  }
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
