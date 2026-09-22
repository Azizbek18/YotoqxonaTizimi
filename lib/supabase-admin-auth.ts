import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'

// This project's Auth admin endpoint intermittently rejects otherwise-valid
// requests with "unrecognized JWT kid" (observed on both createUser and
// deleteUser, via supabase-js and raw REST alike) — a transient GoTrue-side
// key-cache issue, not a request bug. A short retry absorbs it.
function isTransientKidError(message: string | undefined) {
  return typeof message === 'string' && message.includes('unrecognized JWT kid')
}

async function withKidRetry<T extends { error: { message?: string } | null }>(
  attempt: () => Promise<T>,
  retries = 2,
): Promise<T> {
  let result = await attempt()
  for (let i = 0; i < retries && isTransientKidError(result.error?.message); i++) {
    await new Promise((resolve) => setTimeout(resolve, 300))
    result = await attempt()
  }
  return result
}

type CreateAuthUserResult =
  | { data: { user: { id: string; email: string } }; error: null }
  | { data: { user: null }; error: { message: string; status?: number; code?: string } }

const CREATE_RETRY_DELAYS_MS = [250, 750]

function isRetryableCreateFailure(status: number, message: string) {
  return status >= 500 || isTransientKidError(message)
}

export function isDuplicateAuthUserError(error: { message?: string; code?: string } | null) {
  if (!error) return false
  return error.code === 'email_exists'
    || /already (?:been )?registered|already exists|email.*exists/i.test(error.message ?? '')
}

// supabase-js's auth.admin.createUser() fails against this project's
// `sb_secret_...`-format service key when called through Next.js's patched
// server-side fetch — a raw REST call with `cache: 'no-store'` avoids that
// (deleteUser via the JS client is unaffected, so only createUser needs this).
export async function createAuthUserSafely(
  email: string,
  password: string,
  userMetadata: Record<string, unknown>,
): Promise<CreateAuthUserResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL yoki SUPABASE_SERVICE_ROLE_KEY topilmadi')

  let lastError: { message: string; status?: number; code?: string } = {
    message: "Foydalanuvchi yaratib bo'lmadi",
  }

  for (let attempt = 0; attempt <= CREATE_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetch(`${url}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
        body: JSON.stringify({ email, password, email_confirm: true, user_metadata: userMetadata }),
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({})) as Record<string, unknown>
      if (response.ok) return { data: { user: body as { id: string; email: string } }, error: null }

      lastError = {
        message: String(body.msg || body.error_description || body.error || lastError.message),
        status: response.status,
        code: typeof body.code === 'string' ? body.code : undefined,
      }
      if (!isRetryableCreateFailure(response.status, lastError.message)) break
    } catch (error) {
      // A request can reach GoTrue but lose its response. Retrying makes the
      // operation idempotent from the caller's perspective; if the first call
      // actually succeeded, GoTrue answers the retry with email_exists and the
      // registration route safely reconciles that orphaned Auth row.
      lastError = {
        message: error instanceof Error ? error.message : 'Supabase Auth bilan aloqa uzildi',
        code: 'auth_network_error',
      }
    }

    if (attempt < CREATE_RETRY_DELAYS_MS.length) {
      await new Promise((resolve) => setTimeout(resolve, CREATE_RETRY_DELAYS_MS[attempt]))
    }
  }

  return { data: { user: null }, error: lastError }
}

export async function findAuthUserByEmailSafely(email: string) {
  const supabase = getServiceSupabase()
  const normalizedEmail = email.trim().toLowerCase()

  for (let page = 1; page <= 100; page++) {
    const { data, error } = await withKidRetry(() => supabase.auth.admin.listUsers({ page, perPage: 1000 }))
    if (error) return { user: null, error }
    const user = data.users.find((candidate) => candidate.email?.trim().toLowerCase() === normalizedEmail)
    if (user) return { user, error: null }
    if (data.users.length < 1000) break
  }

  return { user: null, error: null }
}

export async function deleteAuthUserSafely(id: string) {
  return withKidRetry(() => getServiceSupabase().auth.admin.deleteUser(id))
}

// Set a new password on an existing Auth user (and re-confirm the email so a
// password sign-in works immediately). Used when a student who already started
// registration (pending row + Auth account) comes back through the wizard and
// picks a fresh password. Raw REST for the same reason as createAuthUserSafely.
export async function updateAuthUserPasswordSafely(
  id: string,
  password: string,
): Promise<{ error: { message?: string } | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL yoki SUPABASE_SERVICE_ROLE_KEY topilmadi')

  return withKidRetry(async () => {
    const response = await fetch(`${url}/auth/v1/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ password, email_confirm: true }),
      cache: 'no-store',
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      return { error: { message: body.msg || body.error_description || body.error || "Parolni yangilab bo'lmadi" } }
    }
    return { error: null }
  })
}
