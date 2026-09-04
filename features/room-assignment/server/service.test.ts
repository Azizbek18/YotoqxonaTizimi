import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'
import type { RoomAssignmentRepository } from './repository'

const getSettings = vi.fn(async () => ({ defaultRoomCapacity: 4 }))
vi.mock('@/features/app-settings/server/service', () => ({
  createAppSettingsService: () => ({ get: getSettings }),
}))

const sendRoomAssignedEmail = vi.fn(async () => {})
vi.mock('@/lib/email', () => ({ sendRoomAssignedEmail }))

const deliverPermitDocumentsSafely = vi.fn(async () => 'delivered' as const)
vi.mock('@/lib/permit-documents', () => ({ deliverPermitDocumentsSafely }))

const { createRoomAssignmentService } = await import('./service')

function student(overrides: Partial<{ id: string; faculty: string; gender: string | null; room_number: string | null; role: string; email: string; full_name: string; passport_series: string | null; jshshir: string | null }> = {}) {
  return {
    id: 'student-1',
    faculty: 'IT',
    gender: 'male',
    room_number: null,
    role: 'talaba',
    email: 'student@example.com',
    full_name: 'Talaba Ism',
    passport_series: 'AA1234567',
    jshshir: '12345678901234',
    ...overrides,
  }
}

function permit(overrides: Partial<{ id: string; faculty: string; gender: string; room_number: string | null; status: string; full_name: string }> = {}) {
  return {
    id: 'permit-1',
    faculty: 'IT',
    gender: 'female',
    room_number: null,
    status: 'approved',
    full_name: "Yo'llanma Ism",
    ...overrides,
  }
}

function rosterRow(overrides: Partial<{ id: string; full_name: string; gender: string; room_number: string | null; course: number; direction: string }> = {}) {
  return {
    id: 'roster-1',
    full_name: 'Roster Ism',
    gender: 'male',
    room_number: null,
    course: 1,
    direction: 'CS',
    ...overrides,
  }
}

function repository(overrides: Partial<RoomAssignmentRepository> = {}) {
  return {
    listFacultyStudents: vi.fn(async () => []),
    findStudent: vi.fn(async () => student()),
    clearStudentRoom: vi.fn(async () => {}),
    assignRoomAtomic: vi.fn(async () => true),
    listApprovedUnregisteredPermits: vi.fn(async () => []),
    findPermit: vi.fn(async () => permit()),
    findApprovedPermitIdForStudent: vi.fn(async () => null),
    clearPermitRoom: vi.fn(async () => {}),
    assignPermitRoomAtomic: vi.fn(async () => true),
    ...overrides,
  } as unknown as RoomAssignmentRepository
}

describe('room assignment service', () => {
  beforeEach(() => vi.clearAllMocks())

  // A room that's already ta'mirlash-frozen still exists in the layout, so
  // assign_student_room_atomic reports it with its own error code (P0004)
  // rather than the generic "room doesn't exist"/"full" ones — the message
  // shown to the dekan has to say *why*, not just that it failed.
  it('reports a frozen room distinctly from "full" or "not found"', async () => {
    const repo = repository({
      assignRoomAtomic: vi.fn(async () => {
        throw Object.assign(new Error('frozen'), { code: 'P0004' })
      }),
    })

    await expect(createRoomAssignmentService(repo).assignRoom('IT', { studentId: 'student-1', roomNumber: '101' }))
      .rejects.toMatchObject({ status: 409 })
    expect(sendRoomAssignedEmail).not.toHaveBeenCalled()
  })

  it('reports a room missing from the layout as 404', async () => {
    const repo = repository({
      assignRoomAtomic: vi.fn(async () => {
        throw Object.assign(new Error('missing'), { code: 'P0002' })
      }),
    })

    await expect(createRoomAssignmentService(repo).assignRoom('IT', { studentId: 'student-1', roomNumber: '999' }))
      .rejects.toMatchObject({ status: 404 })
  })

  it('assigns the student and emails them once the room accepts', async () => {
    const repo = repository()
    const result = await createRoomAssignmentService(repo).assignRoom('IT', { studentId: 'student-1', roomNumber: '101' })

    expect(result).toEqual({ success: true })
    expect(repo.assignRoomAtomic).toHaveBeenCalledWith('student-1', '101', 4)
    expect(sendRoomAssignedEmail).toHaveBeenCalledWith('student@example.com', 'Talaba Ism', '101')
  })

  it('rejects a student from another faculty', async () => {
    const repo = repository({ findStudent: vi.fn(async () => student({ faculty: 'Filologiya' })) })

    await expect(createRoomAssignmentService(repo).assignRoom('IT', { studentId: 'student-1', roomNumber: '101' }))
      .rejects.toBeInstanceOf(ApiError)
  })

  describe('listStudents', () => {
    // The roomless queue a dekan assigns from has to include people who
    // were approved but haven't self-registered yet — otherwise a newly
    // approved yo'llanma is a dead end until that person happens to log in.
    it('merges roomless active students with approved-unregistered permits', async () => {
      const repo = repository({
        listFacultyStudents: vi.fn(async () => [rosterRow({ id: 'student-2', full_name: 'Ali' })]),
        listApprovedUnregisteredPermits: vi.fn(async () => [rosterRow({ id: 'permit-2', full_name: 'Vali' })]),
      })

      const result = await createRoomAssignmentService(repo).listStudents('IT')

      expect(result).toEqual([
        expect.objectContaining({ full_name: 'Ali', source: 'user' }),
        expect.objectContaining({ full_name: 'Vali', source: 'permit' }),
      ])
    })
  })

  describe('assignRoom with source: permit', () => {
    it("reserves a room on an approved permit without sending an email (nobody's registered yet)", async () => {
      const repo = repository()
      const result = await createRoomAssignmentService(repo)
        .assignRoom('IT', { studentId: 'permit-1', roomNumber: '101', source: 'permit' }, { id: 'dekan-1', fullName: 'Dekan' })

      expect(result).toEqual({ success: true, documentDelivery: 'delivered' })
      expect(repo.assignPermitRoomAtomic).toHaveBeenCalledWith('permit-1', '101', 4)
      expect(sendRoomAssignedEmail).not.toHaveBeenCalled()
      // The signed Ariza + Tilxat is generated + sent now that the room exists.
      expect(deliverPermitDocumentsSafely).toHaveBeenCalledWith('permit-1', { id: 'dekan-1', fullName: 'Dekan' })
    })

    it('a document-delivery failure does not fail the room assignment', async () => {
      deliverPermitDocumentsSafely.mockResolvedValueOnce('error' as never)
      const repo = repository()
      const result = await createRoomAssignmentService(repo)
        .assignRoom('IT', { studentId: 'permit-1', roomNumber: '101', source: 'permit' })

      expect(result).toEqual({ success: true, documentDelivery: 'error' })
      expect(repo.assignPermitRoomAtomic).toHaveBeenCalled()
    })

    it('rejects a permit that is not approved', async () => {
      const repo = repository({ findPermit: vi.fn(async () => permit({ status: 'pending' })) })

      await expect(createRoomAssignmentService(repo).assignRoom('IT', { studentId: 'permit-1', roomNumber: '101', source: 'permit' }))
        .rejects.toMatchObject({ status: 409 })
      expect(repo.assignPermitRoomAtomic).not.toHaveBeenCalled()
    })

    it('rejects a permit from another faculty', async () => {
      const repo = repository({ findPermit: vi.fn(async () => permit({ faculty: 'Filologiya' })) })

      await expect(createRoomAssignmentService(repo).assignRoom('IT', { studentId: 'permit-1', roomNumber: '101', source: 'permit' }))
        .rejects.toBeInstanceOf(ApiError)
    })

    it('clears a permit\'s reserved room when roomNumber is empty', async () => {
      const repo = repository({ findPermit: vi.fn(async () => permit({ room_number: '101' })) })

      const result = await createRoomAssignmentService(repo)
        .assignRoom('IT', { studentId: 'permit-1', roomNumber: '', source: 'permit' })

      expect(result).toEqual({ success: true })
      expect(repo.clearPermitRoom).toHaveBeenCalledWith('permit-1')
      expect(repo.assignPermitRoomAtomic).not.toHaveBeenCalled()
    })

    it('reports a frozen room the same way as the user-assignment path', async () => {
      const repo = repository({
        assignPermitRoomAtomic: vi.fn(async () => {
          throw Object.assign(new Error('frozen'), { code: 'P0004' })
        }),
      })

      await expect(createRoomAssignmentService(repo).assignRoom('IT', { studentId: 'permit-1', roomNumber: '101', source: 'permit' }))
        .rejects.toMatchObject({ status: 409 })
    })
  })

  // A faculty with a second building (many-to-many, 202609300000 +
  // 202609300003 dormId-override RPCs) — the dekan picks which building the
  // room belongs to. Every test above (which never passes a dormId) proves
  // the omitted case forwards nothing extra to the repository.
  describe('a specific building (dormId)', () => {
    it('forwards dormId to assignRoomAtomic when given', async () => {
      const repo = repository()
      await createRoomAssignmentService(repo).assignRoom('IT', { studentId: 'student-1', roomNumber: '101', dormId: 'd2' })
      expect(repo.assignRoomAtomic).toHaveBeenCalledWith('student-1', '101', 4, 'd2')
    })

    it('forwards dormId to assignPermitRoomAtomic when given', async () => {
      const repo = repository()
      await createRoomAssignmentService(repo)
        .assignRoom('IT', { studentId: 'permit-1', roomNumber: '101', source: 'permit', dormId: 'd2' })
      expect(repo.assignPermitRoomAtomic).toHaveBeenCalledWith('permit-1', '101', 4, 'd2')
    })

    it('ignores a non-string dormId rather than forwarding garbage', async () => {
      const repo = repository()
      await createRoomAssignmentService(repo).assignRoom('IT', { studentId: 'student-1', roomNumber: '101', dormId: 42 })
      expect(repo.assignRoomAtomic).toHaveBeenCalledWith('student-1', '101', 4)
    })
  })
})
