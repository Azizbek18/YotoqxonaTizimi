import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireFloorCaptain = vi.fn()

vi.mock('@/server/auth/sardor', () => ({
  requireFloorCaptain: (...args: unknown[]) => requireFloorCaptain(...args),
}))

const { PATCH } = await import('./route')

describe('PATCH /api/sardor/elonlar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the atomic duty-schedule RPC instead of a read-then-insert race', async () => {
    const rpc = vi.fn(async () => ({
      data: '00000000-0000-4000-8000-000000000001',
      error: null,
    }))
    requireFloorCaptain.mockResolvedValue({
      caller: {
        id: 'captain-id',
        assigned_floor: 3,
        gender: 'male',
        faculty: 'Matematika',
      },
      serviceSupabase: { rpc },
    })
    const request = new NextRequest('http://localhost/api/sardor/elonlar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schedule: { Dushanba: ['301'] },
        admins: [{ id: 'captain-id', name: 'Captain' }],
      }),
    })

    const response = await PATCH(request)

    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('upsert_floor_duty_schedule', expect.objectContaining({
      p_creator_id: 'captain-id',
      p_floor: 3,
      p_gender: 'male',
    }))
  })
})
