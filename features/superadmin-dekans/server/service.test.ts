import { describe, expect, it, vi } from 'vitest'
import { createSuperadminDekanService } from './service'
import type { SuperadminDekanRepository } from './repository'

function repository(data: Record<string, unknown>): SuperadminDekanRepository {
  return { loadAll: vi.fn(async () => data) } as unknown as SuperadminDekanRepository
}

describe('superadmin dekan overview', () => {
  it('is global even when the superadmin account itself belongs to one faculty', async () => {
    const result = await createSuperadminDekanService(repository({
      dekans: [
        { id: 'd1', full_name: 'AMIT Dekani', email: 'a@example.com', phone_number: null, faculty: 'amit', status: 'active', created_at: '2026-01-01' },
        { id: 'd2', full_name: 'Biologiya Dekani', email: 'b@example.com', phone_number: '+998', faculty: 'biologiya', status: 'active', created_at: '2026-02-01' },
      ],
      educators: [
        { faculty: 'amit', status: 'active' },
        { faculty: 'biologiya', status: 'inactive' },
      ],
      students: [
        { faculty: 'amit', status: 'active', room_number: '101' },
        { faculty: 'biologiya', status: 'pending', room_number: null },
      ],
      permits: [
        { faculty: 'biologiya', status: 'pending', room_number: null },
        { faculty: 'amit', status: 'approved', room_number: '2' },
      ],
      facultyDorms: [{ faculty: 'biologiya', dorm_id: 'dorm-2' }, { faculty: 'amit', dorm_id: 'dorm-1' }],
      dorms: [
        { id: 'dorm-2', number: '2', name: 'Ikkinchi TTJ', default_room_capacity: 4 },
        { id: 'dorm-1', number: '1', name: 'Birinchi TTJ', default_room_capacity: 4 },
      ],
      rooms: [
        // amit: room 1 (default 4, empty), room 2 (cap 3, holds the approved permit) -> free 4 + 2 = 6, available 7
        { faculty: 'amit', room_number: '1', frozen: false, capacity: null },
        { faculty: 'amit', room_number: '2', frozen: false, capacity: 3 },
        // biologiya: one frozen room -> contributes nothing
        { faculty: 'biologiya', room_number: '10', frozen: true, capacity: null },
      ],
    })).getOverview()

    expect(result.summary.activeDekans).toBe(2)
    expect(result.summary.coveredFaculties).toBe(2)
    expect(result.summary.totalFaculties).toBeGreaterThan(2)
    expect(result.summary.facultiesWithBuilding).toBe(2)
    expect(result.summary.freeBeds).toBe(6)
    expect(result.summary.availableBeds).toBe(7)
    expect(result.faculties.find((row) => row.faculty === 'amit')?.dekan?.fullName).toBe('AMIT Dekani')
    expect(result.faculties.find((row) => row.faculty === 'amit')?.stats).toMatchObject({ freeBeds: 6, availableBeds: 7 })
    expect(result.faculties.find((row) => row.faculty === 'biologiya')).toMatchObject({
      dekan: { fullName: 'Biologiya Dekani' },
      stats: { students: 1, activeStudents: 0, placedStudents: 0, activeEducators: 0, pendingPermits: 1, freeBeds: 0, availableBeds: 0 },
      dorm: { id: 'dorm-2', number: '2', name: 'Ikkinchi TTJ' },
    })
  })

  it('reports inactive and faculty-less dekan accounts without treating them as coverage', async () => {
    const result = await createSuperadminDekanService(repository({
      dekans: [
        { id: 'd1', full_name: 'Nofaol', email: 'a@example.com', phone_number: null, faculty: 'amit', status: 'inactive', created_at: '2026-01-01' },
        { id: 'd2', full_name: 'Biriktirilmagan', email: 'b@example.com', phone_number: null, faculty: null, status: 'active', created_at: '2026-02-01' },
      ],
      educators: [], students: [], permits: [], facultyDorms: [], dorms: [], rooms: [],
    })).getOverview()

    expect(result.summary.activeDekans).toBe(1)
    expect(result.summary.inactiveDekans).toBe(1)
    expect(result.summary.coveredFaculties).toBe(0)
    expect(result.unassignedDekans).toHaveLength(1)
  })
})

function lifecycleRepository(overrides: Partial<SuperadminDekanRepository> = {}) {
  return {
    loadAll: vi.fn(),
    getDekan: vi.fn(async () => ({ id: 'd1', full_name: 'Dekan', email: 'd@x.uz', faculty: 'amit', status: 'active' })),
    activeDekanFor: vi.fn(async () => null),
    updateDekan: vi.fn(async (id: string, patch: Record<string, unknown>) => ({ id, faculty: 'amit', status: 'active', ...patch })),
    ...overrides,
  } as unknown as SuperadminDekanRepository
}

describe('dean lifecycle', () => {
  it('deactivates a dean', async () => {
    const repo = lifecycleRepository()
    await createSuperadminDekanService(repo).setDekanStatus('d1', 'inactive')
    expect(repo.updateDekan).toHaveBeenCalledWith('d1', { status: 'inactive' })
  })

  it('refuses to activate a dean whose faculty already has an active one', async () => {
    const repo = lifecycleRepository({
      getDekan: vi.fn(async () => ({ id: 'd1', full_name: 'Dekan', email: 'd@x.uz', faculty: 'amit', status: 'inactive' })),
      activeDekanFor: vi.fn(async () => ({ id: 'd2', full_name: 'Boshqa Dekan' })),
    })
    await expect(createSuperadminDekanService(repo).setDekanStatus('d1', 'active')).rejects.toMatchObject({ status: 409 })
    expect(repo.updateDekan).not.toHaveBeenCalled()
  })

  it('refuses to activate a faculty-less dean', async () => {
    const repo = lifecycleRepository({
      getDekan: vi.fn(async () => ({ id: 'd1', full_name: 'Dekan', email: 'd@x.uz', faculty: null, status: 'inactive' })),
    })
    await expect(createSuperadminDekanService(repo).setDekanStatus('d1', 'active')).rejects.toMatchObject({ status: 400 })
  })

  it('rejects an unknown status', async () => {
    await expect(createSuperadminDekanService(lifecycleRepository()).setDekanStatus('d1', 'archived')).rejects.toMatchObject({ status: 400 })
  })

  it('reassigns an inactive dean without a coverage check', async () => {
    const repo = lifecycleRepository({
      getDekan: vi.fn(async () => ({ id: 'd1', full_name: 'Dekan', email: 'd@x.uz', faculty: 'amit', status: 'inactive' })),
    })
    await createSuperadminDekanService(repo).reassignDekan('d1', 'Fizika')
    expect(repo.activeDekanFor).not.toHaveBeenCalled()
    expect(repo.updateDekan).toHaveBeenCalledWith('d1', { faculty: 'fizika' })
  })

  it('refuses to move an active dean onto a covered faculty', async () => {
    const repo = lifecycleRepository({ activeDekanFor: vi.fn(async () => ({ id: 'd2', full_name: 'Fizika Dekani' })) })
    await expect(createSuperadminDekanService(repo).reassignDekan('d1', 'fizika')).rejects.toMatchObject({ status: 409 })
  })

  it('treats a same-faculty reassign as a no-op', async () => {
    const repo = lifecycleRepository()
    await createSuperadminDekanService(repo).reassignDekan('d1', 'amit')
    expect(repo.updateDekan).not.toHaveBeenCalled()
  })
})
