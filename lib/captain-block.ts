import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * A sardor's `users.block` only means something in a blocked (A/B) dorm. In a
 * simple dorm the column can hold a stale value from an earlier room or a
 * permit, and every block-scoped query ("same block as the captain") then
 * collapses to just that one student. So the captain's effective block is
 * null unless the dorm itself is blocked.
 */
export async function effectiveCaptainBlock(
  supabase: SupabaseClient,
  dormId: string | null | undefined,
  block: string | null | undefined,
): Promise<string | null> {
  if (!block || !dormId) return null
  const { data } = await supabase.from('dorms').select('layout_kind').eq('id', dormId).maybeSingle()
  return data?.layout_kind === 'blocked' ? block : null
}
