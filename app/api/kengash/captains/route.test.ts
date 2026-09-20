import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireCouncilChair = vi.fn()
vi.mock('@/server/auth/council', () => ({
  requireCouncilChair: (...args: unknown[]) => requireCouncilChair(...args),
}))

const { PATCH } = await import('./route')

function patchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/kengash/captains', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/kengash/captains', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('propagates the guard rejecting a revoked captains.manage', async () => {
    const { NextResponse } = await import('next/server')
    requireCouncilChair.mockResolvedValue({
      error: NextResponse.json({ error: 'Bu bo‘lim uchun dekan ruxsat bermagan', code: 'PERMISSION_REVOKED' }, { status: 403 }),
    })
    const response = await PATCH(patchRequest({ studentId: 's-1', isCaptain: true }))
    expect(response.status).toBe(403)
    expect(requireCouncilChair).toHaveBeenCalledWith(expect.anything(), 'captains.manage')
  })

  it('rejects a target outside the caller’s own faculty', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 's-1', role: 'talaba', status: 'active', faculty: 'boshqa', gender: 'male', assigned_floor: 3, is_floor_captain: false },
      error: null,
    })
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }))
    requireCouncilChair.mockResolvedValue({ serviceSupabase: { from }, faculty: 'amit' })

    const response = await PATCH(patchRequest({ studentId: 's-1', isCaptain: true }))
    expect(response.status).toBe(403)
  })

  it('rejects promoting a student with no assigned floor', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 's-1', role: 'talaba', status: 'active', faculty: 'amit', gender: 'male', assigned_floor: null, is_floor_captain: false },
      error: null,
    })
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }))
    requireCouncilChair.mockResolvedValue({ serviceSupabase: { from }, faculty: 'amit' })

    const response = await PATCH(patchRequest({ studentId: 's-1', isCaptain: true }))
    expect(response.status).toBe(400)
  })

  it('promotes via the atomic promote_floor_captain RPC, keyed on the TARGET’s own gender (a raisi manages both genders)', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 's-1', role: 'talaba', status: 'active', faculty: 'amit', gender: 'female', assigned_floor: 4, is_floor_captain: false },
      error: null,
    })
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }))
    const rpc = vi.fn().mockResolvedValue({ error: null })
    // The caller (raisi) is male, the target being promoted is female — the
    // RPC must key on the target's gender, not the caller's.
    requireCouncilChair.mockResolvedValue({ serviceSupabase: { from, rpc }, faculty: 'amit' })

    const response = await PATCH(patchRequest({ studentId: 's-1', isCaptain: true }))
    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('promote_floor_captain', {
      p_user_id: 's-1',
      p_assigned_floor: 4,
      p_gender: 'female',
      p_is_captain: true,
    })
  })

  it('demotes with a plain update, no RPC involved', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 's-1', role: 'talaba', status: 'active', faculty: 'amit', gender: 'male', assigned_floor: 4, is_floor_captain: true },
      error: null,
    })
    const update = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }))
    const from = vi.fn((table: string) => {
      if (table !== 'users') throw new Error(`unexpected table ${table}`)
      return { select: () => ({ eq: () => ({ maybeSingle }) }), update }
    })
    const rpc = vi.fn()
    requireCouncilChair.mockResolvedValue({ serviceSupabase: { from, rpc }, faculty: 'amit' })

    const response = await PATCH(patchRequest({ studentId: 's-1', isCaptain: false }))
    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith({ is_floor_captain: false })
    expect(rpc).not.toHaveBeenCalled()
  })
})
