import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const requireActiveStaff = vi.fn()
const getServiceSupabase = vi.fn()

vi.mock('@/server/auth/guards', () => ({
  requireActiveStaff: (...args: unknown[]) => requireActiveStaff(...args),
}))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => getServiceSupabase(),
}))

const { GET } = await import('./route')
const PERMIT_ID = '00000000-0000-4000-8000-000000000001'

function request() {
  return new NextRequest(`http://localhost/api/staff/permit-document?id=${PERMIT_ID}`)
}

describe('GET /api/staff/permit-document', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects tarbiyachi through the active-staff role guard', async () => {
    requireActiveStaff.mockRejectedValue(new ApiError(403, "Bu amal uchun ruxsat yo'q"))

    const req = request()
    const response = await GET(req)

    expect(response.status).toBe(403)
    expect(requireActiveStaff).toHaveBeenCalledWith(req, ['admin', 'zamdekan'])
    expect(getServiceSupabase).not.toHaveBeenCalled()
  })

  it('does not expose another faculty permit to a zamdekan', async () => {
    requireActiveStaff.mockResolvedValue({
      staff: { id: 'staff-id', role: 'zamdekan', status: 'active', faculty: 'Matematika' },
    })
    const maybeSingle = vi.fn(async () => ({
      data: { permit_url: '2026/file.pdf', faculty: 'Fizika' },
      error: null,
    }))
    getServiceSupabase.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle }),
        }),
      }),
    })

    const response = await GET(request())

    expect(response.status).toBe(403)
  })
})
