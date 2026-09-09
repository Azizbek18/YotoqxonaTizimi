import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({
    from: () => {
      const filters: ((r: Record<string, unknown>) => boolean)[] = []
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters.push(r => r[key] === value); return query },
        neq: (key: string, value: unknown) => { filters.push(r => r[key] !== value); return query },
        is: (key: string, value: unknown) => { filters.push(r => r[key] === value); return query },
        order: () => query,
        maybeSingle: async () => ({ data: state.rows.filter(r => filters.every(f => f(r)))[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: state.rows.filter(r => filters.every(f => f(r))), error: null }).then(resolve),
      }
      return query
    },
  }),
}))
import { createProfileRepository } from './repository'

const scope = { faculty: 'fizika', dorm_id: 'dorm-2', block: 'A', assigned_floor: 2 }
const resident = { ...scope, room_number: '12', role: 'talaba', status: 'active', gender: 'male', is_floor_captain: true }

describe('student housing isolation', () => {
  beforeEach(() => {
    state.rows = [
      { ...resident, id: 'self' },
      { ...resident, id: 'roommate' },
      { ...resident, id: 'other-faculty', faculty: 'amit' },
      { ...resident, id: 'other-dorm', dorm_id: 'dorm-1' },
      { ...resident, id: 'other-block', block: 'B' },
      { ...resident, id: 'other-floor', assigned_floor: 3 },
      { ...resident, id: 'inactive', status: 'pending' },
    ]
  })

  it('only returns active roommates in the same faculty, dorm, block and floor', async () => {
    const rows = await createProfileRepository().listRoommates('self', '12', scope)
    expect(rows.map(r => r.id)).toEqual(['roommate'])
  })

  it('does not guess a building or faculty for incomplete assignments', async () => {
    const repo = createProfileRepository()
    expect(await repo.listRoommates('self', '12', { ...scope, dorm_id: null })).toEqual([])
    expect(await repo.listRoommates('self', '12', { ...scope, faculty: null })).toEqual([])
    expect(await repo.listRoommates('self', '12', { ...scope, assigned_floor: null })).toEqual([])
  })

  it('does not expose a captain from another faculty, dorm or block', async () => {
    state.rows = state.rows.filter(r => ['other-faculty', 'other-dorm', 'other-block', 'other-floor'].includes(String(r.id)))
    expect(await createProfileRepository().findFloorCaptain(2, 'male', scope)).toBeNull()
  })
})
