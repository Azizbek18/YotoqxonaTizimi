import 'server-only'
import { createHash, createHmac, timingSafeEqual } from 'crypto'

// A permanent, tamper-evident electronic signature for a student application
// (arizalar.type in {'ariza','tushuntirish'}). Unlike lib/receipt-claim.ts
// (short-lived AI-precheck claims), a signature never expires — it is the
// non-repudiation record: "this student attested to exactly this content at
// this time".
//
// Two independent checks make silent tampering detectable to anyone with the
// verify code, even someone with write access to the database:
//   1. content_hash = sha256(canonical snapshot). Edit the stored snapshot
//      and the hash no longer matches.
//   2. signature = HMAC(secret, hash | student_id | signed_at | verify_code).
//      Edit the hash (or any bound field) and the HMAC no longer verifies.
// The secret is an env var, never stored in the DB.

function signingKey(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY topilmadi')
  return createHmac('sha256', secret).update('ariza-signature:v1').digest()
}

/** Order-independent, unambiguous JSON — the exact bytes that get hashed. */
export function canonicalJson(value: Record<string, unknown>): string {
  const sorted = Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = value[k]
      return acc
    }, {})
  return JSON.stringify(sorted)
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1

/** Human-friendly, unambiguous verification code: `YT-8F3K-2Q9D`. */
export function makeVerifyCode(): string {
  const pick = () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  const block = () => Array.from({ length: 4 }, pick).join('')
  return `YT-${block()}-${block()}`
}

export function normalizeVerifyCode(input: unknown): string {
  const raw = String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const body = raw.startsWith('YT') ? raw.slice(2) : raw
  if (body.length !== 8) return ''
  return `YT-${body.slice(0, 4)}-${body.slice(4, 8)}`
}

export type SignatureBinding = {
  contentHash: string
  studentId: string
  signedAt: string
  verifyCode: string
}

// `signedAt` round-trips through Postgres timestamptz ("...Z" becomes
// "...+00:00", precision may shift), so both signing and verifying bind the
// canonical ISO form, never the raw string.
function canonicalInstant(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toISOString()
}

export function signAriza(binding: SignatureBinding): string {
  const at = canonicalInstant(binding.signedAt)
  const payload = `${binding.contentHash}|${binding.studentId}|${at}|${binding.verifyCode}`
  return createHmac('sha256', signingKey()).update(payload).digest('base64url')
}

export function verifyArizaSignature(binding: SignatureBinding, signature: unknown): boolean {
  if (typeof signature !== 'string' || !signature) return false
  const expected = signAriza(binding)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Recompute the hash from a stored snapshot and check the HMAC. Returns
 * whether the snapshot is intact AND the signature is authentic.
 */
export function verifyArizaRecord(input: {
  contentSnapshot: Record<string, unknown>
  contentHash: string
  studentId: string
  signedAt: string
  verifyCode: string
  signature: string
}): { hashOk: boolean; signatureOk: boolean; valid: boolean } {
  const recomputed = sha256Hex(canonicalJson(input.contentSnapshot))
  const hashOk = recomputed === input.contentHash
  const signatureOk = verifyArizaSignature(
    {
      contentHash: input.contentHash,
      studentId: input.studentId,
      signedAt: input.signedAt,
      verifyCode: input.verifyCode,
    },
    input.signature,
  )
  return { hashOk, signatureOk, valid: hashOk && signatureOk }
}

/** The frozen snapshot of what the student signed. */
export function buildArizaSnapshot(input: {
  arizaId: string
  studentId: string
  studentName: string
  faculty: string | null
  direction: string | null
  course: number | null
  title: string
  type: string
  reason: string
  text: string
  signedAt: string
}): Record<string, unknown> {
  return {
    arizaId: input.arizaId,
    studentId: input.studentId,
    studentName: input.studentName,
    faculty: input.faculty ?? '',
    direction: input.direction ?? '',
    course: input.course ?? null,
    title: input.title,
    type: input.type,
    reason: input.reason,
    text: input.text,
    signedAt: input.signedAt,
  }
}
