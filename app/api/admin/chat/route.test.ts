import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  checkRateLimit: vi.fn(),
  getServiceSupabase: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: mocks.requireActiveStaff }))
vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: mocks.getServiceSupabase }))

import { POST } from './route'

describe('admin chat rate limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireActiveStaff.mockResolvedValue({
      user: { id: 'admin-1' },
      staff: { faculty: 'amit' },
    })
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })
  })

  it('rejects a burst before touching the service-role database client', async () => {
    const response = await POST(new NextRequest('https://example.test/api/admin/chat', {
      method: 'POST',
      body: JSON.stringify({ student_id: 'student-1', message: 'Salom' }),
    }))

    expect(response.status).toBe(429)
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('admin-chat:admin-1', 60, 60_000)
    expect(mocks.getServiceSupabase).not.toHaveBeenCalled()
  })
})
