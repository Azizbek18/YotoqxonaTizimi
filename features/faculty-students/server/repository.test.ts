import { beforeEach, describe, expect, it, vi } from 'vitest'

// A tolovlar/users stand-in that, like PostgREST, caps every response at
// 1000 rows and records how many ids each `.in()` carried — one request with
// every student's id overflowed the ~16KB URL limit (HeadersOverflowError).
const state = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  inSizes: [] as number[],
}))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({
    from: (table: string) => {
      const filters: ((r: Record<string, unknown>) => boolean)[] = []
      let window: [number, number] = [0, 999]
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters.push(r => r[key] === value); return query },
        ilike: (key: string, value: string) => { filters.push(r => String(r[key]).toLowerCase() === value.toLowerCase()); return query },
        in: (key: string, values: unknown[]) => {
          state.inSizes.push(values.length)
          filters.push(r => values.includes(r[key]))
          return query
        },
        order: () => query,
        range: (from: number, to: number) => { window = [from, to]; return query },
        then: (resolve: (v: unknown) => unknown) => {
          const rows = (state.tables[table] ?? []).filter(r => filters.every(f => f(r)))
          const [from, to] = window
          return Promise.resolve({ data: rows.slice(from, Math.min(to, from + 999) + 1), error: null }).then(resolve)
        },
      }
      return query
    },
  }),
}))
import { createFacultyStudentsRepository } from './repository'

const student = (i: number) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  role: 'talaba', status: 'active', is_off_campus: false, faculty: 'amit',
})

describe('faculty payments for a large faculty', () => {
  beforeEach(() => {
    state.inSizes = []
    const users = Array.from({ length: 1200 }, (_, i) => student(i))
    // Three payments each: 3600 rows, well past one 1000-row page.
    const tolovlar = users.flatMap((u, i) => [0, 1, 2].map((m) => ({
      id: `${i}-${m}`, student_id: u.id, month: String(m + 1), year: 2026, amount: 500000,
      status: 'approved', admin_message: null, receipt_url: null,
      created_at: new Date(Date.UTC(2026, m, 1, 0, 0, i % 60)).toISOString(),
    })))
    state.tables = { users, tolovlar }
  })

  it('lists every student id past the 1000-row page', async () => {
    const ids = await createFacultyStudentsRepository().listFacultyStudentIds('AMIT')
    expect(ids).toHaveLength(1200)
  })

  it('keeps each id filter small and returns every payment, newest first', async () => {
    const repo = createFacultyStudentsRepository()
    const ids = await repo.listFacultyStudentIds('amit')
    const rows = await repo.listPayments(ids)

    expect(Math.max(...state.inSizes)).toBeLessThanOrEqual(100)
    expect(rows).toHaveLength(3600)
    const times = rows.map((r) => Date.parse(String(r.created_at)))
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })
})
