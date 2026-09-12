import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getRequestUser = vi.fn()
const getServiceSupabase = vi.fn()
const staffDormFaculties = vi.fn()

vi.mock('@/lib/server-auth', () => ({
  getRequestUser: (...args: unknown[]) => getRequestUser(...args),
}))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => getServiceSupabase(),
}))
vi.mock('@/server/auth/faculty', () => ({
  staffDormFaculties: (...args: unknown[]) => staffDormFaculties(...args),
}))

const { GET } = await import('./route')
const PAYMENT_ID = '00000000-0000-4000-8000-000000000001'

function request() {
  return new NextRequest(`http://localhost/api/payments/receipt-url?id=${PAYMENT_ID}`)
}

/**
 * @param paymentFaculty faculty stored on the `tolovlar` row
 * @param staffFaculty   faculty stored on the caller's `staff` row
 * @param studentId      owner of the payment ('other-student' = not the caller)
 */
function supabaseFor(
  role: string | null,
  { paymentFaculty = 'amit', staffFaculty = 'amit', studentId = 'other-student' } = {},
) {
  return {
    from(table: string) {
      const data = table === 'tolovlar'
        ? { student_id: studentId, receipt_url: `${studentId}/receipt.png`, faculty: paymentFaculty }
        : role === null ? null : { role, status: 'active', faculty: staffFaculty }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data, error: null }),
          }),
        }),
      }
    },
    storage: {
      from: () => ({
        createSignedUrl: vi.fn(async () => ({ data: { signedUrl: 'https://signed.example' }, error: null })),
      }),
    },
  }
}

describe('GET /api/payments/receipt-url', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRequestUser.mockResolvedValue({ id: 'staff-user' })
    staffDormFaculties.mockResolvedValue(['amit'])
  })

  it('rejects an unauthenticated caller', async () => {
    getRequestUser.mockResolvedValue(null)
    getServiceSupabase.mockReturnValue(supabaseFor('admin'))

    expect((await GET(request())).status).toBe(401)
  })

  // Receipt review moved from the retired admin panel to the tarbiyachi
  // (multi-faculty migration). The endpoint kept an `admin`-only check, so
  // the person who actually approves receipts got a 403 and had to decide
  // without ever seeing the image.
  it('lets a tarbiyachi open a receipt for a student in their own building', async () => {
    getServiceSupabase.mockReturnValue(supabaseFor('tarbiyachi'))

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ url: 'https://signed.example' })
  })

  it('scopes a tarbiyachi to the faculties living in their building', async () => {
    staffDormFaculties.mockResolvedValue(['amit'])
    getServiceSupabase.mockReturnValue(supabaseFor('tarbiyachi', { paymentFaculty: 'iqtisodiyot' }))

    expect((await GET(request())).status).toBe(403)
  })

  it('lets a dekan open a receipt from their own faculty only', async () => {
    getServiceSupabase.mockReturnValue(supabaseFor('dekan'))
    expect((await GET(request())).status).toBe(200)

    getServiceSupabase.mockReturnValue(supabaseFor('dekan', { paymentFaculty: 'iqtisodiyot' }))
    expect((await GET(request())).status).toBe(403)
  })

  it('does not expose receipts to a student who does not own them', async () => {
    getServiceSupabase.mockReturnValue(supabaseFor(null))

    expect((await GET(request())).status).toBe(403)
  })

  it('lets the payment owner open their own receipt', async () => {
    getServiceSupabase.mockReturnValue(supabaseFor(null, { studentId: 'staff-user' }))

    expect((await GET(request())).status).toBe(200)
  })

  it('allows an active admin to obtain the private receipt URL', async () => {
    getServiceSupabase.mockReturnValue(supabaseFor('admin', { staffFaculty: 'fizika' }))

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ url: 'https://signed.example' })
  })

  it('refuses when the payment row carries no faculty to scope against', async () => {
    getServiceSupabase.mockReturnValue(supabaseFor('tarbiyachi', { paymentFaculty: '' }))

    expect((await GET(request())).status).toBe(403)
  })
})
