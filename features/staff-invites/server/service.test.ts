import { describe, expect, it, vi } from 'vitest'
import { createStaffInviteService } from './service'
import type { StaffInviteRepository } from './repository'
import { hashInviteCode, normalizeInviteCode } from '@/lib/staff-invite'

function fakeRepository(overrides: Partial<StaffInviteRepository> = {}) {
  return {
    listByFaculty: vi.fn(async () => []),
    insert: vi.fn(async (row: Record<string, unknown>) => ({
      id: 'inv-1',
      faculty: row.faculty,
      role: row.role,
      label: row.label,
      created_at: '2026-09-07T00:00:00Z',
      expires_at: row.expires_at,
      revoked_at: null,
      max_uses: row.max_uses,
      use_count: 0,
    })),
    revoke: vi.fn(async () => ({ id: 'inv-1' })),
    ...overrides,
  } as unknown as StaffInviteRepository
}

describe('staff invite service', () => {
  it('returns a plaintext code once and stores only its hash, bound to the caller faculty', async () => {
    const repo = fakeRepository()
    const invite = await createStaffInviteService(repo).create('dekan-1', 'kimyo', { role: 'tarbiyachi' })

    expect(invite.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(invite.faculty).toBe('kimyo')
    expect(invite.role).toBe('tarbiyachi')
    expect(invite.active).toBe(true)

    const insertArg = (repo.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertArg.faculty).toBe('kimyo')
    expect(insertArg.created_by).toBe('dekan-1')
    expect(insertArg).not.toHaveProperty('code')
    expect(insertArg.code_hash).toBe(hashInviteCode(invite.code))
  })

  it('rejects an unknown role', async () => {
    await expect(
      createStaffInviteService(fakeRepository()).create('dekan-1', 'kimyo', { role: 'admin' }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rejects a dekan (co-dekan) code — only the system owner mints dekan codes', async () => {
    await expect(
      createStaffInviteService(fakeRepository()).create('dekan-1', 'kimyo', { role: 'dekan' }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rejects an out-of-range use limit', async () => {
    await expect(
      createStaffInviteService(fakeRepository()).create('dekan-1', 'kimyo', { role: 'tarbiyachi', maxUses: 9999 }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('derives active=false for a used-up or expired invite', async () => {
    const repo = fakeRepository({
      listByFaculty: vi.fn(async () => [
        { id: '1', faculty: 'kimyo', role: 'tarbiyachi', label: null, created_at: 'x', expires_at: '2000-01-01T00:00:00Z', revoked_at: null, max_uses: null, use_count: 0 },
        { id: '2', faculty: 'kimyo', role: 'tarbiyachi', label: null, created_at: 'x', expires_at: '2999-01-01T00:00:00Z', revoked_at: null, max_uses: 2, use_count: 2 },
        { id: '3', faculty: 'kimyo', role: 'tarbiyachi', label: null, created_at: 'x', expires_at: '2999-01-01T00:00:00Z', revoked_at: '2026-01-01T00:00:00Z', max_uses: null, use_count: 0 },
      ]),
    })
    const rows = await createStaffInviteService(repo).list('kimyo')
    expect(rows.map((r) => r.active)).toEqual([false, false, false])
  })

  it('revoke scopes by faculty and 404s a missing invite', async () => {
    const repo = fakeRepository({ revoke: vi.fn(async () => null) })
    await expect(createStaffInviteService(repo).revoke('kimyo', 'inv-x')).rejects.toMatchObject({ status: 404 })
  })
})

describe('invite code hashing', () => {
  it('is insensitive to case and formatting', () => {
    expect(normalizeInviteCode('ab7c-d2e9-xq4p')).toBe('AB7CD2E9XQ4P')
    expect(hashInviteCode('ab7c-d2e9-xq4p')).toBe(hashInviteCode('AB7CD2E9XQ4P'))
  })
})
