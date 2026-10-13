import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  claimAlertSlot: vi.fn(),
  getDekanTelegramChatId: vi.fn(),
  sendTelegramChatMessage: vi.fn(),
  sendStudentTelegram: vi.fn(),
  notifyStudent: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/features/attendance/server/repository', () => ({
  createAttendanceRepository: () => ({ claimAlertSlot: mocks.claimAlertSlot }),
}))
vi.mock('@/lib/dekan-telegram', () => ({ getDekanTelegramChatId: mocks.getDekanTelegramChatId }))
vi.mock('@/lib/telegram', () => ({
  openInAppButton: (text: string, url: string) => ({ text, url }),
  sendTelegramChatMessage: mocks.sendTelegramChatMessage,
}))
vi.mock('@/lib/student-telegram', () => ({ sendStudentTelegram: mocks.sendStudentTelegram }))
vi.mock('@/lib/push-notifications', () => ({ sendPushWithoutBreaking: (fn: () => Promise<unknown>) => fn() }))
vi.mock('@/lib/notify-student', () => ({ notifyStudent: mocks.notifyStudent }))

const { runLeaveOverdueAlerts, formatOverdueMessage } = await import('./overdue')

const row = (id: string, faculty: string, name: string) => ({
  id, studentId: `s-${id}`, studentName: name, roomNumber: '305', floor: 3, faculty, inEffect: false,
  endsOn: '2026-10-10', contactName: 'Vali', contactPhone: '+998901234567',
}) as never

beforeEach(() => {
  vi.resetAllMocks()
  mocks.claimAlertSlot.mockResolvedValue(true)
  mocks.getDekanTelegramChatId.mockResolvedValue('-100123')
  mocks.sendTelegramChatMessage.mockResolvedValue(true)
  mocks.sendStudentTelegram.mockResolvedValue(true)
})

describe('runLeaveOverdueAlerts', () => {
  it('does nothing when nobody is overdue', async () => {
    const service = { findOverdue: vi.fn().mockResolvedValue([]) }
    expect(await runLeaveOverdueAlerts(service as never)).toEqual({ overdue: 0, alertedDekans: 0, remindedStudents: 0 })
    expect(mocks.sendTelegramChatMessage).not.toHaveBeenCalled()
  })

  it('sends ONE digest per faculty and reminds each student, once per leave', async () => {
    const service = { findOverdue: vi.fn().mockResolvedValue([row('1', 'amit', 'Ali'), row('2', 'amit', 'Vali'), row('3', 'iqtisodiyot', 'Sami')]) }
    const out = await runLeaveOverdueAlerts(service as never)
    expect(out).toEqual({ overdue: 3, alertedDekans: 2, remindedStudents: 3 })
    expect(mocks.sendTelegramChatMessage).toHaveBeenCalledTimes(2)
    expect(mocks.sendTelegramChatMessage.mock.calls[0][1]).toContain('Ali')
    expect(mocks.sendTelegramChatMessage.mock.calls[0][1]).toContain('Vali')
    expect(mocks.sendTelegramChatMessage.mock.calls[0][2]).toMatchObject({ parseMode: 'HTML' })
  })

  it('skips leaves already alerted, and a faculty without a Telegram chat', async () => {
    mocks.claimAlertSlot.mockImplementation(async (key: string) => key !== 'leave-overdue:1')
    mocks.getDekanTelegramChatId.mockResolvedValue('')
    const service = { findOverdue: vi.fn().mockResolvedValue([row('1', 'amit', 'Ali'), row('2', 'amit', 'Vali')]) }
    const out = await runLeaveOverdueAlerts(service as never)
    expect(out).toEqual({ overdue: 2, alertedDekans: 0, remindedStudents: 1 })
    expect(mocks.sendStudentTelegram).toHaveBeenCalledTimes(1)
  })
})

describe('formatOverdueMessage', () => {
  it('escapes names so Telegram HTML cannot break', () => {
    expect(formatOverdueMessage([row('1', 'amit', 'A<b>li')])).toContain('A&lt;b&gt;li')
  })
})
