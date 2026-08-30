import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.generated'

type Client = SupabaseClient<Database>

type MatchedRow = {
  id: string
  status: string | null
  passport_series: string
  jshshir: string | null
  email: string
  permit_url: string
  application_type: string
}

export type PermitResubmission =
  | { action: 'insert' }
  | { action: 'reopen'; rowId: string; oldPermitPath: string | null }
  | { action: 'conflict'; message: string }

/**
 * `permit_requests` has hard UNIQUE constraints on passport_series, jshshir
 * and email. A rejected applicant who was told to fix their document and
 * resubmit would otherwise hit a permanent 409 — the row already exists.
 *
 * This classifies an incoming submission as one of:
 *  - `insert`  — a genuinely new applicant, no collision.
 *  - `reopen`  — the SAME person (matched on passport, plus jshshir for a
 *                yo'llanma) resubmitting after their permit was `rejected`.
 *                The caller updates that row back to `pending` with the new
 *                document instead of inserting.
 *  - `conflict` — someone else already holds one of these identity fields,
 *                or the applicant's own permit is still `pending` /
 *                already `approved` / `registered`.
 *
 * Filters use `.eq()` on validated columns only (never a `.or()` filter
 * string built from user input), matching the callers' existing pattern.
 */
export async function classifyPermitResubmission(
  supabase: Client,
  identity: { passport: string; jshshir: string | null; email: string },
): Promise<PermitResubmission> {
  const columns = 'id, status, passport_series, jshshir, email, permit_url, application_type'
  const [byPassport, byEmail, byJshshir] = await Promise.all([
    supabase.from('permit_requests').select(columns).eq('passport_series', identity.passport).maybeSingle(),
    supabase.from('permit_requests').select(columns).eq('email', identity.email).maybeSingle(),
    identity.jshshir
      ? supabase.from('permit_requests').select(columns).eq('jshshir', identity.jshshir).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  for (const result of [byPassport, byEmail, byJshshir]) {
    if (result.error) throw result.error
  }

  const byId = new Map<string, MatchedRow>()
  for (const row of [byPassport.data, byEmail.data, byJshshir.data]) {
    if (row) byId.set((row as MatchedRow).id, row as MatchedRow)
  }
  const rows = [...byId.values()]
  if (rows.length === 0) return { action: 'insert' }

  // The row that matches on the strong identity: passport always, plus
  // jshshir when the applicant type has one (yo'llanma).
  const identityRow = rows.find(
    (row) => row.passport_series === identity.passport && (!identity.jshshir || row.jshshir === identity.jshshir),
  )
  const otherCollisions = rows.filter((row) => row.id !== identityRow?.id)
  if (otherCollisions.length > 0) {
    return {
      action: 'conflict',
      message: 'Bu email, pasport yoki JShSHIR boshqa ariza bilan band. Ma\'lumotlar to\'g\'riligini tekshiring.',
    }
  }
  if (!identityRow) {
    return { action: 'conflict', message: 'Bu ma\'lumotlar bilan ariza avval yuborilgan.' }
  }
  if (identityRow.status !== 'rejected') {
    return {
      action: 'conflict',
      message:
        identityRow.status === 'pending'
          ? 'Arizangiz allaqachon yuborilgan va ko\'rib chiqilmoqda.'
          : 'Bu ma\'lumotlar bilan ariza allaqachon tasdiqlangan — «Ariza holatini tekshirish» bo\'limiga o\'ting.',
    }
  }
  return { action: 'reopen', rowId: identityRow.id, oldPermitPath: identityRow.permit_url || null }
}
