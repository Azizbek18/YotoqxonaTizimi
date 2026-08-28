import { describe, expect, it, vi } from 'vitest'
import { createAnnouncementService, sameFacultyCode } from './service'
import type { AnnouncementRepository } from './repository'

type PublishedRow = Awaited<ReturnType<AnnouncementRepository['listPublished']>>[number]

const row = (overrides: Partial<PublishedRow>): PublishedRow =>
  ({
    id: 'e1',
    title: 'Sarlavha',
    text: 'Matn',
    type: 'Yangilik',
    audience: 'faculty',
    faculty: 'amit',
    is_published: true,
    created_at: '2026-08-01T10:00:00Z',
    published_at: '2026-08-01T10:00:00Z',
    created_by: 'dekan-1',
    target_floor: null,
    target_gender: null,
    ...overrides,
  }) as PublishedRow

function fakeRepository(overrides: Partial<AnnouncementRepository> = {}) {
  return {
    findAudienceProfile: vi.fn(async () => ({
      faculty: 'amit',
      room_number: '12',
      gender: 'male',
      assigned_floor: 1,
    })),
    listPublished: vi.fn(async () => [] as PublishedRow[]),
    listByFaculty: vi.fn(async () => []),
    insertAuthored: vi.fn(async (value: unknown) => value),
    updateByFaculty: vi.fn(async () => null),
    deleteByFaculty: vi.fn(async () => null),
    listStudentCreators: vi.fn(async () => []),
    listStaffCreators: vi.fn(async () => [{ id: 'dekan-1', full_name: 'Dekan Ismi' }]),
    ...overrides,
  } as unknown as AnnouncementRepository
}

describe('listForUser audience filtering', () => {
  it('delivers a faculty announcement to that faculty’s student', async () => {
    const repository = fakeRepository({
      listPublished: vi.fn(async () => [row({ faculty: 'amit' })]),
    })
    const { elonlar } = await createAnnouncementService(repository).listForUser('student-1')

    expect(elonlar).toHaveLength(1)
    expect(elonlar[0].author_name).toBe('Dekan Ismi')
  })

  it('still delivers when the two faculty codes differ only by case or spacing', async () => {
    // staff.faculty and users.faculty are edited on different screens — this
    // is the drift that used to make an announcement silently invisible.
    const repository = fakeRepository({
      listPublished: vi.fn(async () => [row({ faculty: ' AMIT ' })]),
    })
    const { elonlar } = await createAnnouncementService(repository).listForUser('student-1')

    expect(elonlar).toHaveLength(1)
  })

  it('does not leak a faculty announcement to another faculty', async () => {
    const repository = fakeRepository({
      listPublished: vi.fn(async () => [row({ faculty: 'kimyo' })]),
    })
    const { elonlar } = await createAnnouncementService(repository).listForUser('student-1')

    expect(elonlar).toHaveLength(0)
  })

  it('hides faculty announcements from a signed-out reader', async () => {
    const repository = fakeRepository({
      listPublished: vi.fn(async () => [row({ faculty: 'amit' }), row({ id: 'e2', audience: 'all', faculty: null })]),
    })
    const { elonlar } = await createAnnouncementService(repository).listForUser(null)

    expect(elonlar.map((item) => item.id)).toEqual(['e2'])
  })

  // The fake profile is faculty 'amit', floor 1, gender 'male'.
  const floorRow = (overrides: Partial<PublishedRow>) =>
    row({ audience: 'floor', faculty: 'amit', target_floor: 1, target_gender: 'male', ...overrides })

  it('delivers a floor notice to a student on that floor of that building', async () => {
    const repository = fakeRepository({ listPublished: vi.fn(async () => [floorRow({})]) })
    const { elonlar } = await createAnnouncementService(repository).listForUser('student-1')
    expect(elonlar).toHaveLength(1)
  })

  it('does not leak a floor notice to the same floor number in another faculty', async () => {
    const repository = fakeRepository({ listPublished: vi.fn(async () => [floorRow({ faculty: 'fizika' })]) })
    const { elonlar } = await createAnnouncementService(repository).listForUser('student-1')
    expect(elonlar).toHaveLength(0)
  })

  it('does not deliver a floor notice for a different floor', async () => {
    const repository = fakeRepository({ listPublished: vi.fn(async () => [floorRow({ target_floor: 2 })]) })
    const { elonlar } = await createAnnouncementService(repository).listForUser('student-1')
    expect(elonlar).toHaveLength(0)
  })
})

describe('createForFaculty', () => {
  it('pins the announcement to the dekan’s own faculty, normalized', async () => {
    const insertAuthored = vi.fn(async (value: unknown) => ({ id: 'new', ...(value as object) }))
    const repository = fakeRepository({ insertAuthored } as unknown as Partial<AnnouncementRepository>)

    await createAnnouncementService(repository).createForFaculty('dekan-1', '  AMIT  ', {
      title: 'Suv o‘chiriladi',
      text: 'Ertaga soat 9 dan 12 gacha suv bo‘lmaydi.',
      type: 'Muhim',
      is_published: true,
    })

    expect(insertAuthored).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'faculty', faculty: 'amit', created_by: 'dekan-1' }),
    )
    // Published announcements carry a timestamp so the student list can order by it.
    expect(insertAuthored.mock.calls[0][0]).toHaveProperty('published_at', expect.any(String))
  })

  it('leaves published_at empty for a draft', async () => {
    const insertAuthored = vi.fn(async (value: unknown) => value)
    const repository = fakeRepository({ insertAuthored } as unknown as Partial<AnnouncementRepository>)

    await createAnnouncementService(repository).createForFaculty('dekan-1', 'amit', {
      title: 'Qoralama',
      text: 'Keyinroq chop etiladi.',
      type: 'Yangilik',
      is_published: false,
    })

    expect(insertAuthored).toHaveBeenCalledWith(
      expect.objectContaining({ is_published: false, published_at: null }),
    )
  })

  it('rejects a dekan with no faculty assigned', async () => {
    await expect(
      createAnnouncementService(fakeRepository()).createForFaculty('dekan-1', null, {
        title: 'Sarlavha',
        text: 'Matn matni',
        type: 'Yangilik',
        is_published: true,
      }),
    ).rejects.toThrow(/fakulteti/i)
  })

  it('rejects too-short input', async () => {
    await expect(
      createAnnouncementService(fakeRepository()).createForFaculty('dekan-1', 'amit', {
        title: 'ab',
        text: 'Matn matni',
        type: 'Yangilik',
        is_published: true,
      }),
    ).rejects.toThrow(/Sarlavha/)
  })
})

describe('updateAuthored / removeAuthored', () => {
  it('refuses to touch an announcement outside the dekan’s faculty', async () => {
    const service = createAnnouncementService(fakeRepository())

    await expect(service.updateAuthored('amit', { id: 'other', title: 'Yangi sarlavha' })).rejects.toThrow(
      /topilmadi/,
    )
    await expect(service.removeAuthored('amit', 'other')).rejects.toThrow(/topilmadi/)
  })

  it('scopes the update to the dekan’s faculty, not the creator', async () => {
    const updateByFaculty = vi.fn(async () => ({ id: 'e1', title: 'Yangi' }))
    const service = createAnnouncementService(
      fakeRepository({ updateByFaculty } as unknown as Partial<AnnouncementRepository>),
    )

    await service.updateAuthored('  AMIT  ', { id: 'e1', title: 'Yangi sarlavha' })
    expect(updateByFaculty).toHaveBeenCalledWith('e1', 'AMIT', expect.objectContaining({ title: 'Yangi sarlavha' }))
  })

  it('rejects a dekan with no faculty assigned', async () => {
    const service = createAnnouncementService(fakeRepository())
    await expect(service.listAuthored(null)).rejects.toThrow(/fakulteti/i)
    await expect(service.removeAuthored(null, 'e1')).rejects.toThrow(/fakulteti/i)
  })
})

describe('sameFacultyCode', () => {
  it('treats blank values as never matching', () => {
    expect(sameFacultyCode('', '')).toBe(false)
    expect(sameFacultyCode(null, null)).toBe(false)
    expect(sameFacultyCode('amit', 'Amit')).toBe(true)
  })
})
