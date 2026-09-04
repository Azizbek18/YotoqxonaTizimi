import { describe, expect, it, vi } from 'vitest'
import { createDormService } from './service'
import type { DormDetailRow, DormFloorRow, DormRepository } from './repository'

const DORM: DormDetailRow = {
  id: 'd1', number: '3', name: 'Asosiy bino', floor_count: 5,
  latitude: null, longitude: null, checkin_radius_m: 1000,
  attendance_enabled: false, attendance_open_time: '21:00:00', attendance_close_time: '23:00:00',
}

function fakeRepo(overrides: Partial<DormRepository> = {}, floors: DormFloorRow[] = []) {
  return {
    facultyDormId: vi.fn(async () => 'd1'),
    facultyDormIds: vi.fn(async () => ['d1']),
    getDorm: vi.fn(async () => DORM),
    findDormByNumber: vi.fn(async () => DORM),
    createDorm: vi.fn(async () => DORM),
    linkFaculty: vi.fn(async () => undefined),
    unlinkFaculty: vi.fn(async () => undefined),
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

  it('drops the old link when a resident-free faculty moves buildings', async () => {
    const repo = fakeRepo({
      facultyDormId: vi.fn(async () => 'd-old'),
      facultyResidentCount: vi.fn(async () => 0),
    })
    await createDormService(repo).setUp(amit, { number: '9', floors: [1] })
    expect(repo.withdrawFloors).toHaveBeenCalledWith('d-old', 'amit', [])
    expect(repo.unlinkFaculty).toHaveBeenCalledWith('amit', 'd-old')
    expect(repo.linkFaculty).toHaveBeenCalledWith('amit', 'd1')
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

// A faculty with a second building (202609300000 many-to-many + the
// 202609300001 RPC fix) — the `additional` setup path, multi-dorm listing,
// and switching/unlinking. All of this is additive; every test above must
// keep passing unchanged (single-dorm faculties never hit these branches).
describe('createDormService — a faculty with more than one building', () => {
  it('setUp({additional:true}) links a second building WITHOUT touching the first', async () => {
    const repo = fakeRepo({
      facultyDormId: vi.fn(async () => 'd1'), // already has a primary
      findDormByNumber: vi.fn(async () => ({ id: 'd2', number: '9', name: '', floor_count: 5 })),
    })
    await createDormService(repo).setUp(amit, { number: '9', floors: [1], additional: true })
    expect(repo.linkFaculty).toHaveBeenCalledWith('amit', 'd2', { primary: false })
    expect(repo.unlinkFaculty).not.toHaveBeenCalled()
    expect(repo.withdrawFloors).not.toHaveBeenCalled()
    // additional never repoints the dekan's own "current building" pointer
    expect(repo.setStaffDorm).not.toHaveBeenCalled()
  })

  it('setUp({additional:true}) links as PRIMARY when it is the faculty\'s first dorm', async () => {
    const repo = fakeRepo({
      facultyDormId: vi.fn(async () => null),
      findDormByNumber: vi.fn(async () => ({ id: 'd1', number: '3', name: '', floor_count: 5 })),
    })
    await createDormService(repo).setUp(amit, { number: '3', floors: [], additional: true })
    expect(repo.linkFaculty).toHaveBeenCalledWith('amit', 'd1', { primary: true })
  })

  it('listDekanDorms returns every linked building, primary-first, tagged isPrimary', async () => {
    const repo = fakeRepo({
      facultyDormIds: vi.fn(async () => ['d1', 'd2']),
      facultyDormId: vi.fn(async () => 'd1'),
      getDorm: vi.fn(async (id: string) =>
        id === 'd1' ? DORM : { ...DORM, id: 'd2', number: '9' },
      ),
    })
    const dorms = await createDormService(repo).listDekanDorms(amit)
    expect(dorms.map((d) => [d.dormId, d.isPrimary])).toEqual([
      ['d1', true],
      ['d2', false],
    ])
  })

  it('resolve/withdraw/patchOwnDorm reject a dormId the faculty does not hold', async () => {
    const repo = fakeRepo({ facultyDormIds: vi.fn(async () => ['d1']) })
    const service = createDormService(repo)
    await expect(service.resolve(amit, 1, true, 'not-mine')).rejects.toThrow(/tegishli emas/)
    await expect(service.withdraw(amit, [1], 'not-mine')).rejects.toThrow(/tegishli emas/)
    await expect(service.patchOwnDorm(amit, {}, 'not-mine')).rejects.toThrow(/tegishli emas/)
  })

  it('setPrimary promotes a held building via the demote-then-promote RPC path', async () => {
    const repo = fakeRepo({
      facultyDormIds: vi.fn(async () => ['d1', 'd2']),
      facultyDormId: vi.fn(async () => 'd1'),
      getDorm: vi.fn(async (id: string) => ({ ...DORM, id, number: id })),
    })
    await createDormService(repo).setPrimary(amit, 'd2')
    expect(repo.linkFaculty).toHaveBeenCalledWith('amit', 'd2', { primary: true })
  })

  it('unlinkDorm refuses the faculty\'s only building', async () => {
    const repo = fakeRepo({ facultyDormIds: vi.fn(async () => ['d1']) })
    await expect(createDormService(repo).unlinkDorm(amit, 'd1')).rejects.toThrow(/yagona/)
  })

  it('unlinkDorm refuses the primary building', async () => {
    const repo = fakeRepo({ facultyDormIds: vi.fn(async () => ['d1', 'd2']), facultyDormId: vi.fn(async () => 'd1') })
    await expect(createDormService(repo).unlinkDorm(amit, 'd1')).rejects.toThrow(/Asosiy/)
  })

  it('unlinkDorm refuses a building that still has residents', async () => {
    const repo = fakeRepo({
      facultyDormIds: vi.fn(async () => ['d1', 'd2']),
      facultyDormId: vi.fn(async () => 'd1'),
      facultyResidentCount: vi.fn(async () => 2),
    })
    await expect(createDormService(repo).unlinkDorm(amit, 'd2')).rejects.toThrow(/talabalar bor/)
    expect(repo.facultyResidentCount).toHaveBeenCalledWith('amit', 'd2')
  })

  it('unlinkDorm drops a clear, non-primary, non-last building', async () => {
    const repo = fakeRepo({
      facultyDormIds: vi.fn(async () => ['d1', 'd2']),
      facultyDormId: vi.fn(async () => 'd1'),
      facultyResidentCount: vi.fn(async () => 0),
      getDorm: vi.fn(async (id: string) => ({ ...DORM, id, number: id })),
    })
    await createDormService(repo).unlinkDorm(amit, 'd2')
    expect(repo.withdrawFloors).toHaveBeenCalledWith('d2', 'amit', [])
    expect(repo.unlinkFaculty).toHaveBeenCalledWith('amit', 'd2')
  })
})
