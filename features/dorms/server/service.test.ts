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
    createDormShell: vi.fn(async () => 'd-new'),
    getDormLayout: vi.fn(async () => ({ layoutKind: 'blocked' as const, blockCount: 2, floorCount: 12 })),
    listSections: vi.fn(async () => []),
    sectionResidentCounts: vi.fn(async () => new Map<string, number>()),
    buildBlockedLayout: vi.fn(async () => ({ created: 216, blocks: 2, floors: 12, rooms_per_section: 9 })),
    assignSection: vi.fn(async () => ({ block: 'A', floor: 3, faculty: 'tarix' })),
    clearSection: vi.fn(async () => ({ block: 'A', floor: 3, cleared: true })),
    dekanBlockedSections: vi.fn(async () => []),
    blockedDormRooms: vi.fn(async () => []),
    blockedDormOccupants: vi.fn(async () => ({ users: [], permits: [] })),
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

describe('createDormService — blocked-layout dorm sections', () => {
  it('blockedGrid returns every A/B × floor cell, assigned or not', async () => {
    const repo = fakeRepo({
      getDormLayout: vi.fn(async () => ({ layoutKind: 'blocked' as const, blockCount: 2, floorCount: 12 })),
      listSections: vi.fn(async () => [
        { block: 'A', floor_number: 1, faculty: 'tarix', gender: null },
        { block: 'B', floor_number: 1, faculty: 'amit', gender: 'male' as const },
      ]),
      sectionResidentCounts: vi.fn(async () => new Map([['A-1', 5]])),
    })
    const grid = await createDormService(repo).blockedGrid('d1')
    expect(grid.sections).toHaveLength(24)
    expect(grid.bedsPerSection).toBe(54)
    expect(grid.sections.find((s) => s.block === 'A' && s.floor === 1)).toEqual({
      block: 'A', floor: 1, faculty: 'tarix', gender: null, residentCount: 5,
    })
    expect(grid.sections.find((s) => s.block === 'B' && s.floor === 1)?.gender).toBe('male')
    // an untouched cell
    expect(grid.sections.find((s) => s.block === 'A' && s.floor === 7)).toEqual({
      block: 'A', floor: 7, faculty: null, gender: null, residentCount: 0,
    })
  })

  it('blockedGrid refuses a simple dorm', async () => {
    const repo = fakeRepo({
      getDormLayout: vi.fn(async () => ({ layoutKind: 'simple' as const, blockCount: 1, floorCount: 5 })),
    })
    await expect(createDormService(repo).blockedGrid('d1')).rejects.toMatchObject({ status: 409 })
  })

  it('assignSection normalises the block, validates the faculty and forwards the staff id', async () => {
    const repo = fakeRepo()
    await createDormService(repo).assignSection(
      { dormId: 'd1', block: 'a', floor: 3, faculty: 'tarix' }, 's-admin',
    )
    expect(repo.assignSection).toHaveBeenCalledWith('d1', 'A', 3, 'tarix', 's-admin')
  })

  it('assignSection rejects an unknown faculty', async () => {
    await expect(
      createDormService(fakeRepo()).assignSection({ dormId: 'd1', block: 'A', floor: 3, faculty: 'nope' }, 's'),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('assignSection maps the RPC P0003 (other faculty still resident) to a 409', async () => {
    const repo = fakeRepo({
      assignSection: vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'P0003' }) }),
    })
    await expect(
      createDormService(repo).assignSection({ dormId: 'd1', block: 'A', floor: 3, faculty: 'tarix' }, 's'),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('buildBlockedLayout refuses a simple dorm and passes through the created count otherwise', async () => {
    const simple = fakeRepo({
      getDormLayout: vi.fn(async () => ({ layoutKind: 'simple' as const, blockCount: 1, floorCount: 5 })),
    })
    await expect(createDormService(simple).buildBlockedLayout('d1')).rejects.toMatchObject({ status: 409 })

    const blocked = fakeRepo()
    expect(await createDormService(blocked).buildBlockedLayout('d1')).toEqual({ created: 216 })
  })

  it('create() accepts a blocked building with a block count', async () => {
    const repo = fakeRepo({ findDormByNumber: vi.fn(async () => null) })
    await createDormService(repo).create({ number: '6', floorCount: 12, layoutKind: 'blocked', blockCount: 2 })
    expect(repo.createDormShell).toHaveBeenCalledWith(
      expect.objectContaining({ number: '6', floorCount: 12, layoutKind: 'blocked', blockCount: 2 }),
    )
  })

  it('create() rejects a blocked building with fewer than 2 blocks', async () => {
    const repo = fakeRepo({ findDormByNumber: vi.fn(async () => null) })
    await expect(
      createDormService(repo).create({ number: '6', floorCount: 12, layoutKind: 'blocked', blockCount: 1 }),
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('createDormService.blockedRoomMap', () => {
  const dormMeta = {
    id: 'd7', number: '7', name: 'Blok bino', block_count: 2, floor_count: 12,
    default_room_capacity: 4, layout_kind: 'blocked' as const,
  }

  it('returns [] when the faculty owns no blocked sections', async () => {
    expect(await createDormService(fakeRepo()).blockedRoomMap('amit')).toEqual([])
  })

  it('groups the faculty sections by building and stitches in occupants', async () => {
    const repo = fakeRepo({
      dekanBlockedSections: vi.fn(async () => [
        { dorm_id: 'd7', block: 'A', floor_number: 3, gender: null as 'male' | 'female' | null, dorms: dormMeta },
        { dorm_id: 'd7', block: 'B', floor_number: 3, gender: 'male' as 'male' | 'female' | null, dorms: dormMeta },
      ]),
      blockedDormRooms: vi.fn(async () => [
        { block: 'A', floor_number: 3, room_number: '1', capacity: 4, frozen: false, gender: null as 'male' | 'female' | null },
        { block: 'A', floor_number: 3, room_number: '5', capacity: 8, frozen: true, gender: null as 'male' | 'female' | null },
        { block: 'B', floor_number: 3, room_number: '2', capacity: 6, frozen: false, gender: 'male' as 'male' | 'female' | null },
      ]),
      blockedDormOccupants: vi.fn(async () => ({
        users: [
          { id: 'u1', full_name: 'Ali', gender: 'male', block: 'A', assigned_floor: 3, room_number: '1', passport_series: 'AA1', jshshir: null },
        ],
        permits: [
          // same person as u1 (stale permit) — must not double-count
          { id: 'p1', full_name: 'Ali', gender: 'male', block: 'A', assigned_floor: 3, room_number: '1', passport_series: 'AA1', jshshir: null },
          // a genuine approved-not-registered applicant
          { id: 'p2', full_name: 'Vali', gender: 'male', block: 'B', assigned_floor: 3, room_number: '2', passport_series: 'BB2', jshshir: null },
        ],
      })),
    })

    const [dorm] = await createDormService(repo).blockedRoomMap('tarix')
    expect(dorm.number).toBe('7')
    expect(dorm.sections.map((s) => `${s.block}${s.floor}`)).toEqual(['A3', 'B3'])

    const a1 = dorm.sections[0].rooms.find((r) => r.roomNumber === '1')!
    expect(a1.occupants).toEqual([{ name: 'Ali', gender: 'male', kind: 'user' }]) // deduped

    const a5 = dorm.sections[0].rooms.find((r) => r.roomNumber === '5')!
    expect(a5).toMatchObject({ capacity: 8, frozen: true })

    const b2 = dorm.sections[1].rooms.find((r) => r.roomNumber === '2')!
    expect(b2.occupants).toEqual([{ name: 'Vali', gender: 'male', kind: 'permit' }])
  })
})
