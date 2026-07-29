import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getRequestUser = vi.fn()
const getServiceSupabase = vi.fn()

vi.mock('@/lib/server-auth', () => ({
  getRequestUser: (...args: unknown[]) => getRequestUser(...args),
}))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => getServiceSupabase(),
}))

const { GET } = await import('./route')
const PAYMENT_ID = '00000000-0000-4000-8000-000000000001'

function request() {
  return new NextRequest(`http://localhost/api/payments/receipt-url?id=${PAYMENT_ID}`)
}

function supabaseFor(role: string) {
  return {
    from(table: string) {
      const data = table === 'tolovlar'
        ? { student_id: 'other-student', receipt_url: 'other-student/receipt.png' }
        : { role, status: 'active' }
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
  })

  it('does not expose arbitrary student receipts to tarbiyachi', async () => {
    getServiceSupabase.mockReturnValue(supabaseFor('tarbiyachi'))

    const response = await GET(request())

    expect(response.status).toBe(403)
  })

  it('allows an active admin to obtain the private receipt URL', async () => {
    getServiceSupabase.mockReturnValue(supabaseFor('admin'))

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ url: 'https://signed.example' })
  })
})
