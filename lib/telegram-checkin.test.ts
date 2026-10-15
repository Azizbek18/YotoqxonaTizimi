import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const sendTelegramChatMessage = vi.fn(async () => true)
const findStudentByTelegramChat = vi.fn()
const checkin = vi.fn()
vi.mock('@/lib/telegram', () => ({ sendTelegramChatMessage }))
vi.mock('@/lib/student-telegram', () => ({ findStudentByTelegramChat }))
vi.mock('@/lib/security', () => ({ checkRateLimit: async () => ({ allowed: true }) }))
vi.mock('@/lib/faculties', () => ({ normalizeFaculty: (f: string | null) => f }))
vi.mock('@/features/attendance/server/service', () => ({ createAttendanceService: () => ({ checkin }) }))

const { handleTelegramLocation } = await import('./telegram-checkin')
const now = () => Math.floor(Date.now() / 1000)
const location = { latitude: 41.3, longitude: 69.2, horizontal_accuracy: 12 }

describe('Telegram location check-in', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findStudentByTelegramChat.mockResolvedValue({ id: 's1', faculty: 'amit' })
  })

  it('rejects forwarded and stale locations without checking in', async () => {
    await handleTelegramLocation(1, { date: now(), location, forward_origin: {} })
    await handleTelegramLocation(1, { date: now() - 600, location })
    expect(checkin).not.toHaveBeenCalled()
    expect(sendTelegramChatMessage).toHaveBeenCalledTimes(2)
  })

  it('checks a fresh location in with the reported accuracy', async () => {
    checkin.mockResolvedValue({ status: 'present', distanceM: 5 })
    await handleTelegramLocation(1, { date: now(), location })
    expect(checkin).toHaveBeenCalledWith('s1', 'amit', { lat: 41.3, lng: 69.2, accuracy: 12 })
  })

  it('does nothing for an unlinked chat', async () => {
    findStudentByTelegramChat.mockResolvedValue(null)
    await handleTelegramLocation(1, { date: now(), location })
    expect(checkin).not.toHaveBeenCalled()
  })
})
