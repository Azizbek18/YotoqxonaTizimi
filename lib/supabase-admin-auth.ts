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
  | { data: { user: null }; error: { message: string } }

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

  return withKidRetry(async () => {
    const response = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: userMetadata }),
      cache: 'no-store',
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { data: { user: null }, error: { message: body.msg || body.error_description || body.error || "Foydalanuvchi yaratib bo'lmadi" } }
    }
    return { data: { user: body }, error: null }
  })
}

export async function deleteAuthUserSafely(id: string) {
  return withKidRetry(() => getServiceSupabase().auth.admin.deleteUser(id))
}
