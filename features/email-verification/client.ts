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

export async function verifyEmailCode(challenge: string, code: string): Promise<string> {
  const result = await postJson<StoredProof>('/api/email-verification/verify', { challenge, code })
  storeProof({ email: result.email, proof: result.proof, expiresAt: result.expiresAt })
  return result.proof
}

// ── Dialog bridge ─────────────────────────────────────────────────────────
// A tiny external store: ensureEmailProof() parks a pending request here and
// the dialog (useSyncExternalStore) renders it.

type PendingRequest = { email: string; resolve: (proof: string | null) => void }

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

export function getEmailProofRequest(): string | null {
  return pending?.email ?? null
}

export function settleEmailProofRequest(proof: string | null) {
  const current = pending
  pending = null
  emit()
  current?.resolve(proof)
}

export function ensureEmailProof(email: string): Promise<string | null> {
  const stored = getStoredEmailProof(email)
  if (stored) return Promise.resolve(stored)
  return new Promise((resolve) => {
    pending?.resolve(null)
    pending = { email: normalize(email), resolve }
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
