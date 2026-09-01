import { describe, expect, it, vi } from 'vitest'

process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-secret-key-for-applications-service'

vi.mock('@/lib/telegram', () => ({ sendTelegramAdminMessage: vi.fn(async () => {}) }))
vi.mock('@/lib/email', () => ({ sendArizaSignedEmail: vi.fn(async () => {}) }))

const { createApplicationService } = await import('./service')
const { verifyArizaRecord } = await import('@/lib/ariza-signature')
import type { ApplicationRepository } from './repository'

const PROFILE = {
  id: 'stu-1', full_name: 'Aliyev Vali Akmal oʻgʻli', email: 'aliyev@example.com',
  faculty: 'amit', direction: 'amaliy-matematika', course: 3,
}

function fakeRepo(over: Partial<ApplicationRepository> = {}) {
  const store: { ariza: Record<string, unknown> | null; signature: Record<string, unknown> | null } = {
    ariza: null, signature: null,
  }
  const base = {
    getStudentDetails: vi.fn(async () => PROFILE),
    create: vi.fn(async (row: Record<string, unknown>) => {
      store.ariza = { id: 'ariza-1', ...row }
      return store.ariza
    }),
    getOwnedDraft: vi.fn(async () => (store.ariza && store.ariza.status === 'draft' ? store.ariza : null)),
    getOwned: vi.fn(async () => store.ariza),
    submitOwnedDraft: vi.fn(async () => {
      if (!store.ariza || store.ariza.status !== 'draft') return null
      store.ariza = { ...store.ariza, status: 'pending' }
      return store.ariza
    }),
    insertSignature: vi.fn(async (row: Record<string, unknown>) => {
      if (store.signature) { const e = new Error('duplicate'); throw e }
      store.signature = { id: 'sig-1', created_at: 'now', ...row }
      return store.signature
    }),
    deleteSignatureByAriza: vi.fn(async () => { store.signature = null }),
    signatureByAriza: vi.fn(async () => store.signature),
    signatureByCode: vi.fn(async (code: string) =>
      store.signature && store.signature.verify_code === code ? store.signature : null),
    arizaById: vi.fn(async () => store.ariza),
    deleteOwned: vi.fn(async () => null),
    list: vi.fn(async () => []),
    updateOwned: vi.fn(async () => null),
  }
  return { store, repo: { ...base, ...over } as unknown as ApplicationRepository }
}

const sig = (typedName = PROFILE.full_name) => ({ typedName, attested: true })

describe('createApplicationService — signing', () => {
  it('chat needs no signature', async () => {
    const { repo, store } = fakeRepo()
    const r = await createApplicationService(repo).create('stu-1', { type: 'chat', title: 'x', text: 'salom' })
    expect(r.success).toBe(true)
    expect(store.signature).toBeNull()
  })

  it('an ariza submitted without a signature is rejected', async () => {
    const { repo } = fakeRepo()
    await expect(
      createApplicationService(repo).create('stu-1', { type: 'ariza', title: 'Ariza', text: 'matn', status: 'pending' }),
    ).rejects.toThrow(/imzolang/i)
  })

  it('a mismatched typed name is rejected', async () => {
    const { repo } = fakeRepo()
    await expect(
      createApplicationService(repo).create('stu-1', {
        type: 'ariza', title: 'Ariza', text: 'matn', status: 'pending', signature: sig('Boshqa Odam'),
      }),
    ).rejects.toThrow(/F\.I\.Sh/i)
  })

  it('a signed ariza: draft first, signature row, then pending + receipt', async () => {
    const { repo, store } = fakeRepo()
    const r = await createApplicationService(repo).create('stu-1', {
      type: 'ariza', title: 'Tungi ruxsat', text: 'matn', reason: 'sabab', status: 'pending', signature: sig(),
    })
    expect((store.ariza as Record<string, unknown>).status).toBe('pending')
    expect(store.signature).toBeTruthy()
    expect(r.receipt?.verifyCode).toMatch(/^YT-/)
    // name/spacing tolerant
    const check = verifyArizaRecord({
      contentSnapshot: (store.signature as Record<string, unknown>).content_snapshot as Record<string, unknown>,
      contentHash: (store.signature as Record<string, unknown>).content_hash as string,
      studentId: (store.signature as Record<string, unknown>).student_id as string,
      signedAt: (store.signature as Record<string, unknown>).signed_at as string,
      verifyCode: (store.signature as Record<string, unknown>).verify_code as string,
      signature: (store.signature as Record<string, unknown>).signature as string,
    })
    expect(check.valid).toBe(true)
  })

  it('accepts a differently-spelled name (script/case/spacing)', async () => {
    const { repo } = fakeRepo()
    const r = await createApplicationService(repo).create('stu-1', {
      type: 'tushuntirish', title: 'Tushuntirish', text: 'matn', status: 'pending',
      signature: sig('  aliyev   vali  akmal ogli '),
    })
    expect(r.receipt).toBeTruthy()
  })

  it('submit() on a signed-type draft requires and records the signature', async () => {
    const { repo, store } = fakeRepo()
    await createApplicationService(repo).create('stu-1', { type: 'ariza', title: 'A', text: 'm', status: 'draft' })
    await expect(createApplicationService(repo).submit('stu-1', 'ariza-1', undefined)).rejects.toThrow(/imzolang/i)
    const r = await createApplicationService(repo).submit('stu-1', 'ariza-1', sig())
    expect(r.receipt?.verifyCode).toMatch(/^YT-/)
    expect((store.ariza as Record<string, unknown>).status).toBe('pending')
  })

  it('verifyByCode: valid, then tamper-detected', async () => {
    const { repo, store } = fakeRepo()
    const created = await createApplicationService(repo).create('stu-1', {
      type: 'ariza', title: 'A', text: 'asl matn', status: 'pending', signature: sig(),
    })
    const code = created.receipt!.verifyCode
    const ok = await createApplicationService(repo).verifyByCode(code)
    expect(ok).toMatchObject({ valid: true, signedBy: PROFILE.full_name })

    ;(store.signature as Record<string, unknown>).content_snapshot = {
      ...((store.signature as Record<string, unknown>).content_snapshot as Record<string, unknown>),
      text: 'buzilgan matn',
    }
    const bad = await createApplicationService(repo).verifyByCode(code)
    expect(bad).toMatchObject({ valid: false, hashOk: false })
  })

  it('verifyByCode: unknown code → { valid: false }', async () => {
    const { repo } = fakeRepo()
    expect(await createApplicationService(repo).verifyByCode('YT-AAAA-BBBB')).toEqual({ valid: false })
    expect(await createApplicationService(repo).verifyByCode('junk')).toEqual({ valid: false })
  })

  it('remove() refuses a non-draft (signed) application', async () => {
    const { repo } = fakeRepo({ deleteOwned: vi.fn(async () => null) })
    await expect(createApplicationService(repo).remove('stu-1', 'ariza-1')).rejects.toThrow(/o'chirib bo'lmaydi|topilmadi/i)
  })

  it('staffSignature: unsigned vs signed', async () => {
    const { repo, store } = fakeRepo()
    store.ariza = { id: 'ariza-1', status: 'pending', title: 'A', type: 'ariza' }
    expect(await createApplicationService(repo).staffSignature('ariza-1')).toMatchObject({ signed: false })

    await createApplicationService(repo).create('stu-1', {
      type: 'ariza', title: 'A', text: 'm', status: 'pending', signature: sig(),
    })
    const s = await createApplicationService(repo).staffSignature('ariza-1')
    expect(s).toMatchObject({ signed: true })
    expect((s as { signature: { valid: boolean } }).signature.valid).toBe(true)
  })
})
