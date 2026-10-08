import { beforeEach, describe, expect, it, vi } from 'vitest'

const updateAuth = vi.fn<(id: string, email: string) => Promise<{ error: { message?: string; code?: string } | null }>>(
  async () => ({ error: null }),
)
vi.mock('@/lib/supabase-admin-auth', () => ({
  updateAuthUserEmailSafely: (id: string, email: string) => updateAuth(id, email),
  isDuplicateAuthUserError: (e: { code?: string } | null) => e?.code === 'email_exists',
}))
const audit = vi.fn()
vi.mock('@/lib/audit-log', () => ({ writeAuditLog: (e: unknown) => audit(e) }))
vi.mock('@/lib/email', () => ({ sendStudentBlacklistEmail: vi.fn(), sendStudentWarningEmail: vi.fn() }))
vi.mock('@/lib/push-notifications', () => ({ sendPushWithoutBreaking: vi.fn() }))
vi.mock('@/lib/notify-student', () => ({ notifyStudent: vi.fn() }))

const { createFacultyStudentsService } = await import('./service')

const student = { id: 'u1', full_name: 'Farangiz', email: 'old@x.uz', faculty: 'amit', role: 'talaba', jshshir: '123' }
const permit = { id: 'p1', full_name: 'Husanboy', email: 'old@x.uz', faculty: 'amit', status: 'approved', jshshir: '456', passport_series: 'AD1' }

function repo(overrides: Record<string, unknown> = {}) {
  return {
    findStudentForEmail: vi.fn(async () => student),
    findPermitForEmail: vi.fn(async () => permit),
    accountExistsForPermit: vi.fn(async () => false),
    emailTaken: vi.fn(async () => false),
    permitIdsForAccount: vi.fn(async () => ['p9']),
    setUserEmail: vi.fn(async () => true),
    setPermitEmails: vi.fn(async () => undefined),
    ...overrides,
  }
}
const svc = (r: ReturnType<typeof repo>) => createFacultyStudentsService(r as never)

beforeEach(() => {
  updateAuth.mockClear()
  updateAuth.mockResolvedValue({ error: null })
  audit.mockClear()
})

describe('changeEmail — registered student', () => {
  it('updates Auth, the profile and the account\'s permits, lowercased, and audits it', async () => {
    const r = repo()
    const res = await svc(r).changeEmail('amit', { target: 'student', id: 'u1', email: '  New@X.uz ' }, 'dekan1')
    expect(res).toEqual({ ok: true, email: 'new@x.uz' })
    expect(updateAuth).toHaveBeenCalledWith('u1', 'new@x.uz')
    expect(r.setUserEmail).toHaveBeenCalledWith('u1', 'new@x.uz')
    expect(r.setPermitEmails).toHaveBeenCalledWith(['p9'], 'new@x.uz')
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'student.email_change', actorUserId: 'dekan1' }))
  })

  it('rejects a malformed address before touching anything', async () => {
    const r = repo()
    await expect(svc(r).changeEmail('amit', { target: 'student', id: 'u1', email: 'not-an-email' }))
      .rejects.toMatchObject({ status: 400 })
    expect(updateAuth).not.toHaveBeenCalled()
  })

  it('refuses another faculty\'s student', async () => {
    const r = repo({ findStudentForEmail: vi.fn(async () => ({ ...student, faculty: 'iqtisodiyot' })) })
    await expect(svc(r).changeEmail('amit', { target: 'student', id: 'u1', email: 'a@b.uz' }))
      .rejects.toMatchObject({ status: 403 })
    expect(updateAuth).not.toHaveBeenCalled()
  })

  it('409s when the address is already held by someone else', async () => {
    const r = repo({ emailTaken: vi.fn(async () => true) })
    await expect(svc(r).changeEmail('amit', { target: 'student', id: 'u1', email: 'a@b.uz' }))
      .rejects.toMatchObject({ status: 409 })
    expect(updateAuth).not.toHaveBeenCalled()
  })

  it('409s when Auth itself reports a duplicate, and writes nothing else', async () => {
    updateAuth.mockResolvedValue({ error: { message: 'exists', code: 'email_exists' } })
    const r = repo()
    await expect(svc(r).changeEmail('amit', { target: 'student', id: 'u1', email: 'a@b.uz' }))
      .rejects.toMatchObject({ status: 409 })
    expect(r.setUserEmail).not.toHaveBeenCalled()
  })

  it('puts the old sign-in email back if the profile write fails', async () => {
    const r = repo({ setUserEmail: vi.fn(async () => { throw new Error('db down') }) })
    await expect(svc(r).changeEmail('amit', { target: 'student', id: 'u1', email: 'a@b.uz' }))
      .rejects.toThrow('db down')
    expect(updateAuth).toHaveBeenLastCalledWith('u1', 'old@x.uz')
  })

  it('is a no-op when the email is unchanged', async () => {
    const r = repo()
    await svc(r).changeEmail('amit', { target: 'student', id: 'u1', email: 'OLD@x.uz' })
    expect(updateAuth).not.toHaveBeenCalled()
    expect(r.setUserEmail).not.toHaveBeenCalled()
  })
})

describe('changeEmail — unregistered permit', () => {
  it('updates only the permit row', async () => {
    const r = repo()
    const res = await svc(r).changeEmail('amit', { target: 'permit', id: 'p1', email: 'mbm@x.uz' })
    expect(res.email).toBe('mbm@x.uz')
    expect(r.setPermitEmails).toHaveBeenCalledWith(['p1'], 'mbm@x.uz')
    expect(updateAuth).not.toHaveBeenCalled()
  })

  it('refuses once the person has registered (edit the student instead)', async () => {
    const r = repo({ accountExistsForPermit: vi.fn(async () => true) })
    await expect(svc(r).changeEmail('amit', { target: 'permit', id: 'p1', email: 'a@b.uz' }))
      .rejects.toMatchObject({ status: 409 })
    expect(r.setPermitEmails).not.toHaveBeenCalled()
  })

  it('only edits approved permits', async () => {
    const r = repo({ findPermitForEmail: vi.fn(async () => ({ ...permit, status: 'pending' })) })
    await expect(svc(r).changeEmail('amit', { target: 'permit', id: 'p1', email: 'a@b.uz' }))
      .rejects.toMatchObject({ status: 409 })
  })

  it('refuses another faculty\'s permit', async () => {
    const r = repo({ findPermitForEmail: vi.fn(async () => ({ ...permit, faculty: 'iqtisodiyot' })) })
    await expect(svc(r).changeEmail('amit', { target: 'permit', id: 'p1', email: 'a@b.uz' }))
      .rejects.toMatchObject({ status: 403 })
  })
})
