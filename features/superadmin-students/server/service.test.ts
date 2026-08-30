import { beforeEach, describe, expect, it, vi } from 'vitest'

const writeAuditLog = vi.fn(async () => {})
vi.mock('@/lib/audit-log', () => ({ writeAuditLog }))
const sendStudentBlacklistEmail = vi.fn(async () => {})
vi.mock('@/lib/email', () => ({ sendStudentBlacklistEmail }))

const { createSuperadminStudentsService, parseStudentsQuery } = await import('./service')
import type { SuperadminStudentsRepository } from './repository'

function repository(overrides: Partial<SuperadminStudentsRepository> = {}) {
  return {
    list: vi.fn(async () => ({ rows: [], total: 0 })),
    facultyTallies: vi.fn(async () => new Map<string, number>()),
    findStudent: vi.fn(async () => ({
      id: 's1', full_name: 'Ali Valiyev', email: 'ali@x.uz', faculty: 'biologiya',
      role: 'talaba', status: 'active', blacklisted: false, room_number: '101',
    })),
    updateStudent: vi.fn(async (id: string, patch: Record<string, unknown>) => ({ id, ...patch })),
    ...overrides,
  } as unknown as SuperadminStudentsRepository
}

beforeEach(() => vi.clearAllMocks())

describe('parseStudentsQuery', () => {
  it('clamps limit, whitelists faculty, parses the boolean', () => {
    const q = parseStudentsQuery(new URLSearchParams('limit=9000&faculty=NONSENSE&blacklisted=true'))
    expect(q.limit).toBe(100)
    expect(q.faculty).toBeUndefined()
    expect(q.blacklisted).toBe(true)
  })

  it('keeps a known faculty code', () => {
    expect(parseStudentsQuery(new URLSearchParams('faculty=Fizika')).faculty).toBe('fizika')
  })
})

describe('moveFaculty', () => {
  it('vacates the bed and audits the move', async () => {
    const repo = repository()
    const res = await createSuperadminStudentsService(repo).moveFaculty('s1', 'fizika', 'sa-1')
    expect(res.ok).toBe(true)
    expect(repo.updateStudent).toHaveBeenCalledWith('s1', expect.objectContaining({
      faculty: 'fizika', dorm_id: null, room_number: null, assigned_floor: null, is_floor_captain: false,
    }))
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'student.faculty_move', details: expect.objectContaining({ from: 'biologiya', to: 'fizika', roomVacated: true }),
    }))
  })

  it('rejects an unknown target faculty', async () => {
    await expect(createSuperadminStudentsService(repository()).moveFaculty('s1', 'atlantis', 'sa-1'))
      .rejects.toMatchObject({ status: 400 })
  })

  it('is a no-op when already on that faculty', async () => {
    const repo = repository()
    await createSuperadminStudentsService(repo).moveFaculty('s1', 'Biologiya', 'sa-1')
    expect(repo.updateStudent).not.toHaveBeenCalled()
  })
})

describe('setBlacklist', () => {
  it('requires a reason to bar, frees the bed, emails and audits', async () => {
    const repo = repository()
    await expect(createSuperadminStudentsService(repo).setBlacklist('s1', true, 'no', 'sa-1'))
      .rejects.toMatchObject({ status: 400 })

    await createSuperadminStudentsService(repo).setBlacklist('s1', true, 'Qoidabuzarlik', 'sa-1')
    expect(repo.updateStudent).toHaveBeenCalledWith('s1', expect.objectContaining({ blacklisted: true, room_number: null }))
    expect(sendStudentBlacklistEmail).toHaveBeenCalledWith('ali@x.uz', 'Ali Valiyev', true, 'Qoidabuzarlik')
  })

  it('no reason needed to un-bar', async () => {
    const repo = repository({
      findStudent: vi.fn(async () => ({ id: 's1', full_name: 'Ali', email: 'a@x.uz', faculty: 'amit', role: 'talaba', status: 'active', blacklisted: true, room_number: null })),
    })
    const res = await createSuperadminStudentsService(repo).setBlacklist('s1', false, undefined, 'sa-1')
    expect(res.ok).toBe(true)
    expect(repo.updateStudent).toHaveBeenCalledWith('s1', { blacklisted: false })
  })
})

describe('expel', () => {
  it('deactivates, vacates, optionally blacklists, emails and audits', async () => {
    const repo = repository()
    await createSuperadminStudentsService(repo).expel('s1', 'Uzoq vaqt kelmadi', true, 'sa-1')
    expect(repo.updateStudent).toHaveBeenCalledWith('s1', expect.objectContaining({
      status: 'inactive', room_number: null, blacklisted: true,
    }))
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'student.expel' }))
    expect(sendStudentBlacklistEmail).toHaveBeenCalledWith('ali@x.uz', 'Ali Valiyev', true, 'Uzoq vaqt kelmadi')
  })

  it('requires a reason', async () => {
    await expect(createSuperadminStudentsService(repository()).expel('s1', '', false, 'sa-1'))
      .rejects.toMatchObject({ status: 400 })
  })
})
