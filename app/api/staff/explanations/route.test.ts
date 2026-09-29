import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  requireStaffPermission: vi.fn(),
  staffDormFaculties: vi.fn(),
  staffDormId: vi.fn(),
  checkRateLimit: vi.fn(),
  explanationContext: vi.fn(),
  createExplanationOnBehalf: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({
  requireActiveStaff: mocks.requireActiveStaff,
  requireStaffPermission: mocks.requireStaffPermission,
}))
vi.mock('@/server/auth/faculty', () => ({ staffDormFaculties: mocks.staffDormFaculties, staffDormId: mocks.staffDormId }))
vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit, getClientIp: () => '1.2.3.4' }))
vi.mock('@/features/applications/server/service', () => ({
  createApplicationService: () => ({
    explanationContext: mocks.explanationContext,
    createExplanationOnBehalf: mocks.createExplanationOnBehalf,
  }),
}))

const { GET, POST } = await import('./route')
const URL_ = 'https://example.test/api/staff/explanations'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStaff.mockResolvedValue({ staff: { id: 's1', full_name: 'Tarbiyachi', faculty: 'amit' } })
  mocks.requireStaffPermission.mockImplementation(() => {})
  mocks.staffDormFaculties.mockResolvedValue(['amit', 'iqtisodiyot'])
  mocks.staffDormId.mockResolvedValue('dorm-12')
  mocks.checkRateLimit.mockResolvedValue({ allowed: true })
})

describe('/api/staff/explanations', () => {
  it('only a tarbiyachi may use it', async () => {
    await GET(new NextRequest(`${URL_}?studentId=x`))
    expect(mocks.requireActiveStaff.mock.calls[0][1]).toEqual(['tarbiyachi'])
  })

  it('403s when the dekan revoked the explanations.write permission', async () => {
    mocks.requireStaffPermission.mockImplementation(() => {
      throw new ApiError(403, 'Bu bo‘lim uchun dekan ruxsat bermagan', 'PERMISSION_REVOKED')
    })
    expect((await GET(new NextRequest(`${URL_}?studentId=x`))).status).toBe(403)
    expect((await POST(new NextRequest(URL_, { method: 'POST', body: '{}' }))).status).toBe(403)
  })

  it('GET scopes the lookup to the tarbiyachi’s dorm faculties', async () => {
    mocks.explanationContext.mockResolvedValue({ success: true })
    await GET(new NextRequest(`${URL_}?studentId=stu-1`))
    expect(mocks.explanationContext).toHaveBeenCalledWith({ faculties: ['amit', 'iqtisodiyot'], dormId: 'dorm-12' }, 'stu-1')
  })

  it('POST records the tarbiyachi as the author and passes signing evidence', async () => {
    mocks.createExplanationOnBehalf.mockResolvedValue({ success: true, red: false })
    const res = await POST(new NextRequest(URL_, { method: 'POST', body: JSON.stringify({ studentId: 'stu-1' }) }))
    expect(res.status).toBe(200)
    const [staff, faculties, body, evidence] = mocks.createExplanationOnBehalf.mock.calls[0]
    expect(staff).toEqual({ id: 's1', fullName: 'Tarbiyachi' })
    expect(faculties).toEqual({ faculties: ['amit', 'iqtisodiyot'], dormId: 'dorm-12' })
    expect(body).toEqual({ studentId: 'stu-1' })
    expect(evidence).toMatchObject({ ip: '1.2.3.4' })
  })

  it('POST is rate limited', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false })
    expect((await POST(new NextRequest(URL_, { method: 'POST', body: '{}' }))).status).toBe(429)
  })

  it('surfaces a service error (e.g. a KV student) with its status', async () => {
    mocks.createExplanationOnBehalf.mockRejectedValue(new ApiError(409, 'KV-talaba'))
    expect((await POST(new NextRequest(URL_, { method: 'POST', body: '{}' }))).status).toBe(409)
  })
})
