import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  runNightlyCron: vi.fn(),
}))

vi.mock('@/features/attendance/server/service', () => ({
  createAttendanceService: () => ({ runNightlyCron: mocks.runNightlyCron }),
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
    const res = await POST(req({ authorization: 'Bearer super-secret-cron-token' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, opened: 1, closed: 2 })
  })

  it('GET is wired to the same handler for Vercel Cron', () => {
    expect(GET).toBe(POST)
  })
})
