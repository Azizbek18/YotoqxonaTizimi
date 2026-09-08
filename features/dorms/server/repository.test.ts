import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({ from: mocks.from, rpc: mocks.rpc }),
}))

import { createDormRepository } from './repository'

describe('createDormRepository.linkFaculty', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rpc.mockResolvedValue({ error: null })
  })

  it('uses the atomic RPC directly for a primary link', async () => {
    await createDormRepository().linkFaculty('amit', 'd2', { primary: true })

    expect(mocks.rpc).toHaveBeenCalledWith('set_primary_dorm', {
      p_faculty: 'amit',
      p_dorm_id: 'd2',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('upserts an additional dorm as non-primary without switching primary', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ upsert })

    await createDormRepository().linkFaculty('amit', 'd2', { primary: false })

    expect(mocks.from).toHaveBeenCalledWith('faculty_dorm')
    expect(upsert).toHaveBeenCalledWith(
      { faculty: 'amit', dorm_id: 'd2', is_primary: false },
      { onConflict: 'faculty,dorm_id', ignoreDuplicates: true },
    )
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('surfaces an atomic primary-switch failure', async () => {
    const error = new Error('switch failed')
    mocks.rpc.mockResolvedValue({ error })

    await expect(createDormRepository().linkFaculty('amit', 'd2')).rejects.toBe(error)
  })
})
