import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  queries: [] as { table: string; filters: Record<string, unknown> }[],
  legacy: false,
}))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({ from: (table: string) => {
    const filters: Record<string, unknown> = {}
    state.queries.push({ table, filters })
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query },
      maybeSingle: async () => {
        if (state.legacy && table === 'faculty_dorm') return { data: null, error: new Error('table missing') }
        if (table === 'faculty_dorm' && filters.faculty === 'amit') return { data: { dorm_id: 'amit-dorm' }, error: null }
        if (table === 'app_settings' && filters.faculty === 'amit') return { data: { floor_count: 5, tarbiyachi_name: 'AMIT educator', monthly_fee: 999999 }, error: null }
        if (table === 'dorms') return { data: { tarbiyachi_name: 'AMIT educator' }, error: null }
        return { data: null, error: null }
      },
    }
    return query
  } }),
}))
import { createAppSettingsRepository } from './repository'
import { createRoomLayoutRepository } from '@/features/room-layout/server/repository'

beforeEach(() => { state.queries = []; state.legacy = false })

it('does not borrow contacts, fees or rooms when a faculty has no dorm', async () => {
  const settings = await createAppSettingsRepository().get('fizika')
  expect(settings.tarbiyachiName).toBe('')
  expect(settings.monthlyFee).not.toBe(999999)
  expect(await createRoomLayoutRepository().listAllRooms('fizika')).toEqual([])
  expect(state.queries.some(q => q.filters.faculty === 'amit' || q.table === 'dorms')).toBe(false)
})

it('legacy fallback never queries another faculty', async () => {
  state.legacy = true
  const settings = await createAppSettingsRepository().get('fizika')
  expect(settings.tarbiyachiName).toBe('')
  expect(state.queries.every(q => q.filters.faculty === 'fizika')).toBe(true)
})

it('rejects an explicitly foreign dorm instead of hiding the authorization error', async () => {
  await expect(createAppSettingsRepository().get('fizika', 'amit-dorm')).rejects.toMatchObject({ status: 403 })
})
