import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  runNightlyCron: vi.fn(),
  runDekanCron: vi.fn(),
  runNightlyReminders: vi.fn(),
  runCaptainAlerts: vi.fn(),
}))

vi.mock('@/features/attendance/server/dekan-service', () => ({
  createDekanAttendanceService: () => ({ runCron: mocks.runDekanCron }),
}))

vi.mock('@/features/attendance/server/service', () => ({
  createAttendanceService: () => ({ runNightlyCron: mocks.runNightlyCron, runNightlyReminders: mocks.runNightlyReminders, runCaptainAlerts: mocks.runCaptainAlerts }),
}))

const { POST, GET } = await import('./route')

function req(headers?: Record<string, string>) {
  return new NextRequest('https://example.test/api/attendance/cron', { method: 'POST', headers })
}

const ORIGINAL_SECRET = process.env.ATTENDANCE_CRON_SECRET

beforeEach(() => {
  vi.resetAllMocks()
  process.env.ATTENDANCE_CRON_SECRET = 'super-secret-cron-token'
})

afterEach(() => {
  process.env.ATTENDANCE_CRON_SECRET = ORIGINAL_SECRET
})

describe('POST /api/attendance/cron', () => {
  it('401s when no secret is configured on the server', async () => {
    delete process.env.ATTENDANCE_CRON_SECRET
    const res = await POST(req({ authorization: 'Bearer whatever' }))
    expect(res.status).toBe(401)
    expect(mocks.runNightlyCron).not.toHaveBeenCalled()
  })

  it('401s a missing Authorization header', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect(mocks.runNightlyCron).not.toHaveBeenCalled()
  })

  it('401s a wrong bearer token', async () => {
    const res = await POST(req({ authorization: 'Bearer wrong-token' }))
    expect(res.status).toBe(401)
    expect(mocks.runNightlyCron).not.toHaveBeenCalled()
  })

  it('500s when the cron job itself throws', async () => {
    mocks.runNightlyCron.mockRejectedValue(new Error('db down'))
    const res = await POST(req({ authorization: 'Bearer super-secret-cron-token' }))
    expect(res.status).toBe(500)
  })

  it('runs the nightly cron with a valid secret', async () => {
    mocks.runNightlyCron.mockResolvedValue({ opened: 1, closed: 2 })
    mocks.runDekanCron.mockResolvedValue({ started: 0, closed: 0, reminded: 0 })
    mocks.runNightlyReminders.mockResolvedValue({ reminded: 0 })
    const res = await POST(req({ authorization: 'Bearer super-secret-cron-token' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, opened: 1, closed: 2, dekan: { started: 0, closed: 0, reminded: 0 }, reminders: { reminded: 0 } })
  })

  it('a failing dekan cron never takes the nightly cron down', async () => {
    mocks.runNightlyCron.mockResolvedValue({ opened: 1 })
    mocks.runDekanCron.mockRejectedValue(new Error('dekan boom'))
    const res = await POST(req({ authorization: 'Bearer super-secret-cron-token' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, opened: 1, dekan: { error: true } })
  })

  it('GET is wired to the same handler for Vercel Cron', () => {
    expect(GET).toBe(POST)
  })
})
