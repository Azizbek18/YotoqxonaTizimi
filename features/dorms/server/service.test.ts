import { describe, expect, it, vi } from 'vitest'
import { createDormService } from './service'
import type { DormFloorRow, DormRepository, DormRow } from './repository'

const DORM: DormRow = { id: 'd1', number: '3', name: 'Asosiy bino', floor_count: 5 }

function fakeRepo(overrides: Partial<DormRepository> = {}, floors: DormFloorRow[] = []) {
  return {
    facultyDormId: vi.fn(async () => 'd1'),
    getDorm: vi.fn(async () => DORM),
    findDormByNumber: vi.fn(async () => DORM),
    createDorm: vi.fn(async () => DORM),
    linkFaculty: vi.fn(async () => undefined),
    setStaffDorm: vi.fn(async () => undefined),
    listFloors: vi.fn(async () => floors),
    facultyResidentCount: vi.fn(async () => 0),
    claimFloors: vi.fn(async () => ({ confirmed: [], proposed: [] })),
    resolveFloor: vi.fn(async () => ({ floor: 1, outcome: 'confirmed', faculty: 'sport' })),
    withdrawFloors: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as DormRepository
}

const amit = { id: 's-amit', faculty: 'amit' }
const sport = { id: 's-sport', faculty: 'sport' }

describe('createDormService.getDekanDorm', () => {
  it('returns null when the faculty has no dorm', async () => {
    const repo = fakeRepo({ facultyDormId: vi.fn(async () => null) })
    expect(await createDormService(repo).getDekanDorm(amit)).toBeNull()
  })

  it('labels every floor state relative to the caller', async () => {
    const rows: DormFloorRow[] = [
      { floor_number: 1, faculty: 'amit', pending_faculty: null, pending_at: null },
      { floor_number: 2, faculty: 'amit', pending_faculty: null, pending_at: null },
      { floor_number: 3, faculty: null, pending_faculty: 'sport', pending_at: '2026-08-29T00:00:00Z' },
      { floor_number: 4, faculty: 'sport', pending_faculty: null, pending_at: null },
      // floor 5 has no row -> free
    ]
    const dorm = await createDormService(fakeRepo({}, rows)).getDekanDorm(amit)
    expect(dorm?.floors.map((f) => f.state)).toEqual(['mine', 'mine', 'incoming', 'other', 'free'])
    expect(dorm?.coFaculties).toEqual(['sport'])
    expect(dorm?.incoming).toEqual([{ floor: 3, faculty: 'sport', at: '2026-08-29T00:00:00Z' }])
  })

  it('does not surface an incoming claim to a faculty with no confirmed floor', async () => {
    const rows: DormFloorRow[] = [
      { floor_number: 1, faculty: 'amit', pending_faculty: null, pending_at: null },
      { floor_number: 3, faculty: null, pending_faculty: 'sport', pending_at: 'x' },
    ]
    const dorm = await createDormService(fakeRepo({}, rows)).getDekanDorm(sport)
    // sport proposed floor 3 -> that floor is 'mine_pending', not 'incoming'
    expect(dorm?.floors[2].state).toBe('mine_pending')
    expect(dorm?.incoming).toEqual([])
  })
})

describe('createDormService.setUp', () => {
  it('creates the dorm shell when the number is new, then claims floors', async () => {
    const repo = fakeRepo({ findDormByNumber: vi.fn(async () => null), facultyDormId: vi.fn(async () => null) })
    await createDormService(repo).setUp(amit, { number: ' 7 ', floorCount: 4, roomCapacity: 3, floors: [1, 2] })
    expect(repo.createDorm).toHaveBeenCalledWith({ number: '7', floorCount: 4, roomCapacity: 3 })
    expect(repo.linkFaculty).toHaveBeenCalledWith('amit', 'd1')
    expect(repo.claimFloors).toHaveBeenCalledWith('d1', 'amit', [1, 2], 's-amit')
  })

  it('claims every floor when none are given', async () => {
    const repo = fakeRepo({ facultyDormId: vi.fn(async () => null) })
    await createDormService(repo).setUp(amit, { number: '3', floors: [] })
    expect(repo.claimFloors).toHaveBeenCalledWith('d1', 'amit', [1, 2, 3, 4, 5], 's-amit')
  })

  it('blocks moving to a different dorm while the faculty still has residents', async () => {
    const repo = fakeRepo({
      facultyDormId: vi.fn(async () => 'd-old'),
      facultyResidentCount: vi.fn(async () => 3),
    })
    await expect(createDormService(repo).setUp(amit, { number: '9', floors: [1] })).rejects.toThrow(/superadmin/i)
  })

  it('rejects a bad dorm number', async () => {
    await expect(createDormService(fakeRepo()).setUp(amit, { number: '', floors: [] })).rejects.toThrow()
  })
})

describe('createDormService.resolve', () => {
  it('lets the co-dekan confirm an incoming claim', async () => {
    const rows: DormFloorRow[] = [
      { floor_number: 1, faculty: 'amit', pending_faculty: null, pending_at: null },
      { floor_number: 3, faculty: null, pending_faculty: 'sport', pending_at: 'x' },
    ]
    const repo = fakeRepo({}, rows)
    await createDormService(repo).resolve(amit, 3, true)
    expect(repo.resolveFloor).toHaveBeenCalledWith('d1', 3, 's-amit', true)
  })

  it('refuses when the caller has no confirmed floor in the dorm', async () => {
    const rows: DormFloorRow[] = [
      { floor_number: 3, faculty: null, pending_faculty: 'sport', pending_at: 'x' },
    ]
    await expect(createDormService(fakeRepo({}, rows)).resolve(amit, 3, true)).rejects.toThrow(/tegishli emas/)
  })

  it('refuses when there is no pending claim on that floor', async () => {
    const rows: DormFloorRow[] = [
      { floor_number: 1, faculty: 'amit', pending_faculty: null, pending_at: null },
    ]
    await expect(createDormService(fakeRepo({}, rows)).resolve(amit, 1, true)).rejects.toThrow(/taklif yo/)
  })
})
