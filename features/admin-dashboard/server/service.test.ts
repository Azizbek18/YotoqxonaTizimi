import { describe, expect, it, vi } from 'vitest'
import { createAdminDashboardService } from './service'
import type { AdminDashboardRepository } from './repository'

function fakeRepository(load: AdminDashboardRepository['load']) {
  return { load } as AdminDashboardRepository
}

describe('createAdminDashboardService', () => {
  it('loads exactly the requested faculty and counts only its rows', async () => {
    const load = vi.fn(async () => ({
      users: [
        { role: 'talaba', status: 'active' },
        { role: 'talaba', status: 'active' },
        { role: 'tarbiyachi' },
      ],
      staff: [{ id: 's1', role: 'tarbiyachi', faculty: 'kimyo' }],
      applications: [
        { created_at: '2026-09-01', status: 'approved', type: 'ariza' },
        { created_at: '2026-09-02', status: 'pending', type: 'ariza' },
      ],
    })) as unknown as AdminDashboardRepository['load']

    const payload = await createAdminDashboardService(fakeRepository(load)).get('kimyo')

    expect(load).toHaveBeenCalledWith('kimyo')
    expect(payload.stats.totalStudents).toBe(2)
    expect(payload.stats.totalRequests).toBe(2)
    expect(payload.stats.approvedRequests).toBe(1)
    expect(payload.stats.pendingRequests).toBe(1)
    // 1 tarbiyachi in staff + 1 tarbiyachi-role user
    expect(payload.roleCounts.educators).toBe(2)
  })
})
