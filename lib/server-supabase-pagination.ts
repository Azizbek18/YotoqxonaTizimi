import 'server-only'

export const SUPABASE_PAGE_SIZE = 1000

type SupabasePage<T> = {
  data: T[] | null
  error: unknown
}

/**
 * PostgREST limits a response to `db-max-rows` (1000 in this project).
 * Fetch every page explicitly for server-side reports that must be exact.
 */
export async function fetchAllSupabaseRows<T>(
  loadPage: (from: number, to: number) => PromiseLike<SupabasePage<T>>,
  pageSize = SUPABASE_PAGE_SIZE,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError('Supabase page size must be a positive integer')
  }

  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await loadPage(from, from + pageSize - 1)
    if (error) throw error
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}
