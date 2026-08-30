import { describe, expect, it, vi } from 'vitest'
import { createDataIntegrityService } from './service'
import type { DataIntegrityRepository } from './repository'

function repository(overrides: Partial<DataIntegrityRepository> = {}) {
  return {
    roomWithoutFloor: vi.fn(async () => ({ rows: [], count: 0 })),
    staleApprovedPermits: vi.fn(async () => ({ rows: [], count: 0 })),
    frozenRooms: vi.fn(async () => []),
    layoutRoomNumbers: vi.fn(async () => []),
    housedStudents: vi.fn(async () => []),
    allStudentFaculties: vi.fn(async () => []),
    pendingPermitFaculties: vi.fn(async () => []),
    activeDeanFaculties: vi.fn(async () => []),
    ...overrides,
  } as unknown as DataIntegrityRepository
}

describe('data integrity report', () => {
  it('reports a clean system as all-zero checks', async () => {
    const report = await createDataIntegrityService(repository()).getReport()
    expect(report.checks.every((c) => c.count === 0)).toBe(true)
    expect(report.checks.map((c) => c.key)).toContain('frozen-with-residents')
  })

  it('flags a resident sitting in a frozen room', async () => {
    const repo = repository({
      frozenRooms: vi.fn(async () => [{ room_number: '101', faculty: 'amit' }]),
      housedStudents: vi.fn(async () => [
        { id: 's1', full_name: 'Ali', faculty: 'amit', room_number: '101' },
        { id: 's2', full_name: 'Vali', faculty: 'amit', room_number: '102' },
      ]),
    })
    const report = await createDataIntegrityService(repo).getReport()
    const check = report.checks.find((c) => c.key === 'frozen-with-residents')!
    expect(check.count).toBe(1)
    expect(check.sample[0].label).toBe('Ali')
  })

  it('flags a pending-permit faculty with no active dean', async () => {
    const repo = repository({
      pendingPermitFaculties: vi.fn(async () => ['Biologiya', 'biologiya', 'amit']),
      activeDeanFaculties: vi.fn(async () => ['amit']),
    })
    const report = await createDataIntegrityService(repo).getReport()
    const check = report.checks.find((c) => c.key === 'stranded-faculties')!
    expect(check.count).toBe(1)
    expect(check.sample[0].id).toBe('biologiya')
  })

  it('flags a student on an unrecognised faculty code', async () => {
    const repo = repository({
      allStudentFaculties: vi.fn(async () => [
        { id: 's1', full_name: 'Ali', faculty: 'amit' },
        { id: 's2', full_name: 'Bek', faculty: 'nonexistent-faculty' },
        { id: 's3', full_name: 'Gulnora', faculty: null },
      ]),
    })
    const report = await createDataIntegrityService(repo).getReport()
    const check = report.checks.find((c) => c.key === 'unknown-faculty')!
    expect(check.count).toBe(2)
  })
})
