import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  checkRateLimit: vi.fn(),
  maybeSingle: vi.fn(),
}))

const profileQuery = {
  select: vi.fn(() => profileQuery),
  eq: vi.fn(() => profileQuery),
  maybeSingle: mocks.maybeSingle,
}

vi.mock('@/server/auth/guards', () => ({ requireActiveStudent: mocks.requireActiveStudent }))
vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({ from: () => profileQuery }),
}))

import { POST } from './route'

describe('student avatar rate limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireActiveStudent.mockResolvedValue({
      user: { id: 'student-1' },
      student: { id: 'student-1' },
    })
    mocks.maybeSingle.mockResolvedValue({ data: { id: 'student-1', avatar_url: null }, error: null })
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })
  })

  it('rejects a burst before parsing or uploading the file', async () => {
    const response = await POST(new NextRequest('https://example.test/api/student/profile/upload-avatar', {
      method: 'POST',
    }))

    expect(response.status).toBe(429)
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('student-avatar:student-1', 10, 5 * 60_000)
  })
})
