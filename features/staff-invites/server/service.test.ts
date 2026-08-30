import { describe, expect, it, vi } from 'vitest'
import { createStaffInviteService } from './service'
import type { StaffInviteRepository } from './repository'
import { hashInviteCode, normalizeInviteCode } from '@/lib/staff-invite'

function fakeRepository(overrides: Partial<StaffInviteRepository> = {}) {
  return {
    listByFaculty: vi.fn(async () => []),
    listByRole: vi.fn(async () => []),
    staffEmailExists: vi.fn(async () => false),
    pendingInviteForEmail: vi.fn(async () => null),
    pendingInviteForEmailAnywhere: vi.fn(async () => null),
    activeDekanExists: vi.fn(async () => false),
    insert: vi.fn(async (row: Record<string, unknown>) => ({
      id: 'inv-1',
      faculty: row.faculty,
      role: row.role,
      email: row.email,
      label: row.label,
      created_at: '2026-09-12T00:00:00Z',
      expires_at: row.expires_at,
      revoked_at: null,
      max_uses: row.max_uses,
      use_count: 0,
    })),
    revoke: vi.fn(async () => ({ id: 'inv-1' })),
    revokeAnyDean: vi.fn(async () => ({ id: 'inv-1' })),
    ...overrides,
  } as unknown as StaffInviteRepository
}

const VALID = { role: 'tarbiyachi' as const, email: 'Yangi.Tarbiyachi@Example.com' }

describe('staff invite service', () => {
  it('binds the code to a normalized email, single-use, and stores only its hash', async () => {
    const repo = fakeRepository()
    const invite = await createStaffInviteService(repo).create('dekan-1', 'kimyo', VALID)

    expect(invite.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(invite.faculty).toBe('kimyo')
    expect(invite.email).toBe('yangi.tarbiyachi@example.com')
    expect(invite.role).toBe('tarbiyachi')
    expect(invite.active).toBe(true)

    const insertArg = (repo.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertArg.email).toBe('yangi.tarbiyachi@example.com')
    expect(insertArg.max_uses).toBe(1)
    expect(insertArg.faculty).toBe('kimyo')
    expect(insertArg.created_by).toBe('dekan-1')
    expect(insertArg).not.toHaveProperty('code')
    expect(insertArg.code_hash).toBe(hashInviteCode(invite.code))
  })

  it('requires a valid email', async () => {
    await expect(
      createStaffInviteService(fakeRepository()).create('dekan-1', 'kimyo', { role: 'tarbiyachi', email: 'nope' }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rejects an email that already has a staff account', async () => {
    const repo = fakeRepository({ staffEmailExists: vi.fn(async () => true) })
    await expect(
      createStaffInviteService(repo).create('dekan-1', 'kimyo', VALID),
    ).rejects.toMatchObject({ status: 409 })
    expect(repo.insert).not.toHaveBeenCalled()
  })

  it('rejects a second pending code for the same email', async () => {
    const repo = fakeRepository({ pendingInviteForEmail: vi.fn(async () => ({ id: 'inv-old' })) })
    await expect(
      createStaffInviteService(repo).create('dekan-1', 'kimyo', VALID),
    ).rejects.toMatchObject({ status: 409 })
    expect(repo.insert).not.toHaveBeenCalled()
  })

  it('rejects an unknown role', async () => {
    await expect(
      createStaffInviteService(fakeRepository()).create('dekan-1', 'kimyo', { role: 'admin', email: 'a@b.com' }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rejects a dekan code — only the system owner mints dekan codes', async () => {
    await expect(
      createStaffInviteService(fakeRepository()).create('dekan-1', 'kimyo', { role: 'dekan', email: 'a@b.com' }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('derives active=false for a used-up or expired invite', async () => {
    const repo = fakeRepository({
      listByFaculty: vi.fn(async () => [
        { id: '1', faculty: 'kimyo', role: 'tarbiyachi', email: 'a@b.com', label: null, created_at: 'x', expires_at: '2000-01-01T00:00:00Z', revoked_at: null, max_uses: 1, use_count: 0 },
        { id: '2', faculty: 'kimyo', role: 'tarbiyachi', email: 'c@d.com', label: null, created_at: 'x', expires_at: '2999-01-01T00:00:00Z', revoked_at: null, max_uses: 1, use_count: 1 },
        { id: '3', faculty: 'kimyo', role: 'tarbiyachi', email: 'e@f.com', label: null, created_at: 'x', expires_at: '2999-01-01T00:00:00Z', revoked_at: '2026-01-01T00:00:00Z', max_uses: 1, use_count: 0 },
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

describe('superadmin dean invites', () => {
  const DEAN = { faculty: 'Fizika', email: 'Dekan@Example.com', expiryDays: 20 }

  it('mints a faculty-bound, email-bound, single-use dekan code', async () => {
    const repo = fakeRepository()
    const invite = await createStaffInviteService(repo).createDeanInvite('sa-1', DEAN)

    expect(invite.role).toBe('dekan')
    expect(invite.faculty).toBe('fizika')
    expect(invite.email).toBe('dekan@example.com')
    const insertArg = (repo.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertArg.max_uses).toBe(1)
    expect(insertArg.role).toBe('dekan')
  })

  it('refuses a faculty that already has an active dean', async () => {
    const repo = fakeRepository({ activeDekanExists: vi.fn(async () => true) })
    await expect(createStaffInviteService(repo).createDeanInvite('sa-1', DEAN)).rejects.toMatchObject({ status: 409 })
    expect(repo.insert).not.toHaveBeenCalled()
  })

  it('refuses an email that already holds a pending code anywhere', async () => {
    const repo = fakeRepository({ pendingInviteForEmailAnywhere: vi.fn(async () => ({ id: 'x' })) })
    await expect(createStaffInviteService(repo).createDeanInvite('sa-1', DEAN)).rejects.toMatchObject({ status: 409 })
  })

  it('rejects an unknown faculty code', async () => {
    await expect(
      createStaffInviteService(fakeRepository()).createDeanInvite('sa-1', { ...DEAN, faculty: 'nope' }),
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('invite code hashing', () => {
  it('is insensitive to case and formatting', () => {
    expect(normalizeInviteCode('ab7c-d2e9-xq4p')).toBe('AB7CD2E9XQ4P')
    expect(hashInviteCode('ab7c-d2e9-xq4p')).toBe(hashInviteCode('AB7CD2E9XQ4P'))
  })
})
