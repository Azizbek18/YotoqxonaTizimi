import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireFloorCaptain = vi.fn()

vi.mock('@/server/auth/sardor', () => ({
  requireFloorCaptain: (...args: unknown[]) => requireFloorCaptain(...args),
}))

const { GET, PATCH } = await import('./route')

it('reads the current physical duty schedule after a captain moves building or block', async () => {
  const title = 'HAFTALIK_NAVBATCHILIK_JADVALI'
  const current = { id: 'current', title, faculty: 'amit', dorm_id: 'd2', target_block: 'B', target_floor: 3, target_gender: 'male', text: '{"schedule":{"current":[]},"admins":[]}' }
  const old = [
    { ...current, id: 'other-building', dorm_id: 'd1' },
    { ...current, id: 'other-block', target_block: 'A' },
    { ...current, id: 'other-floor', target_floor: 2 },
    { ...current, id: 'other-gender', target_gender: 'female' },
    { ...current, id: 'other-faculty', faculty: 'fizika' },
  ]
  requireFloorCaptain.mockResolvedValue({ faculty: 'amit', caller: { id: 'cap', dorm_id: 'd2', block: 'B', assigned_floor: 3, gender: 'male' },
    serviceSupabase: { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [...old, current], error: null }) }) }) }) } })
  const response = await GET(new NextRequest('http://localhost/api/sardor/elonlar'))
  expect(response.status).toBe(200)
  expect((await response.json()).dutySchedule).toEqual({ id: 'current', schedule: { current: [] }, admins: [] })
})

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
