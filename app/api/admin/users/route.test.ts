import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const requireActiveStaff = vi.fn()

vi.mock('@/server/auth/guards', () => ({ requireStaffPermission: () => {}, requireActiveStaff: (...a: unknown[]) => requireActiveStaff(...a) }))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: () => ({ from: vi.fn() }) }))

const { GET } = await import('./route')
const { resolveDeleteTarget } = await import('./delete-target')

beforeEach(() => {
  vi.clearAllMocks()
})

// The guard signals "not signed in" / "wrong role" by throwing an ApiError.
// A catch block that only knows how to answer 500 turns every one of those
// into a server error, so the browser shows "server xatosi" instead of
// redirecting to login.
describe('GET guard failures keep their own status', () => {
  it('answers 401 when the caller is not authenticated', async () => {
    requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(new NextRequest('http://localhost/api/admin/users'))
    expect(res.status).toBe(401)
  })

  it('answers 403 when the caller is signed in without a staff role', async () => {
    requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await GET(new NextRequest('http://localhost/api/admin/users'))
    expect(res.status).toBe(403)
  })

  it('still answers 500 for a genuinely unexpected failure', async () => {
    requireActiveStaff.mockRejectedValue(new Error('boom'))
    const res = await GET(new NextRequest('http://localhost/api/admin/users'))
    expect(res.status).toBe(500)
  })
})

describe('admin users delete target resolution', () => {
  it('rejects a staff target disguised as a users-row target', () => {
    expect(() => resolveDeleteTarget(
      'users',
      null,
      { id: 'dekan-id', role: 'dekan' },
    )).toThrow(/manbasi/)
  })

  it('blocks dekan deletion even when the submitted source is correct', () => {
    expect(() => resolveDeleteTarget(
      'staff',
      null,
      { id: 'dekan-id', role: 'dekan' },
    )).toThrow(/Dekan/)
  })

  it('rejects ambiguous and missing profile rows', () => {
    expect(() => resolveDeleteTarget(
      'users',
      { id: 'duplicate-id' },
      { id: 'duplicate-id', role: 'admin' },
    )).toThrow(/bir nechta/)
    expect(() => resolveDeleteTarget('users', null, null)).toThrow(/topilmadi/)
  })

  it('accepts a real student target only as a users source', () => {
    expect(resolveDeleteTarget('users', { id: 'student-id' }, null)).toBe('users')
  })
})
