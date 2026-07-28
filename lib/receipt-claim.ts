import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

// Proves a file (identified by its sha256 hash) actually passed one of the
// AI pre-checks (/api/ai/tekshiruv, /api/ai/yollanma-tekshiruv) — those
// checks and the real submission (/api/student/payments,
// /api/permit-requests) are two independent, unauthenticated-or-separately-
// authenticated requests, so without this a caller could skip straight to
// the submission endpoint with a self-declared "yes, it's validated" flag.
// A short-lived HMAC-signed claim, keyed to the exact file hash, closes
// that gap without needing a new stored-session table.
const CLAIM_TTL_MS = 10 * 60_000

function claimKey(purpose: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY topilmadi')
  return createHmac('sha256', secret).update(`ai-receipt-claim:${purpose}`).digest()
}

export function signFileClaim(purpose: string, fileHash: string): string {
  const payload = `${fileHash}.${Date.now() + CLAIM_TTL_MS}`
  const signature = createHmac('sha256', claimKey(purpose)).update(payload).digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${signature}`
}

export function verifyFileClaim(purpose: string, token: unknown, fileHash: string): boolean {
  if (typeof token !== 'string' || !token) return false
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return false

  let payload: string
  try {
    payload = Buffer.from(encodedPayload, 'base64url').toString('utf8')
  } catch {
    return false
  }

  const expectedSignature = createHmac('sha256', claimKey(purpose)).update(payload).digest('base64url')
  const a = Buffer.from(signature)
  const b = Buffer.from(expectedSignature)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false

  const [claimedHash, expiresAtRaw] = payload.split('.')
  const expiresAt = Number(expiresAtRaw)
  if (!claimedHash || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return false

  return claimedHash === fileHash
}
