import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const requireActiveStaff = vi.fn()
const staffFacultyOrPrimary = vi.fn()
const appSettingsGet = vi.fn()

type Result = { data?: unknown; error?: unknown }
let queue: Result[] = []
let queueIndex = 0
const rpcMock = vi.fn()
const authDeleteUserMock = vi.fn()

function nextResult(): Result {
  return queue[queueIndex++] ?? { data: null, error: null }
}

function chain() {
  const b: Record<string, unknown> & PromiseLike<Result> = {
    select: () => b,
    eq: () => b,
    or: () => b,
    order: () => b,
    update: () => b,
    delete: () => b,
    maybeSingle: async () => nextResult(),
    then: (resolve: (v: Result) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(nextResult()).then(resolve, reject),
  } as never
  return b
}

vi.mock('@/server/auth/guards', () => ({ requireStaffPermission: () => {}, requireActiveStaff: (...a: unknown[]) => requireActiveStaff(...a) }))
vi.mock('@/server/auth/faculty', () => ({ staffFacultyOrPrimary: (...a: unknown[]) => staffFacultyOrPrimary(...a) }))
vi.mock('@/features/app-settings/server/service', () => ({ createAppSettingsService: () => ({ get: appSettingsGet }) }))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({
    from: () => chain(),
    rpc: (...args: unknown[]) => { rpcMock(...args); return chain() },
    auth: { admin: { deleteUser: (...args: unknown[]) => authDeleteUserMock(...args) } },
  }),
}))

const { GET, PATCH, DELETE } = await import('./route')
const { resolveDeleteTarget } = await import('./delete-target')

function req(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

beforeEach(() => {
  vi.clearAllMocks()
  queue = []
  queueIndex = 0
  requireActiveStaff.mockResolvedValue({ user: { id: 'caller1' }, staff: { id: 'caller1', faculty: 'amit' } })
  staffFacultyOrPrimary.mockReturnValue('amit')
  appSettingsGet.mockResolvedValue({ floorCount: 9 })
  authDeleteUserMock.mockResolvedValue({ error: null })
})

describe('GET guard failures keep their own status', () => {
  it('answers 401 when the caller is not authenticated', async () => {
    requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req('http://localhost/api/admin/users'))
    expect(res.status).toBe(401)
  })

  it('answers 403 when the caller is signed in without a staff role', async () => {
    requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await GET(req('http://localhost/api/admin/users'))
    expect(res.status).toBe(403)
  })

  it('still answers 500 for a genuinely unexpected failure', async () => {
    requireActiveStaff.mockRejectedValue(new Error('boom'))
    const res = await GET(req('http://localhost/api/admin/users'))
    expect(res.status).toBe(500)
  })
})

describe('GET /api/admin/users', () => {
  it('500s when the students query errors', async () => {
    queue = [{ data: null, error: new Error('db down') }, { data: [], error: null }]
    const res = await GET(req('http://localhost/api/admin/users'))
    expect(res.status).toBe(500)
  })

  it('500s when the staff query errors', async () => {
    queue = [{ data: [], error: null }, { data: null, error: new Error('db down') }]
    const res = await GET(req('http://localhost/api/admin/users'))
    expect(res.status).toBe(500)
  })

  it('combines students and staff, sorted newest first', async () => {
    queue = [
      { data: [{ id: 's1', full_name: 'Student', email: 's@x.com', role: 'talaba', created_at: '2026-01-01T00:00:00Z' }], error: null },
      { data: [{ id: 'st1', full_name: 'Staff', email: 'st@x.com', role: 'tarbiyachi', created_at: '2026-02-01T00:00:00Z' }], error: null },
    ]
    const res = await GET(req('http://localhost/api/admin/users'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.users.map((u: { id: string }) => u.id)).toEqual(['st1', 's1'])
    expect(body.users[0].source).toBe('staff')
    expect(body.users[1].source).toBe('users')
  })
})

describe('admin users delete target resolution', () => {
  it('rejects a staff target disguised as a users-row target', () => {
    expect(() => resolveDeleteTarget('users', null, { id: 'dekan-id', role: 'dekan' })).toThrow(/manbasi/)
  })

  it('blocks dekan deletion even when the submitted source is correct', () => {
    expect(() => resolveDeleteTarget('staff', null, { id: 'dekan-id', role: 'dekan' })).toThrow(/Dekan/)
  })

  it('rejects ambiguous and missing profile rows', () => {
    expect(() => resolveDeleteTarget('users', { id: 'duplicate-id' }, { id: 'duplicate-id', role: 'admin' })).toThrow(/bir nechta/)
    expect(() => resolveDeleteTarget('users', null, null)).toThrow(/topilmadi/)
  })

  it('accepts a real student target only as a users source', () => {
    expect(resolveDeleteTarget('users', { id: 'student-id' }, null)).toBe('users')
  })
})

describe('PATCH /api/admin/users', () => {
  it('401s without a session', async () => {
    requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await PATCH(req('http://localhost/api/admin/users', { method: 'PATCH', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('400s a missing id/source', async () => {
    const res = await PATCH(req('http://localhost/api/admin/users', { method: 'PATCH', body: '{}' }))
    expect(res.status).toBe(400)
  })

  it('404s when the users-source target does not exist', async () => {
    queue = [{ data: null, error: null }]
    const res = await PATCH(req('http://localhost/api/admin/users', {
      method: 'PATCH', body: JSON.stringify({ id: 's1', source: 'users', full_name: 'X' }),
    }))
    expect(res.status).toBe(404)
  })

  it('403s a cross-faculty student target', async () => {
    queue = [{ data: { faculty: 'fizika' }, error: null }]
    const res = await PATCH(req('http://localhost/api/admin/users', {
      method: 'PATCH', body: JSON.stringify({ id: 's1', source: 'users', full_name: 'X' }),
    }))
    expect(res.status).toBe(403)
  })

  it('403s an attempt to move a student to another faculty', async () => {
    queue = [{ data: { faculty: 'amit' }, error: null }]
    const res = await PATCH(req('http://localhost/api/admin/users', {
      method: 'PATCH', body: JSON.stringify({ id: 's1', source: 'users', faculty: 'fizika' }),
    }))
    expect(res.status).toBe(403)
  })

  it('400s trying to convert a student row to a non-talaba role', async () => {
    queue = [{ data: { faculty: 'amit' }, error: null }]
    const res = await PATCH(req('http://localhost/api/admin/users', {
      method: 'PATCH', body: JSON.stringify({ id: 's1', source: 'users', role: 'tarbiyachi' }),
    }))
    expect(res.status).toBe(400)
  })

  it('403s promoting anyone to dekan from this panel', async () => {
    const res = await PATCH(req('http://localhost/api/admin/users', {
      method: 'PATCH', body: JSON.stringify({ id: 'st1', source: 'staff', role: 'dekan' }),
    }))
    expect(res.status).toBe(403)
  })

  it('404s when the staff-source target does not exist', async () => {
    queue = [{ data: null, error: null }]
    const res = await PATCH(req('http://localhost/api/admin/users', {
      method: 'PATCH', body: JSON.stringify({ id: 'st1', source: 'staff', full_name: 'X' }),
    }))
    expect(res.status).toBe(404)
  })

  it('403s editing a dekan profile from this panel', async () => {
    queue = [{ data: { role: 'dekan', status: 'active', assigned_floor: null, assigned_gender: null, faculty: 'amit' }, error: null }]
    const res = await PATCH(req('http://localhost/api/admin/users', {
      method: 'PATCH', body: JSON.stringify({ id: 'st1', source: 'staff', full_name: 'X' }),
    }))
    expect(res.status).toBe(403)
  })

  it('403s a cross-faculty staff target', async () => {
    queue = [{ data: { role: 'tarbiyachi', status: 'active', assigned_floor: 1, assigned_gender: 'male', faculty: 'fizika' }, error: null }]
    const res = await PATCH(req('http://localhost/api/admin/users', {
      method: 'PATCH', body: JSON.stringify({ id: 'st1', source: 'staff', full_name: 'X' }),
    }))
    expect(res.status).toBe(403)
  })

  it('400s an invalid status value', async () => {
    queue = [{ data: { faculty: 'amit' }, error: null }]
    const res = await PATCH(req('http://localhost/api/admin/users', {
      method: 'PATCH', body: JSON.stringify({ id: 's1', source: 'users', status: 'weird' }),
    }))
    expect(res.status).toBe(400)
  })

  it('400s activating a tarbiyachi with no floor/gender set', async () => {
    queue = [{ data: { role: 'tarbiyachi', status: 'pending', assigned_floor: null, assigned_gender: null, faculty: 'amit' }, error: null }]
    const res = await PATCH(req('http://localhost/api/admin/users', {
      method: 'PATCH', body: JSON.stringify({ id: 'st1', source: 'staff', status: 'active' }),
    }))
    expect(res.status).toBe(400)
  })

  it('400s an empty update body (nothing to change)', async () => {
    queue = [{ data: { faculty: 'amit' }, error: null }]
    const res = await PATCH(req('http://localhost/api/admin/users', {
      method: 'PATCH', body: JSON.stringify({ id: 's1', source: 'users' }),
    }))
    expect(res.status).toBe(400)
  })

  it('400s promoting a floor captain with no resolvable floor/gender', async () => {
    queue = [
      { data: { faculty: 'amit' }, error: null }, // target lookup
      { data: { assigned_floor: null, gender: null }, error: null }, // currentUser lookup
    ]
    const res = await PATCH(req('http://localhost/api/admin/users', {
      method: 'PATCH', body: JSON.stringify({ id: 's1', source: 'users', is_floor_captain: true }),
    }))
    expect(res.status).toBe(400)
  })

  it('500s when the floor-captain promotion RPC errors', async () => {
    queue = [
      { data: { faculty: 'amit' }, error: null },
      { data: { assigned_floor: 3, gender: 'male' }, error: null },
    ]
    rpcMock.mockImplementation(() => {})
    queue.push({ data: null, error: new Error('rpc failed') })
    const res = await PATCH(req('http://localhost/api/admin/users', {
      method: 'PATCH', body: JSON.stringify({ id: 's1', source: 'users', is_floor_captain: true }),
    }))
    expect(res.status).toBe(500)
    expect(rpcMock).toHaveBeenCalledWith('promote_floor_captain', expect.objectContaining({ p_user_id: 's1' }))
  })

  it('409s a unique-constraint conflict surfaced by the promote_floor_captain RPC itself', async () => {
    queue = [
      { data: { faculty: 'amit' }, error: null }, // target lookup
      { data: { assigned_floor: 3, gender: 'male' }, error: null }, // currentUser lookup for floor/gender
      { data: null, error: { code: '23505' } }, // promote_floor_captain rpc conflict
    ]
    const res = await PATCH(req('http://localhost/api/admin/users', {
      method: 'PATCH', body: JSON.stringify({ id: 's1', source: 'users', full_name: 'New Name', is_floor_captain: true, assigned_floor: 3, gender: 'male' }),
    }))
    expect(res.status).toBe(409)
  })

  it('updates a student on success', async () => {
    queue = [{ data: { faculty: 'amit' }, error: null }, { data: null, error: null }]
    const res = await PATCH(req('http://localhost/api/admin/users', {
      method: 'PATCH', body: JSON.stringify({ id: 's1', source: 'users', full_name: 'Yangi Ism' }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('500s when the final write throws unexpectedly', async () => {
    queue = [{ data: { faculty: 'amit' }, error: null }, { data: null, error: new Error('db down') }]
    const res = await PATCH(req('http://localhost/api/admin/users', {
      method: 'PATCH', body: JSON.stringify({ id: 's1', source: 'users', full_name: 'X' }),
    }))
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/admin/users', () => {
  it('401s without a session', async () => {
    requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await DELETE(req('http://localhost/api/admin/users', { method: 'DELETE', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('400s a missing id/source', async () => {
    const res = await DELETE(req('http://localhost/api/admin/users', { method: 'DELETE', body: '{}' }))
    expect(res.status).toBe(400)
  })

  it('400s trying to delete yourself', async () => {
    const res = await DELETE(req('http://localhost/api/admin/users', {
      method: 'DELETE', body: JSON.stringify({ id: 'caller1', source: 'users' }),
    }))
    expect(res.status).toBe(400)
  })

  it('500s when the target lookup errors', async () => {
    queue = [{ data: null, error: new Error('db down') }, { data: null, error: null }]
    const res = await DELETE(req('http://localhost/api/admin/users', {
      method: 'DELETE', body: JSON.stringify({ id: 's1', source: 'users' }),
    }))
    expect(res.status).toBe(500)
  })

  it('409s when the submitted source disagrees with the resolved row (via resolveDeleteTarget)', async () => {
    queue = [{ data: null, error: null }, { data: { id: 's1', role: 'tarbiyachi' }, error: null }]
    const res = await DELETE(req('http://localhost/api/admin/users', {
      method: 'DELETE', body: JSON.stringify({ id: 's1', source: 'users' }),
    }))
    expect(res.status).toBe(409)
  })

  it('403s deleting a cross-faculty student', async () => {
    queue = [{ data: { id: 's1', faculty: 'fizika' }, error: null }, { data: null, error: null }]
    const res = await DELETE(req('http://localhost/api/admin/users', {
      method: 'DELETE', body: JSON.stringify({ id: 's1', source: 'users' }),
    }))
    expect(res.status).toBe(403)
  })

  it('500s when the auth account deletion fails', async () => {
    queue = [{ data: { id: 's1', faculty: 'amit' }, error: null }, { data: null, error: null }]
    authDeleteUserMock.mockResolvedValue({ error: new Error('auth down') })
    const res = await DELETE(req('http://localhost/api/admin/users', {
      method: 'DELETE', body: JSON.stringify({ id: 's1', source: 'users' }),
    }))
    expect(res.status).toBe(500)
  })

  it('500s (with a distinct ghost-row warning) when the auth account is gone but the profile row cleanup fails', async () => {
    queue = [{ data: { id: 's1', faculty: 'amit' }, error: null }, { data: null, error: null }, { data: null, error: new Error('db down') }]
    const res = await DELETE(req('http://localhost/api/admin/users', {
      method: 'DELETE', body: JSON.stringify({ id: 's1', source: 'users' }),
    }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain("Hisob o'chirildi")
  })

  it('deletes the student on success', async () => {
    queue = [{ data: { id: 's1', faculty: 'amit' }, error: null }, { data: null, error: null }, { data: null, error: null }]
    const res = await DELETE(req('http://localhost/api/admin/users', {
      method: 'DELETE', body: JSON.stringify({ id: 's1', source: 'users' }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(authDeleteUserMock).toHaveBeenCalledWith('s1')
  })
})
