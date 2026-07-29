import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

// Proves a file (identified by its sha256 hash) actually passed one of the
// AI pre-checks (/api/ai/tekshiruv, /api/ai/yollanma-tekshiruv) — those
// checks and the real submission (/api/student/payments,
// /api/permit-requests) are two independent, unauthenticated-or-separately-
// authenticated requests, so without this a caller could skip straight to
// the submission endpoint with a self-declared "yes, it's validated" flag.
// A short-lived HMAC-signed claim, keyed to the exact file hash AND the
// specific facts the precheck verified about it (who submitted it, what
// amount/identity it was checked against), closes that gap. Binding only
// the file hash isn't enough: a real, AI-approved receipt for 300,000 could
// otherwise be resubmitted claiming 600,000/2 months, since the submission
// endpoint only checks amount == monthlyFee * months.length arithmetically
// — it has no way to know what amount the AI actually saw unless the claim
// says so.
const CLAIM_TTL_MS = 10 * 60_000

type ClaimContext = Record<string, string | number>

function claimKey(purpose: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY topilmadi')
  return createHmac('sha256', secret).update(`ai-receipt-claim:${purpose}`).digest()
}

// Canonical, order-independent and unambiguous serialization. A hand-built
// `key=value&...` string is unsafe for attacker-controlled values because
// separators inside a value can make two different context objects serialize
// identically.
function stableContext(context: ClaimContext): string {
  const sorted = Object.keys(context)
    .sort()
    .reduce<Record<string, string | number>>((result, key) => {
      result[key] = context[key]
      return result
    }, {})
  return JSON.stringify(sorted)
}

export function signFileClaim(purpose: string, fileHash: string, context: ClaimContext = {}): string {
  const payload = JSON.stringify({
    h: fileHash,
    e: Date.now() + CLAIM_TTL_MS,
    c: stableContext(context),
  })
  const signature = createHmac('sha256', claimKey(purpose)).update(payload).digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${signature}`
}

export function verifyFileClaim(purpose: string, token: unknown, fileHash: string, context: ClaimContext = {}): boolean {
  if (typeof token !== 'string' || !token) return false
  const separatorIndex = token.indexOf('.')
  if (separatorIndex < 0) return false
  const encodedPayload = token.slice(0, separatorIndex)
  const signature = token.slice(separatorIndex + 1)
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

  let parsed: { h?: unknown; e?: unknown; c?: unknown }
  try {
    parsed = JSON.parse(payload)
  } catch {
    return false
  }

  const claimedHash = parsed.h
  const expiresAt = Number(parsed.e)
  const claimedContext = parsed.c
  if (typeof claimedHash !== 'string' || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return false
  if (claimedHash !== fileHash) return false

  return claimedContext === stableContext(context)
}
