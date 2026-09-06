import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const sendTelegramPhoto = vi.fn<(...a: unknown[]) => Promise<boolean>>().mockResolvedValue(true)
const sendPushForUsers = vi.fn<(...a: unknown[]) => Promise<void>>().mockResolvedValue(undefined)

vi.mock('@/lib/telegram', () => ({ sendTelegramPhoto: (...a: unknown[]) => sendTelegramPhoto(...a) }))
vi.mock('@/lib/push-notifications', () => ({ sendPushForUsers: (...a: unknown[]) => sendPushForUsers(...a) }))

const { broadcastStory } = await import('./broadcast')
import type { StoryRepository } from './repository'
import type { AnnouncementStoryRow } from '@/types/database.generated'

const story: AnnouncementStoryRow = {
  id: 's1',
  title: 'Suv o‘chiriladi',
  caption: 'Ertaga 9–12',
  type: 'Muhim',
  image_path: 'staff-1/a.jpg',
  image_url: 'https://cdn.example/a.jpg',
  link_url: null,
  faculty: 'amit',
  created_by: 'staff-1',
  author_name: 'Dekan',
  created_at: '2026-09-06T10:00:00Z',
  expires_at: '2026-09-07T10:00:00Z',
}

function repo(overrides: Partial<StoryRepository> = {}) {
  return {
    listActiveStudentIdsByFaculty: vi.fn(async () => ['u1', 'u2', 'u3']),
    listTelegramChatIds: vi.fn(async () => [111, 222]),
    ...overrides,
  } as unknown as StoryRepository
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('broadcastStory', () => {
  it('sends a Telegram photo to every linked chat and one push fan-out', async () => {
    await broadcastStory(story, repo())
    expect(sendTelegramPhoto).toHaveBeenCalledTimes(2)
    expect(sendTelegramPhoto).toHaveBeenCalledWith('111', story.image_url, expect.stringContaining('Suv'), expect.any(Object))
    expect(sendPushForUsers).toHaveBeenCalledWith(['u1', 'u2', 'u3'], expect.objectContaining({ tag: 'story' }))
  })

  it('does nothing when the faculty has no active students', async () => {
    await broadcastStory(story, repo({ listActiveStudentIdsByFaculty: vi.fn(async () => []) }))
    expect(sendTelegramPhoto).not.toHaveBeenCalled()
    expect(sendPushForUsers).not.toHaveBeenCalled()
  })

  it('still runs the push fan-out when Telegram lookup throws', async () => {
    await broadcastStory(story, repo({ listTelegramChatIds: vi.fn(async () => { throw new Error('db down') }) }))
    expect(sendPushForUsers).toHaveBeenCalledTimes(1)
  })

  it('never rejects even if push delivery throws', async () => {
    sendPushForUsers.mockRejectedValueOnce(new Error('vapid missing'))
    await expect(broadcastStory(story, repo())).resolves.toBeUndefined()
  })
})
