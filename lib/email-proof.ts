import 'server-only'
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto'

// Proof that the caller controls an email inbox — the missing piece behind
// every public applicant flow (permit status/edit/cancel, /register,
// KV-talaba sign-up), which otherwise trust passport + email + JShSHIR as a
// bearer secret.
//
// Stateless on purpose (no table, no migration): the 6-digit code lives only
// inside an HMAC. `challenge` = payload.MAC(payload | code); the client gets
// the challenge, the inbox gets the code, and only both together verify.
// A verified code is exchanged for a short-lived `proof` token that the
// protected endpoints check against the email they are about to act on.
// Brute force is bounded by the rate limits in the send/verify routes.

export const CODE_TTL_MS = 10 * 60_000
export const PROOF_TTL_MS = 2 * 60 * 60_000

type ChallengePayload = { e: string; x: number; n: string }
type ProofPayload = { e: string; x: number }

function key(): Buffer {
  const secret = process.env.EMAIL_PROOF_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('EMAIL_PROOF_SECRET / SUPABASE_SERVICE_ROLE_KEY topilmadi')
  return createHmac('sha256', secret).update('email-proof:v1').digest()
}

function mac(value: string): string {
  return createHmac('sha256', key()).update(value).digest('base64url')
}

function sameMac(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

function encode(payload: object): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decode<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T
  } catch {
    return null
  }
}

export function normalizeProofEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase().slice(0, 254)
}

export function issueEmailChallenge(email: string, now = Date.now()) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const payload = encode({ e: normalizeProofEmail(email), x: now + CODE_TTL_MS, n: randomBytes(9).toString('base64url') })
  return { code, challenge: `${payload}.${mac(`challenge|${payload}|${code}`)}` }
}

/** The challenge's nonce + email, for per-challenge attempt limiting. */
export function readEmailChallenge(challenge: unknown): { email: string; nonce: string; expired: boolean } | null {
  const [payload] = String(challenge ?? '').split('.')
  const data = payload ? decode<ChallengePayload>(payload) : null
  if (!data || typeof data.e !== 'string' || typeof data.n !== 'string' || typeof data.x !== 'number') return null
  return { email: data.e, nonce: data.n, expired: data.x <= Date.now() }
}

/** Returns the verified email, or null for a wrong/expired/forged code. */
export function verifyEmailChallenge(challenge: unknown, code: unknown, now = Date.now()): string | null {
  const [payload, signature, extra] = String(challenge ?? '').split('.')
  const cleanCode = String(code ?? '').replace(/\D/g, '')
  if (!payload || !signature || extra !== undefined || cleanCode.length !== 6) return null
  const data = decode<ChallengePayload>(payload)
  if (!data || typeof data.e !== 'string' || typeof data.x !== 'number' || data.x <= now) return null
  return sameMac(signature, mac(`challenge|${payload}|${cleanCode}`)) ? data.e : null
}

export function issueEmailProof(email: string, now = Date.now()): { proof: string; expiresAt: number } {
  const expiresAt = now + PROOF_TTL_MS
  const payload = encode({ e: normalizeProofEmail(email), x: expiresAt })
  return { proof: `${payload}.${mac(`proof|${payload}`)}`, expiresAt }
}

export function hasEmailProof(proof: unknown, email: unknown, now = Date.now()): boolean {
  const [payload, signature, extra] = String(proof ?? '').split('.')
  if (!payload || !signature || extra !== undefined) return false
  if (!sameMac(signature, mac(`proof|${payload}`))) return false
  const data = decode<ProofPayload>(payload)
  if (!data || typeof data.e !== 'string' || typeof data.x !== 'number' || data.x <= now) return false
  const expected = normalizeProofEmail(email)
  return Boolean(expected) && data.e === expected
}

export const EMAIL_PROOF_REQUIRED = {
  error: 'Avval emailingizni tasdiqlang — unga yuborilgan 6 xonali kodni kiriting.',
  code: 'EMAIL_PROOF_REQUIRED',
} as const
