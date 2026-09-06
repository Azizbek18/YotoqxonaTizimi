import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { createStoryService, parseStoryInput } = await import('./service')
import type { StoryRepository } from './repository'
import type { AnnouncementStoryRow } from '@/types/database.generated'

const row = (overrides: Partial<AnnouncementStoryRow> = {}): AnnouncementStoryRow => ({
  id: 's1',
  title: 'Sarlavha',
  caption: 'Qisqacha',
  type: 'Yangilik',
  image_path: 'staff-1/a.jpg',
  image_url: 'https://cdn.example/a.jpg',
  link_url: null,
  faculty: 'amit',
  created_by: 'staff-1',
  author_name: 'Tarbiyachi Ismi',
  created_at: '2026-09-06T10:00:00Z',
  expires_at: '2026-09-07T10:00:00Z',
  ...overrides,
})

function fakeRepository(overrides: Partial<StoryRepository> = {}) {
  return {
    listActiveByFaculty: vi.fn(async () => [] as AnnouncementStoryRow[]),
    insert: vi.fn(async (r: unknown) => ({ ...row(), ...(r as object) })),
    deleteByFaculty: vi.fn(async () => ({ id: 's1', image_path: 'staff-1/a.jpg' })),
    listActiveStudentIdsByFaculty: vi.fn(async () => []),
    listTelegramChatIds: vi.fn(async () => []),
    ...overrides,
  } as unknown as StoryRepository
}

const validInput = {
  title: 'Bugungi tadbir',
  caption: 'Soat 18:00 da',
  type: 'Tadbir',
  link_url: '',
  image_url: 'https://cdn.example/x.jpg',
  image_path: 'staff-1/x.jpg',
}

describe('parseStoryInput', () => {
  it('accepts a valid payload and normalises an empty caption/link to null', () => {
    const parsed = parseStoryInput({ ...validInput, caption: '   ', link_url: '' })
    expect(parsed.caption).toBeNull()
    expect(parsed.link_url).toBeNull()
    expect(parsed.type).toBe('Tadbir')
  })

  it('rejects a too-short title', () => {
    expect(() => parseStoryInput({ ...validInput, title: 'a' })).toThrow(/Sarlavha/)
  })

  it('rejects an unknown type', () => {
    expect(() => parseStoryInput({ ...validInput, type: 'Boshqa' })).toThrow(/turi/)
  })

  it('rejects a non-http link', () => {
    expect(() => parseStoryInput({ ...validInput, link_url: 'javascript:alert(1)' })).toThrow(/Havola/)
  })

  it('rejects a missing image', () => {
    expect(() => parseStoryInput({ ...validInput, image_url: '', image_path: '' })).toThrow(/Rasm/)
  })
})

describe('listForStudent', () => {
  it('returns [] for a faculty-less reader without hitting the repository', async () => {
    const repo = fakeRepository()
    const stories = await createStoryService(repo).listForStudent(null)
    expect(stories).toEqual([])
    expect(repo.listActiveByFaculty).not.toHaveBeenCalled()
  })

  it('maps active rows for the student faculty', async () => {
    const repo = fakeRepository({ listActiveByFaculty: vi.fn(async () => [row()]) })
    const stories = await createStoryService(repo).listForStudent('amit')
    expect(repo.listActiveByFaculty).toHaveBeenCalledWith('amit')
    expect(stories[0]).toMatchObject({ id: 's1', author_name: 'Tarbiyachi Ismi' })
    expect(stories[0]).not.toHaveProperty('created_by')
  })
})

describe('create', () => {
  it('pins the story to the poster faculty, lowercased', async () => {
    const insert = vi.fn(async (r: unknown) => ({ ...row(), ...(r as object) }))
    const service = createStoryService(fakeRepository({ insert }))
    await service.create('staff-1', '  Tarbiyachi Ismi  ', '  AMIT  ', validInput)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ faculty: 'amit', created_by: 'staff-1', author_name: 'Tarbiyachi Ismi' }),
    )
  })

  it('rejects a poster with no faculty', async () => {
    await expect(
      createStoryService(fakeRepository()).create('staff-1', 'X', null, validInput),
    ).rejects.toThrow(/fakulteti/i)
  })
})

describe('remove', () => {
  it('passes the author id through so a tarbiyachi only deletes their own', async () => {
    const deleteByFaculty = vi.fn(async () => ({ id: 's1', image_path: 'p/a.jpg' }))
    const service = createStoryService(fakeRepository({ deleteByFaculty }))
    await service.remove('amit', 's1', 'staff-7')
    expect(deleteByFaculty).toHaveBeenCalledWith('s1', 'amit', 'staff-7')
  })

  it('404s an unknown / out-of-faculty story', async () => {
    const service = createStoryService(fakeRepository({ deleteByFaculty: vi.fn(async () => null) }))
    await expect(service.remove('amit', 'nope')).rejects.toThrow(/topilmadi/)
  })
})
