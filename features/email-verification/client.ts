// Client side of email-ownership proof (server: lib/email-proof.ts).
//
// Pages call `fetchWithEmailProof(email, (proof) => fetch(...))`. A proof
// already held for that email in this tab is reused; otherwise the
// <EmailProofDialog /> mounted on the page mails a code and collects it.
// Resolves to null when the applicant closes the dialog.

const STORAGE_KEY = 'student_email_proof'
// Treat a proof as stale a little before the server does, so a request
// never races the expiry.
const EXPIRY_MARGIN_MS = 60_000

type StoredProof = { email: string; proof: string; expiresAt: number }

export const EMAIL_PROOF_REQUIRED_CODE = 'EMAIL_PROOF_REQUIRED'

function normalize(email: string) {
  return email.trim().toLowerCase()
}

function readStored(): StoredProof | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredProof) : null
  } catch {
    return null
  }
}

export function getStoredEmailProof(email: string): string | null {
  const stored = readStored()
  if (!stored || stored.email !== normalize(email)) return null
  if (stored.expiresAt - EXPIRY_MARGIN_MS <= Date.now()) return null
  return stored.proof
}

export function clearEmailProof() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch { /* private mode */ }
}

function storeProof(value: StoredProof) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch { /* private mode — the proof still lives for this request */ }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Xatolik yuz berdi. Qayta urinib ko‘ring.')
  return payload as T
}

export function sendEmailCode(email: string) {
  return postJson<{ challenge: string; devCode?: string }>('/api/email-verification/send', { email: normalize(email) })
}

type ProofResult = { email: string; proof: string }

async function verifyEmailCode(challenge: string, code: string): Promise<ProofResult> {
  const result = await postJson<StoredProof>('/api/email-verification/verify', { challenge, code })
  storeProof({ email: result.email, proof: result.proof, expiresAt: result.expiresAt })
  return { email: result.email, proof: result.proof }
}

// ── Dialog bridge ─────────────────────────────────────────────────────────
// A tiny external store: ensureEmailProof()/ensureChallengeProof() park a
// pending request here and the dialog (useSyncExternalStore) renders it.

type PendingRequest =
  | { kind: 'email'; email: string; resolve: (result: ProofResult | null) => void }
  | {
      kind: 'challenge'
      challenge: string
      devCode?: string
      // Repeats whatever request produced the first challenge, for "qayta
      // yuborish" — the caller never learns the email either way.
      onResend: () => Promise<{ challenge: string; devCode?: string }>
      resolve: (result: ProofResult | null) => void
    }

let pending: PendingRequest | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function subscribeEmailProofRequest(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getPendingEmailProofRequest(): PendingRequest | null {
  return pending
}

export function settleEmailProofRequest(result: ProofResult | null) {
  const current = pending
  pending = null
  emit()
  current?.resolve(result)
}

export { verifyEmailCode }

export function ensureEmailProof(email: string): Promise<string | null> {
  const stored = getStoredEmailProof(email)
  if (stored) return Promise.resolve(stored)
  const target = normalize(email)
  return new Promise((resolve) => {
    pending?.resolve(null)
    pending = { kind: 'email', email: target, resolve: (result) => resolve(result?.proof ?? null) }
    emit()
  })
}

/**
 * Like ensureEmailProof, but for a flow where the SERVER — not the caller —
 * decided which email to mail a code to (e.g. "whatever's on file for this
 * record", never an address typed into a form) and already sent the first
 * one. The caller only ever sees `challenge`/`devCode`, never the address;
 * it learns the real email only once the code is verified.
 */
export function ensureChallengeProof(
  initial: { challenge: string; devCode?: string },
  onResend: () => Promise<{ challenge: string; devCode?: string }>,
): Promise<ProofResult | null> {
  return new Promise((resolve) => {
    pending?.resolve(null)
    pending = { kind: 'challenge', challenge: initial.challenge, devCode: initial.devCode, onResend, resolve }
    emit()
  })
}

/**
 * Runs `doFetch` with a proof for `email`, asking for a code when needed and
 * once more if the server says the held proof is no longer valid. Returns
 * null when the applicant dismissed the dialog.
 *
 * `lazy`: don't ask up front — send whatever proof is held (possibly none)
 * and only ask if the server answers EMAIL_PROOF_REQUIRED. For endpoints
 * where only some requests need proof (a fresh permit submission doesn't,
 * reopening an existing one does).
 */
export async function fetchWithEmailProof(
  email: string,
  doFetch: (proof: string) => Promise<Response>,
  opts: { lazy?: boolean } = {},
): Promise<Response | null> {
  let proof = opts.lazy ? (getStoredEmailProof(email) ?? '') : await ensureEmailProof(email)
  if (proof === null) return null
  let response = await doFetch(proof)
  if (response.status === 401) {
    const body = await response.clone().json().catch(() => null)
    if (body?.code === EMAIL_PROOF_REQUIRED_CODE) {
      clearEmailProof()
      proof = await ensureEmailProof(email)
      if (!proof) return null
      response = await doFetch(proof)
    }
  }
  return response
}
