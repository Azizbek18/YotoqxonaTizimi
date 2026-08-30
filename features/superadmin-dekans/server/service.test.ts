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
        { faculty: 'biologiya', status: 'pending' },
        { faculty: 'amit', status: 'approved' },
      ],
      facultyDorms: [{ faculty: 'biologiya', dorm_id: 'dorm-2' }],
      dorms: [{ id: 'dorm-2', number: '2', name: 'Ikkinchi TTJ' }],
    })).getOverview()

    expect(result.summary.activeDekans).toBe(2)
    expect(result.summary.coveredFaculties).toBe(2)
    expect(result.summary.totalFaculties).toBeGreaterThan(2)
    expect(result.faculties.find((row) => row.faculty === 'amit')?.dekan?.fullName).toBe('AMIT Dekani')
    expect(result.faculties.find((row) => row.faculty === 'biologiya')).toMatchObject({
      dekan: { fullName: 'Biologiya Dekani' },
      stats: { students: 1, activeStudents: 0, placedStudents: 0, activeEducators: 0, pendingPermits: 1 },
      dorm: { id: 'dorm-2', number: '2', name: 'Ikkinchi TTJ' },
    })
  })

  it('reports inactive and faculty-less dekan accounts without treating them as coverage', async () => {
    const result = await createSuperadminDekanService(repository({
      dekans: [
        { id: 'd1', full_name: 'Nofaol', email: 'a@example.com', phone_number: null, faculty: 'amit', status: 'inactive', created_at: '2026-01-01' },
        { id: 'd2', full_name: 'Biriktirilmagan', email: 'b@example.com', phone_number: null, faculty: null, status: 'active', created_at: '2026-02-01' },
      ],
      educators: [], students: [], permits: [], facultyDorms: [], dorms: [],
    })).getOverview()

    expect(result.summary.activeDekans).toBe(1)
    expect(result.summary.inactiveDekans).toBe(1)
    expect(result.summary.coveredFaculties).toBe(0)
    expect(result.unassignedDekans).toHaveLength(1)
  })
})
