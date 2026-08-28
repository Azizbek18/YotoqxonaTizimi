import { describe, expect, it, vi } from 'vitest'
import { createCleaningScheduleService } from './service'
import type { CleaningScheduleRepository } from './repository'

function repository(overrides: Partial<CleaningScheduleRepository> = {}) {
  return {
    getRoomAndFaculty: vi.fn(async () => ({ roomNumber: '305' as string | null, faculty: 'amit' as const })),
    getRoommates: vi.fn(async () => [
      { id: 'mate-1', full_name: 'Ali Aliyev' },
      { id: 'mate-2', full_name: 'Vali Valiyev' },
    ]),
    get: vi.fn(async () => ({ schedule: { Dushanba: { id: 'mate-1', name: 'Ali Aliyev' } }, updated_at: '2026-09-01T00:00:00Z' })),
    save: vi.fn(async (_faculty: string, _room: string, schedule: unknown) => ({ schedule, updated_at: '2026-09-02T00:00:00Z' })),
    ...overrides,
  } as unknown as CleaningScheduleRepository
}

describe('cleaning schedule service', () => {
  it('reads the schedule for the student\'s own building', async () => {
    const repo = repository()
    const result = await createCleaningScheduleService(repo).get('student-1')

    expect(repo.get).toHaveBeenCalledWith('amit', '305')
    expect(result).toMatchObject({ success: true, roomNumber: '305' })
  })

  it('rejects a student with no room', async () => {
    const repo = repository({ getRoomAndFaculty: vi.fn(async () => ({ roomNumber: null as string | null, faculty: 'amit' as const })) })
    await expect(createCleaningScheduleService(repo).get('student-1')).rejects.toMatchObject({ status: 409 })
  })

  it('saves with the faculty and rewrites assignee names from the roommate lookup', async () => {
    const repo = repository()
    await createCleaningScheduleService(repo).save('student-1', {
      Dushanba: { id: 'mate-1', name: 'SPOOFED NAME' },
    })

    expect(repo.save).toHaveBeenCalledWith('amit', '305', { Dushanba: { id: 'mate-1', name: 'Ali Aliyev' } })
    expect(repo.getRoommates).toHaveBeenCalledWith('amit', '305')
  })

  it('rejects an assignee who is not a roommate of that room', async () => {
    const repo = repository()
    await expect(
      createCleaningScheduleService(repo).save('student-1', { Dushanba: { id: 'outsider', name: 'X' } }),
    ).rejects.toMatchObject({ status: 400 })
    expect(repo.save).not.toHaveBeenCalled()
  })
})
