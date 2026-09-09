import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({ from: mocks.from }),
}))

import { createRoomLayoutRepository } from './repository'

// A chainable stand-in for a PostgREST query builder: every filter/order
// method returns `this`, the object is awaitable (`{ data, error }`), and
// `.maybeSingle()` resolves to a single row. `rowsFor` picks the payload by
// table name so one mock serves scopeFor's several queries + the main read.
function supabaseReturning(rowsFor: (table: string) => unknown) {
  mocks.from.mockImplementation((table: string) => {
    const result = rowsFor(table)
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'order', 'not']) {
      builder[m] = vi.fn(() => builder)
    }
    builder.maybeSingle = vi.fn(async () => ({ data: result, error: null }))
    builder.then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: Array.isArray(result) ? result : [], error: null })
    return builder
  })
}

const room = (room_number: string, extra: Record<string, unknown> = {}) => ({
  room_number, side: 'left', position: 0, size: 'medium', capacity: null, frozen: false, ...extra,
})

describe('createRoomLayoutRepository.listFloor — shared-building scoping', () => {
  beforeEach(() => vi.clearAllMocks())

  // AMIT holds floor 2 of dorm 3 (ozbek-fil holds the rest). Asking for
  // floor 1 — which AMIT does NOT hold — must come back empty, not with
  // ozbek-fil's layout. This is the /dekan/3d-xonalar leak.
  it('returns nothing for a floor the faculty does not own in a partitioned dorm', async () => {
    supabaseReturning((table) => {
      if (table === 'faculty_dorm') return { dorm_id: 'dorm-3', is_primary: false }
      if (table === 'dorm_floor') return [
        { floor_number: 1, faculty: 'ozbek-filologiyasi' },
        { floor_number: 2, faculty: 'amit' },
        { floor_number: 3, faculty: 'ozbek-filologiyasi' },
      ]
      if (table === 'dorm_room_grant') return []
      if (table === 'floor_room_layout') return [room('1'), room('2'), room('3a')]
      return []
    })

    const rows = await createRoomLayoutRepository().listFloor('amit', 1, 'dorm-3')
    expect(rows).toEqual([])
  })

  it('returns the full layout for a floor the faculty does own', async () => {
    supabaseReturning((table) => {
      if (table === 'faculty_dorm') return { dorm_id: 'dorm-3', is_primary: false }
      if (table === 'dorm_floor') return [
        { floor_number: 1, faculty: 'ozbek-filologiyasi' },
        { floor_number: 2, faculty: 'amit' },
      ]
      if (table === 'dorm_room_grant') return []
      if (table === 'floor_room_layout') return [room('10'), room('11'), room('12')]
      return []
    })

    const rows = await createRoomLayoutRepository().listFloor('amit', 2, 'dorm-3')
    expect(rows.map((r) => r.room_number)).toEqual(['10', '11', '12'])
  })

  it('a guest faculty sees only its granted rooms on an unowned floor', async () => {
    supabaseReturning((table) => {
      if (table === 'faculty_dorm') return { dorm_id: 'dorm-3', is_primary: false }
      if (table === 'dorm_floor') return [
        { floor_number: 2, faculty: 'ozbek-filologiyasi' },
      ]
      if (table === 'dorm_room_grant') return [{ room_number: '11', faculty: 'amit' }]
      if (table === 'floor_room_layout') return [room('10'), room('11'), room('12')]
      return []
    })

    const rows = await createRoomLayoutRepository().listFloor('amit', 2, 'dorm-3')
    expect(rows.map((r) => r.room_number)).toEqual(['11'])
  })

  it('the sole faculty of an unpartitioned dorm is unaffected (sees the whole floor)', async () => {
    supabaseReturning((table) => {
      if (table === 'faculty_dorm') return { dorm_id: 'dorm-1', is_primary: true }
      if (table === 'dorm_floor') return []
      if (table === 'dorm_room_grant') return []
      if (table === 'floor_room_layout') return [room('101'), room('102')]
      return []
    })

    const rows = await createRoomLayoutRepository().listFloor('amit', 1, 'dorm-1')
    expect(rows.map((r) => r.room_number)).toEqual(['101', '102'])
  })

  it('the owner of a partitioned dorm still loses a room granted away', async () => {
    supabaseReturning((table) => {
      if (table === 'faculty_dorm') return { dorm_id: 'dorm-3', is_primary: true }
      if (table === 'dorm_floor') return [{ floor_number: 2, faculty: 'ozbek-filologiyasi' }]
      if (table === 'dorm_room_grant') return [{ room_number: '11', faculty: 'amit' }]
      if (table === 'floor_room_layout') return [room('10'), room('11'), room('12')]
      return []
    })

    const rows = await createRoomLayoutRepository().listFloor('ozbek-filologiyasi', 2, 'dorm-3')
    expect(rows.map((r) => r.room_number)).toEqual(['10', '12'])
  })
})
