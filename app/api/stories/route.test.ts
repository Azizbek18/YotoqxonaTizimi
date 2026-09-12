import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const requireActiveStudent = vi.fn()
const listForStudent = vi.fn()

vi.mock('@/server/auth/guards', () => ({ requireStaffPermission: () => {},
  requireActiveStudent: (...a: unknown[]) => requireActiveStudent(...a),
}))
vi.mock('@/features/stories/server/service', () => ({
  createStoryService: () => ({ listForStudent }),
}))

const { GET } = await import('./route')

const req = () => new Request('http://localhost/api/stories') as never

beforeEach(() => vi.clearAllMocks())

describe('GET /api/stories', () => {
  it('returns the faculty-scoped active stories for the student', async () => {
    requireActiveStudent.mockResolvedValue({ student: { id: 'u1', faculty: 'amit' } })
    listForStudent.mockResolvedValue([{ id: 's1' }])
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ stories: [{ id: 's1' }] })
    expect(listForStudent).toHaveBeenCalledWith('amit')
  })

  it('stays reachable for a blacklisted student', async () => {
    requireActiveStudent.mockResolvedValue({ student: { id: 'u1', faculty: 'amit' } })
    listForStudent.mockResolvedValue([])
    await GET(req())
    expect(requireActiveStudent).toHaveBeenCalledWith(expect.anything(), { allowBlacklisted: true })
  })

  it('propagates an auth failure status', async () => {
    requireActiveStudent.mockRejectedValue(new ApiError(401, 'kirish talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req())
    expect(res.status).toBe(401)
  })
})
